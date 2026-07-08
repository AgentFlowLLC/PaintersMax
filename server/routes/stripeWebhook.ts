/**
 * stripeWebhook.ts — Stripe payment webhook handler
 *
 * Listens for POST /api/webhooks/stripe and handles:
 *   - checkout.session.completed      → mark invoice paid, send confirmation
 *   - payment_intent.succeeded        → mark invoice paid, send confirmation
 *   - payment_intent.payment_failed   → log failure reason, update status to 'overdue'
 *
 * For each successful payment event, the handler:
 *   1. Verifies the Stripe-Signature header using stripe.webhooks.constructEvent()
 *   2. Finds the matching invoice in the database
 *   3. Marks the invoice as paid (status → 'paid', paidAt → now)
 *   4. Updates the associated lead's pipeline stage to 'paid'
 *   5. Sends a payment confirmation email to the customer (non-fatal)
 *   6. Sends a payment notification SMS to the business owner (non-fatal)
 *
 * For failed payments:
 *   1. Finds the matching invoice
 *   2. Logs the failure reason to the communication log
 *   3. Updates invoice status to 'overdue' (schema's closest status to 'failed')
 *
 * Returns 200 immediately to Stripe; all processing is async and wrapped in
 * try/catch so failures never crash the server.
 *
 * ─── Required Vercel Environment Variables ────────────────────────────────────
 * STRIPE_WEBHOOK_SECRET  — Stripe Dashboard → Developers → Webhooks → Signing secret
 *
 * Register in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL: https://paintcrm-h9zwcmfu.manus.space/api/webhooks/stripe
 *   Events to send:
 *     checkout.session.completed
 *     payment_intent.succeeded
 *     payment_intent.payment_failed
 *
 * IMPORTANT: Register in server/_core/index.ts BEFORE express.json() middleware
 * so the raw body Buffer is preserved for stripe.webhooks.constructEvent().
 */
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { invoices, leads, communicationLog, appSettings, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "../_core/env";
import { sendEmail } from "../lib/email";
import { sendSMS } from "../lib/sms";

// Map Stripe price IDs to tier names for subscription events
function getPriceToTierMap(): Record<string, string> {
  return {
    [ENV.stripeTier1PriceId]: "starter",
    [ENV.stripeTier2PriceId]: "professional",
    [ENV.stripeTier3PriceId]: "agency",
  };
}

// ─── Stripe client (lazy — only instantiated when secret key is present) ──────

function getStripeClient(): Stripe | null {
  if (!ENV.stripeSecretKey) {
    console.warn("[Stripe Webhook] STRIPE_SECRET_KEY not set — Stripe client unavailable");
    return null;
  }
  return new Stripe(ENV.stripeSecretKey);
}

// ─── Invoice lookup helpers ───────────────────────────────────────────────────

async function findInvoiceByStripeIds(
  paymentLinkId: string | null | undefined,
  sessionOrIntentId: string | null | undefined
) {
  const db = await getDb();
  if (!db) return undefined;

  if (paymentLinkId) {
    const rows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.stripePaymentLinkId, paymentLinkId))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  if (sessionOrIntentId) {
    const rows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeSessionId, sessionOrIntentId))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  return undefined;
}

// ─── Post-payment notifications ───────────────────────────────────────────────

async function sendPaymentNotifications(
  invoiceId: number,
  leadId: number,
  invoiceNumber: string,
  totalAmount: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const lead = leadRows[0];
  if (!lead) return;

  const customerName = `${lead.firstName} ${lead.lastName}`.trim();

  let businessName = "PaintersMax";
  try {
    const settingsRows = await db
      .select({ businessName: appSettings.businessName })
      .from(appSettings)
      .limit(1);
    businessName = settingsRows[0]?.businessName || businessName;
  } catch { /* non-fatal */ }

  // ── Email: Payment confirmation → customer ──────────────────────────────────
  if (lead.email) {
    try {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #059669; padding: 24px 32px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">Payment Confirmed</h1>
      <p style="color: #a7f3d0; margin: 4px 0 0; font-size: 14px;">${businessName}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi ${customerName},</p>
      <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">
        We have received your payment for invoice <strong>#${invoiceNumber}</strong>. Thank you for your business!
      </p>
      <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 6px;">
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; width: 160px;">Invoice</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 14px; font-weight: 600;">#${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Amount Paid</td>
          <td style="padding: 12px 16px; color: #059669; font-size: 14px; font-weight: 700; border-top: 1px solid #e5e7eb;">$${totalAmount}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Date</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 14px; border-top: 1px solid #e5e7eb;">${new Date().toLocaleDateString()}</td>
        </tr>
      </table>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">Thank you from the ${businessName} team.</p>
    </div>
  </div>
</body>
</html>`;
      await sendEmail({
        to: lead.email,
        subject: `Payment Confirmed — Invoice #${invoiceNumber} | ${businessName}`,
        html,
      });
      console.log(`[Stripe Webhook] Payment confirmation email sent to ${lead.email}`);
    } catch (emailErr) {
      console.warn("[Stripe Webhook] Failed to send payment confirmation email:", (emailErr as Error).message);
    }
  }

  // ── SMS: Payment notification → business owner ──────────────────────────────
  try {
    const ownerPhone = process.env.OWNER_PHONE;
    if (ownerPhone) {
      await sendSMS({
        to: ownerPhone,
        body: `${customerName} paid invoice #${invoiceNumber} - $${totalAmount}`,
      });
      console.log(`[Stripe Webhook] Payment SMS sent to owner (${ownerPhone})`);
    }
  } catch (smsErr) {
    console.warn("[Stripe Webhook] Failed to send payment SMS:", (smsErr as Error).message);
  }
}

