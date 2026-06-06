/**
 * /api/stripe-webhook.ts — Vercel serverless function
 *
 * Handles Stripe subscription webhook events:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

// Map Stripe price IDs to tier names
function getPriceToTierMap(): Record<string, string> {
  return {
    [process.env.STRIPE_TIER1_PRICE_ID || ""]: "starter",
    [process.env.STRIPE_TIER2_PRICE_ID || ""]: "professional",
    [process.env.STRIPE_TIER3_PRICE_ID || ""]: "agency",
  };
}

export const config = {
  api: {
    bodyParser: false, // Required for Stripe signature verification
  },
};

// Helper to read raw body from request
function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Stripe webhook not configured" });
  }

  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["stripe-signature"] as string;

    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", (err as Error).message);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  // Respond 200 immediately
  res.status(200).json({ received: true });

  // Process event asynchronously
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const priceToTier = getPriceToTierMap();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const painterId = session.metadata?.painter_id;
        const tier = session.metadata?.tier;

        if (!painterId) {
          console.log("[stripe-webhook] checkout.session.completed — no painter_id in metadata");
          break;
        }

        // Retrieve the subscription to get the subscription ID
        const subscriptionId = session.subscription as string;

        const updateData: Record<string, unknown> = {
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          subscription_tier: tier || "starter",
          subscription_status: "active",
        };

        // If there's a trial, set trial_ends_at
        if (subscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            if (subscription.trial_end) {
              updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
            }
          } catch (subErr) {
            console.error("[stripe-webhook] Failed to retrieve subscription:", (subErr as Error).message);
          }
        }

        await supabase
          .from("users")
          .update(updateData)
          .eq("id", Number(painterId));

        console.log(`[stripe-webhook] checkout.session.completed — painter ${painterId} → tier: ${tier}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const painterId = subscription.metadata?.painter_id;

        if (!painterId) {
          console.log("[stripe-webhook] customer.subscription.updated — no painter_id in metadata");
          break;
        }

        // Determine the tier from the price ID
        const priceId = subscription.items.data[0]?.price?.id;
        const tier = priceToTier[priceId || ""] || "free";
        const status = subscription.status === "active" || subscription.status === "trialing"
          ? "active"
          : subscription.status === "past_due"
          ? "past_due"
          : "inactive";

        const updateData: Record<string, unknown> = {
          subscription_tier: tier,
          subscription_status: status,
          stripe_subscription_id: subscription.id,
        };

        if (subscription.trial_end) {
          updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
        }

        await supabase
          .from("users")
          .update(updateData)
          .eq("id", Number(painterId));

        console.log(`[stripe-webhook] subscription.updated — painter ${painterId} → tier: ${tier}, status: ${status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const painterId = subscription.metadata?.painter_id;

        if (!painterId) {
          console.log("[stripe-webhook] customer.subscription.deleted — no painter_id in metadata");
          break;
        }

        await supabase
          .from("users")
          .update({
            subscription_tier: "free",
            subscription_status: "inactive",
            stripe_subscription_id: null,
            trial_ends_at: null,
          })
          .eq("id", Number(painterId));

        console.log(`[stripe-webhook] subscription.deleted — painter ${painterId} → free/inactive`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        if (!customerId) break;

        // Find the painter by stripe_customer_id
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("users")
            .update({ subscription_status: "past_due" })
            .eq("id", user.id);

          console.log(`[stripe-webhook] invoice.payment_failed — painter ${user.id} → past_due`);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Ignoring unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[stripe-webhook] Processing error:", (err as Error).message);
  }
}
