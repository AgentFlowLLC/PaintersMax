/**
 * shared/pricing.ts — placeholder subscription pricing (Chunk 4)
 *
 * PRICING IS NOT FINAL — per project rules, real pricing is deferred until
 * live payments go on. These are clearly-labeled placeholders; change only
 * these constants when real prices are set, nothing else needs to change.
 *
 * Tier keys match the values already stored in users.subscription_tier
 * (Drizzle: subscriptionTier) — "professional" is displayed to users as "Pro".
 */
export const PLACEHOLDER_MONTHLY_PRICE_CENTS: Record<"starter" | "professional", number> = {
  starter: 4900, // PLACEHOLDER — $49/mo
  professional: 14900, // PLACEHOLDER — $149/mo
};

export type SelfServeTier = keyof typeof PLACEHOLDER_MONTHLY_PRICE_CENTS;

export type BillingInterval = "monthly" | "annual";

// Annual price = monthly x 10 (2 months free), billed as one upfront annual charge.
// PLACEHOLDER math — revisit alongside PLACEHOLDER_MONTHLY_PRICE_CENTS.
export function getAnnualPriceCents(tier: SelfServeTier): number {
  return PLACEHOLDER_MONTHLY_PRICE_CENTS[tier] * 10;
}