// ─── markPaidAndUpdateLead ────────────────────────────────────────────────────

async function markPaidAndUpdateLead(
  invoiceId: number,
  leadId: number,
  sessionId: string | null | undefined,
  eventType: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const paidAt = new Date();

  await db
    .update(invoices)
    .set({ status: "paid", paidAt, stripeSessionId: sessionId ?? null })
    .where(eq(invoices.id, invoiceId));

  await db
    .update(leads)
    .set({ stage: "paid", paidAt })
    .where(eq(leads.id, leadId));

  try {
    const inv = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    const invoice = inv[0];
    await db.insert(communicationLog).values({
      leadId,
      type: "system",
      direction: "internal",
      subject: `Payment received via Stripe (${eventType})`,
      content:
        `Invoice ${invoice?.invoiceNumber ?? `#${invoiceId}`} marked as paid` +
        (invoice?.total ? ` ($${invoice.total})` : "") +
        `. Stripe event: ${eventType}.` +
        (sessionId ? ` Session/Intent: ${sessionId}.` : ""),
      sentBy: null,
    });
  } catch (logErr) {
    console.warn("[Stripe Webhook] Failed to write communication log:", (logErr as Error).message);
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<{ processed: boolean; reason?: string }> {
  // ── Handle subscription checkout sessions ──────────────────────────────────
  if (session.mode === "subscription" && session.metadata?.painter_id) {
    const painterId = session.metadata.painter_id;
    const tier = session.metadata.tier || "starter";
    const subscriptionId = session.subscription as string;

    const db = await getDb();
    if (db) {
      const updateData: Record<string, unknown> = {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscriptionId,
        subscriptionTier: tier,
        subscriptionStatus: "active",
      };

      // Check for trial period
      if (subscriptionId) {
        try {
          const stripe = getStripeClient();
          if (stripe) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            if (subscription.trial_end) {
              updateData.trialEndsAt = new Date(subscription.trial_end * 1000);
            }
          }
        } catch (subErr) {
          console.warn("[Stripe Webhook] Failed to retrieve subscription for trial info:", (subErr as Error).message);
        }
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, Number(painterId)));

      console.log(`[Stripe Webhook] Subscription checkout completed — painter ${painterId} → tier: ${tier}`);
    }
    return { processed: true };
  }

  // ── Handle one-time payment checkout sessions (invoices) ────────────────────
  if (session.payment_status !== "paid") {
    return { processed: false, reason: `payment_status is '${session.payment_status}', not 'paid'` };
  }

  const invoice = await findInvoiceByStripeIds(
    session.payment_link as string | null,
    session.id
  );
  if (!invoice) {
    return {
      processed: false,
      reason: `No invoice found for payment_link=${session.payment_link ?? "null"} session=${session.id}`,
    };
  }
  if (invoice.status === "paid") {
    return { processed: true, reason: "Already paid — skipping" };
  }

  await markPaidAndUpdateLead(invoice.id, invoice.leadId, session.id, "checkout.session.completed");
  console.log(`[Stripe Webhook] Invoice ${invoice.invoiceNumber} (id=${invoice.id}) marked paid via checkout.session.completed`);

  try {
    await sendPaymentNotifications(
      invoice.id,
      invoice.leadId,
      invoice.invoiceNumber,
      parseFloat(String(invoice.total)).toFixed(2)
    );
  } catch (notifErr) {
    console.warn("[Stripe Webhook] Post-payment notifications failed:", (notifErr as Error).message);
  }

  return { processed: true };
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ processed: boolean; reason?: string }> {
  const metaInvoiceId = paymentIntent.metadata?.invoice_id
    ? parseInt(paymentIntent.metadata.invoice_id, 10)
    : undefined;

  let invoice;
  if (metaInvoiceId && !isNaN(metaInvoiceId)) {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, metaInvoiceId))
        .limit(1);
      invoice = rows[0];
    }
  }

  if (!invoice) {
    invoice = await findInvoiceByStripeIds(null, paymentIntent.id);
  }

  if (!invoice) {
    return {
      processed: false,
      reason: `No invoice found for payment_intent=${paymentIntent.id}`,
    };
  }
  if (invoice.status === "paid") {
    return { processed: true, reason: "Already paid — skipping" };
  }

  await markPaidAndUpdateLead(invoice.id, invoice.leadId, paymentIntent.id, "payment_intent.succeeded");
  console.log(`[Stripe Webhook] Invoice ${invoice.invoiceNumber} (id=${invoice.id}) marked paid via payment_intent.succeeded`);

  try {
    const amountPaid = paymentIntent.amount
      ? (paymentIntent.amount / 100).toFixed(2)
      : parseFloat(String(invoice.total)).toFixed(2);
    await sendPaymentNotifications(
      invoice.id,
      invoice.leadId,
      invoice.invoiceNumber,
      amountPaid
    );
  } catch (notifErr) {
    console.warn("[Stripe Webhook] Post-payment notifications failed:", (notifErr as Error).message);
  }

  return { processed: true };
}

