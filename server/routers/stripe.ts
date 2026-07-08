import { z } from "zod";
import { paidProcedure, router } from "../_core/trpc";
import { getLeadById, updateLead, createCommunicationLogEntry, getDb } from "../db";
import { ENV } from "../_core/env";
import { appSettings } from "../../drizzle/schema";

/**
 * Resolve the effective Stripe secret key.
 * Priority: app_settings.stripeSecretKey (DB) → ENV.stripeSecretKey → undefined
 */
async function resolveStripeSecretKey(): Promise<string | undefined> {
  try {
    const db = await getDb();
    if (db) {
      const rows = await db.select().from(appSettings).limit(1);
      const dbKey = rows[0]?.stripeSecretKey;
      if (dbKey) return dbKey;
    }
  } catch {
    // DB unavailable — fall through to ENV
  }
  return ENV.stripeSecretKey || undefined;
}

export const stripeRouter = router({
  createPaymentLink: paidProcedure
    .input(
      z.object({
        leadId: z.number(),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new Error("Lead not found");

      const stripeKey = await resolveStripeSecretKey();
      if (!stripeKey) {
        // Return mock link when Stripe is not configured
        const mockUrl = `https://buy.stripe.com/test_mock_${input.leadId}_${Date.now()}`;
        await updateLead(input.leadId, { stripePaymentLinkUrl: mockUrl });
        await createCommunicationLogEntry({
          leadId: input.leadId,
          type: "system",
          direction: "internal",
          subject: "Payment Link Generated (Mock)",
          content: `Mock payment link created for $${input.amount}. Configure Stripe keys in Settings → Payment Settings to enable real payments.`,
          sentBy: ctx.user.id,
        });
        return { url: mockUrl, mock: true };
      }

      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey);

        const paymentLink = await stripe.paymentLinks.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: input.description || `${lead.projectType || "Project"} - ${lead.firstName} ${lead.lastName}`,
                },
                unit_amount: Math.round(input.amount * 100),
              },
              quantity: 1,
            },
          ],
        });

        await updateLead(input.leadId, {
          stripePaymentLinkUrl: paymentLink.url,
        });

        await createCommunicationLogEntry({
          leadId: input.leadId,
          type: "system",
          direction: "internal",
          subject: "Payment Link Generated",
          content: `Stripe payment link created for $${input.amount}: ${paymentLink.url}`,
          sentBy: ctx.user.id,
        });

        return { url: paymentLink.url, mock: false };
      } catch (err) {
        throw new Error(`Stripe error: ${(err as Error).message}`);
      }
    }),

  markPaid: paidProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await updateLead(input.leadId, {
        stage: "paid",
        paidAt: new Date(),
      });
      await createCommunicationLogEntry({
        leadId: input.leadId,
        type: "system",
        direction: "internal",
        subject: "Payment Received",
        content: "Payment marked as received. Lead moved to Paid stage.",
        sentBy: ctx.user.id,
      });
      return { success: true };
    }),
});
