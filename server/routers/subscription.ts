/**
 * subscription.ts — tRPC router for subscription data
 *
 * Exposes the current user's subscription tier and status to the frontend.
 */
import { protectedProcedure, router } from "../_core/trpc";

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
});