async function handlePaymentIntentPaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ processed: boolean; reason?: string }> {
  // Extract failure reason from last_payment_error
  const failureReason =
    (paymentIntent as unknown as { last_payment_error?: { message?: string } })
      .last_payment_error?.message ?? "Unknown failure reason";

  console.warn(
    `[Stripe Webhook] payment_intent.payment_failed: ${paymentIntent.id} — ${failureReason}`
  );

  const metaInvoiceId = paymentIntent.metadata?.invoice_id
    ? parseInt(paymentIntent.metadata.invoice_id, 10)
    : undefined;

  let invoice;
  if (metaInvoiceId && !isNaN(metaInvoiceId)) {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, metaInvoiceId))
        .limit(1);
      invoice = rows[0];
    }
  }

  if (!invoice) {
    invoice = await findInvoiceByStripeIds(null, paymentIntent.id);
  }

  if (!invoice) {
    return {
      processed: false,
      reason: `No invoice found for failed payment_intent=${paymentIntent.id}`,
    };
  }

  const db = await getDb();
  if (db) {
    try {
      // Update invoice status to 'overdue' (schema's closest status to 'failed')
      await db
        .update(invoices)
        .set({ status: "overdue" })
        .where(eq(invoices.id, invoice.id));

      // Log the failure reason to the communication log
      await db.insert(communicationLog).values({
        leadId: invoice.leadId,
        type: "system",
        direction: "internal",
        subject: `Payment failed — Invoice ${invoice.invoiceNumber}`,
        content:
          `Payment attempt failed for invoice ${invoice.invoiceNumber}` +
          (invoice.total ? ` ($${invoice.total})` : "") +
          `. Failure reason: ${failureReason}` +
          `. Stripe PaymentIntent: ${paymentIntent.id}.`,
        sentBy: null,
      });

      console.log(
        `[Stripe Webhook] Invoice ${invoice.invoiceNumber} (id=${invoice.id}) marked overdue — payment failed: ${failureReason}`
      );
    } catch (dbErr) {
      console.error("[Stripe Webhook] Failed to update invoice on payment failure:", (dbErr as Error).message);
    }
  }

  return { processed: true };
}

