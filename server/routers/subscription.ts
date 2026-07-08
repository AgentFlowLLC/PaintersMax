/**
 * subscription.ts — tRPC router for subscription data
 *
 * Exposes the current user's subscription tier and status to the frontend,
 * and creates Stripe Checkout sessions for the self-serve tiers (Starter, Pro).
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { PLACEHOLDER_MONTHLY_PRICE_CENTS, getAnnualPriceCents } from "@shared/pricing";

export const subscriptionRouter = router({
  /**
   * Get the current user's subscription info.
   * Returns tier, status, trial end date, and stripe customer ID.
   */
  getMySubscription: protectedProcedure.query(({ ctx }) => {
    const user = ctx.user;
    return {
      tier: (user as any).subscriptionTier ?? "free",
      status: (user as any).subscriptionStatus ?? "inactive",
      trialEndsAt: (user as any).trialEndsAt ?? null,
      stripeCustomerId: (user as any).stripeCustomerId ?? null,
    };
  }),

  /**
   * Create a Stripe Checkout session for the Starter or Pro tier, monthly or
   * annual billing. Uses inline price_data (no pre-created Stripe Price
   * objects) so placeholder prices can change without touching Stripe config.
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["starter", "professional"]),
        billingInterval: z.enum(["monthly", "annual"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ENV.stripeSecretKey) {
        throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(ENV.stripeSecretKey);

      const tier = input.tier;
      const unitAmount =
        input.billingInterval === "annual"
          ? getAnnualPriceCents(tier)
          : PLACEHOLDER_MONTHLY_PRICE_CENTS[tier];
      const interval = input.billingInterval === "annual" ? "year" : "month";
      const tierLabel = tier === "starter" ? "Starter" : "Pro";

      const painterId = String(ctx.user.id);
      const appUrl = ENV.appUrl || "http://localhost:5173";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: ctx.user.email ?? undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              recurring: { interval },
              unit_amount: unitAmount,
              product_data: {
                name: `PaintersMax ${tierLabel} Plan (${input.billingInterval})`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/dashboard?checkout=success`,
        cancel_url: `${appUrl}/pricing?checkout=cancelled`,
        metadata: { painter_id: painterId, tier, billingInterval: input.billingInterval },
        subscription_data: {
          metadata: { painter_id: painterId, tier, billingInterval: input.billingInterval },
        },
      });

      return { url: session.url };
    }),
});
