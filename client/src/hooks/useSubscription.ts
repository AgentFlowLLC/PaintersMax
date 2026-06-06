/**
 * useSubscription.ts — React hook for subscription tier access
 *
 * Reads subscription_tier from the backend for the logged-in painter.
 * Returns: tier, canAccess(feature), isStarter, isProfessional, isAgency
 */
import { trpc } from "@/lib/trpc";

export type SubscriptionTier = "free" | "starter" | "professional" | "agency";

// Feature-to-tier mapping
const FEATURE_TIER_MAP: Record<string, SubscriptionTier> = {
  // Starter features
  basic_crm: "starter",
  single_template: "starter",
  leads_50: "starter",
  email_support: "starter",
  // Professional features
  full_crm: "professional",
  all_templates: "professional",
  unlimited_leads: "professional",
  sms_alerts: "professional",
  pdf_exports: "professional",
  priority_support: "professional",
  marketing_templates: "professional",
  // Agency features
  white_label: "agency",
  custom_domain: "agency",
  ai_assistant: "agency",
  color_visualizer: "agency",
  dedicated_support: "agency",
  ai_features: "agency",
};

// Tier hierarchy for access comparison
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  agency: 3,
};

export function useSubscription() {
  const { data, isLoading, error } = trpc.subscription.getMySubscription.useQuery(
    undefined,
    {
      staleTime: 60_000, // 1 minute
      retry: false,
    }
  );

  const tier = (data?.tier ?? "free") as SubscriptionTier;
  const status = data?.status ?? "inactive";
  const trialEndsAt = data?.trialEndsAt ? new Date(data.trialEndsAt) : null;

  /**
   * Check if the current tier can access a specific feature.
   * Accepts either a feature key from FEATURE_TIER_MAP or a tier name directly.
   */
  function canAccess(featureOrTier: string): boolean {
    // If it's a tier name, compare directly
    if (featureOrTier in TIER_HIERARCHY) {
      return TIER_HIERARCHY[tier] >= TIER_HIERARCHY[featureOrTier as SubscriptionTier];
    }
    // Otherwise look up the feature in the map
    const requiredTier = FEATURE_TIER_MAP[featureOrTier];
    if (!requiredTier) return true; // Unknown features are accessible by default
    return TIER_HIERARCHY[tier] >= TIER_HIERARCHY[requiredTier];
  }

  /**
   * Get the required tier for a feature.
   */
  function getRequiredTier(feature: string): SubscriptionTier {
    if (feature in TIER_HIERARCHY) return feature as SubscriptionTier;
    return FEATURE_TIER_MAP[feature] ?? "free";
  }

  return {
    tier,
    status,
    trialEndsAt,
    isLoading,
    error,
    canAccess,
    getRequiredTier,
    isFree: tier === "free",
    isStarter: tier === "starter",
    isProfessional: tier === "professional",
    isAgency: tier === "agency",
    isActive: status === "active",
    isTrialing: trialEndsAt ? new Date() < trialEndsAt : false,
  };
}