// ─── Subscription event handlers ──────────────────────────────────────────────

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const painterId = subscription.metadata?.painter_id;
  if (!painterId) {
    console.log("[Stripe Webhook] subscription.updated — no painter_id in metadata");
    return;
  }

  const db = await getDb();
  if (!db) return;

  // Inline price_data checkout sessions (Chunk 4) don't use fixed Stripe Price
  // IDs, so the subscription's own metadata (set at checkout) is the source
  // of truth for tier. Fall back to the price-ID map for older subscriptions.
  const priceToTier = getPriceToTierMap();
  const priceId = subscription.items.data[0]?.price?.id;
  const tier = subscription.metadata?.tier || priceToTier[priceId || ""] || "free";
  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? "active"
      : subscription.status === "past_due"
      ? "past_due"
      : "inactive";

  await db
    .update(users)
    .set({
      subscriptionTier: tier,
      subscriptionStatus: status,
      stripeSubscriptionId: subscription.id,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    })
    .where(eq(users.id, Number(painterId)));

  console.log(
    `[Stripe Webhook] subscription.updated — painter ${painterId} → tier: ${tier}, status: ${status}`
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const painterId = subscription.metadata?.painter_id;
  if (!painterId) {
    console.log("[Stripe Webhook] subscription.deleted — no painter_id in metadata");
    return;
  }

  const db = await getDb();
  if (!db) return;

  await db
    .update(users)
    .set({
      subscriptionTier: "free",
      subscriptionStatus: "inactive",
      stripeSubscriptionId: null,
      trialEndsAt: null,
    })
    .where(eq(users.id, Number(painterId)));

  console.log(
    `[Stripe Webhook] subscription.deleted — painter ${painterId} → free/inactive`
  );
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId = invoice.customer as string;
  if (!customerId) return;

  const db = await getDb();
  if (!db) return;

  // Find the painter by stripe_customer_id
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  const user = userRows[0];
  if (user) {
    await db
      .update(users)
      .set({ subscriptionStatus: "past_due" })
      .where(eq(users.id, user.id));

    console.log(
      `[Stripe Webhook] invoice.payment_failed — painter ${user.id} → past_due`
    );
  }
}

// ─── Express route registration ───────────────────────────────────────────────

/**
 * Registers the POST /api/webhooks/stripe route on the Express app.
 *
 * IMPORTANT: This MUST be registered BEFORE express.json() middleware so that
 * the raw request body Buffer is preserved for stripe.webhooks.constructEvent().
 * Call this from server/_core/index.ts.
 */
export function registerStripeWebhook(app: Express): void {
  app.post(
    "/api/webhooks/stripe",
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    (req: Request, res: Response, next) => {
      // Capture raw body as Buffer — required for stripe.webhooks.constructEvent()
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
        next();
      });
      req.on("error", (err) => {
        console.error("[Stripe Webhook] Request stream error:", err.message);
        res.status(400).json({ error: "Request stream error" });
      });
    },
    async (req: Request, res: Response) => {
      // ── Respond 200 immediately so Stripe does not time out ─────────────────
      res.status(200).json({ received: true });

      // ── All processing is async and fully wrapped — never crashes ────────────
      try {
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        if (!rawBody) {
          console.error("[Stripe Webhook] No raw body captured");
          return;
        }

        const signatureHeader = req.headers["stripe-signature"] as string | undefined;
        const webhookSecret = ENV.stripeWebhookSecret;
        const stripe = getStripeClient();

        // ── Signature verification via stripe.webhooks.constructEvent ──────────
        let event: Stripe.Event;
        if (webhookSecret && stripe) {
          try {
            event = stripe.webhooks.constructEvent(
              rawBody,
              signatureHeader ?? "",
              webhookSecret
            );
          } catch (sigErr) {
            console.error(
              `[Stripe Webhook] stripe.webhooks.constructEvent failed: ${(sigErr as Error).message}`
            );
            return;
          }
        } else {
          // Dev/test mode — no secret configured, parse body directly
          if (!webhookSecret) {
            console.warn(
              "[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev mode)"
            );
          }
          try {
            event = JSON.parse(rawBody.toString("utf8")) as Stripe.Event;
          } catch (parseErr) {
            console.error("[Stripe Webhook] Failed to parse JSON body:", (parseErr as Error).message);
            return;
          }
        }

        console.log(`[Stripe Webhook] Received event: ${event.type} (id=${event.id})`);

        // ── Route by event type ──────────────────────────────────────────────
        if (event.type === "checkout.session.completed") {
          const result = await handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          if (!result.processed) {
            console.log(`[Stripe Webhook] checkout.session.completed not processed: ${result.reason}`);
          }
        } else if (event.type === "payment_intent.succeeded") {
          const result = await handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent
          );
          if (!result.processed) {
            console.log(`[Stripe Webhook] payment_intent.succeeded not processed: ${result.reason}`);
          }
        } else if (event.type === "payment_intent.payment_failed") {
          const result = await handlePaymentIntentPaymentFailed(
            event.data.object as Stripe.PaymentIntent
          );
          if (!result.processed) {
            console.log(`[Stripe Webhook] payment_intent.payment_failed not processed: ${result.reason}`);
          }
        } else if (event.type === "customer.subscription.updated") {
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        } else if (event.type === "customer.subscription.deleted") {
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        } else if (event.type === "invoice.payment_failed") {
          // Handle subscription invoice payment failures
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        } else {
          console.log(`[Stripe Webhook] Ignoring unhandled event type: ${event.type}`);
        }
      } catch (err) {
        // Never crash — log and swallow all errors
        console.error("[Stripe Webhook] Unhandled error in async processing:", (err as Error).message);
      }
    }
  );
}
