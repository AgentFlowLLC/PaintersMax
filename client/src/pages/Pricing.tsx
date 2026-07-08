/**
 * Pricing.tsx — Subscription pricing page at /pricing
 *
 * Displays 3 tier cards: Starter, Pro, Max
 * - Starter/Pro are self-serve with a monthly/annual toggle. Prices are
 *   PLACEHOLDER values from shared/pricing.ts — not final.
 * - Max is not self-serve — it routes to a Calendly discovery call.
 * - Annual billing requires reading and agreeing to a dedicated contract
 *   disclosure screen before the Stripe redirect fires.
 * - Subscribe creates a Stripe Checkout session via trpc.subscription.createCheckoutSession.
 * - "Current Plan" badge on active tier.
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Rocket, Building2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  PLACEHOLDER_MONTHLY_PRICE_CENTS,
  getAnnualPriceCents,
  type SelfServeTier,
  type BillingInterval,
} from "@shared/pricing";

// PLACEHOLDER — replace once the Calendly account for Max-tier discovery
// calls is set up (see SKILL-paintersmax.md backlog).
const MAX_TIER_CALENDLY_URL = "https://calendly.com/paintersmax/discovery-call";

interface TierCard {
  id: SelfServeTier | "agency";
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  highlight?: boolean;
  selfServe: boolean;
}

const TIERS: TierCard[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for solo painters getting started with digital tools",
    icon: <Rocket className="h-6 w-6" />,
    features: [
      "Basic CRM functionality",
      "1 marketing template",
      "Up to 50 leads/month",
      "Email support",
    ],
    selfServe: true,
  },
  {
    id: "professional",
    name: "Pro",
    description: "For growing painting businesses that need the full toolkit",
    icon: <Crown className="h-6 w-6" />,
    features: [
      "Full CRM with pipeline",
      "All marketing templates",
      "Unlimited leads",
      "SMS alerts & automation",
      "PDF invoice exports",
      "Priority support",
    ],
    highlight: true,
    selfServe: true,
  },
  {
    id: "agency",
    name: "Max",
    description: "Enterprise-grade tools for multi-crew painting companies",
    icon: <Building2 className="h-6 w-6" />,
    features: [
      "Everything in Pro",
      "White-label branding",
      "Custom domain support",
      "AI assistant",
      "Dedicated support",
    ],
    selfServe: false,
  },
];

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });
}

function formatRenewalDate(): string {
  const renewal = new Date();
  renewal.setFullYear(renewal.getFullYear() + 1);
  return renewal.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function Pricing() {
  const { user } = useAuth();
  const { tier: currentTier, isLoading: subLoading } = useSubscription();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [pendingAnnualTier, setPendingAnnualTier] = useState<SelfServeTier | null>(null);
  const [annualAgreed, setAnnualAgreed] = useState(false);

  const createCheckoutSession = trpc.subscription.createCheckoutSession.useMutation();

  async function startCheckout(tier: SelfServeTier, interval: BillingInterval) {
    if (!user) {
      toast.error("Please log in to subscribe");
      return;
    }

    setLoadingTier(tier);
    try {
      const data = await createCheckoutSession.mutateAsync({ tier, billingInterval: interval });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoadingTier(null);
    }
  }

  function handleSubscribe(tier: SelfServeTier) {
    if (billingInterval === "annual") {
      setAnnualAgreed(false);
      setPendingAnnualTier(tier);
      return;
    }
    void startCheckout(tier, "monthly");
  }

  // ── Dedicated annual contract disclosure screen ──────────────────────────
  if (pendingAnnualTier) {
    const tier = pendingAnnualTier;
    const tierLabel = tier === "starter" ? "Starter" : "Pro";
    const annualTotal = formatPrice(getAnnualPriceCents(tier));

    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6"
          onClick={() => setPendingAnnualTier(null)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to plans
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">You're signing up for an Annual Plan</CardTitle>
            <CardDescription>{tierLabel} plan — billed annually</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm">
              <li>
                You'll be billed <strong>${annualTotal} upfront</strong> for 12 months.
              </li>
              <li>This plan cannot be cancelled or refunded early.</li>
              <li>
                You can upgrade anytime, but cannot downgrade or cancel until your 12-month term
                ends.
              </li>
              <li>
                Your renewal date will be <strong>{formatRenewalDate()}</strong>.
              </li>
            </ul>

            <div className="flex items-start gap-2 pt-2 border-t">
              <Checkbox
                id="annual-agree"
                checked={annualAgreed}
                onCheckedChange={(checked) => setAnnualAgreed(checked === true)}
              />
              <label htmlFor="annual-agree" className="text-sm leading-tight cursor-pointer">
                I understand and agree to the 12-month commitment
              </label>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              disabled={!annualAgreed || loadingTier === tier}
              onClick={() => void startCheckout(tier, "annual")}
            >
              {loadingTier === tier ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue to Payment →
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground text-lg">
          Scale your painting business with the right tools for your stage
        </p>
      </div>

      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-lg border p-1 bg-muted/50">
          <Button
            variant={billingInterval === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingInterval("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={billingInterval === "annual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingInterval("annual")}
          >
            Annual (2 months free)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {TIERS.map((tierCard) => {
          const isCurrentPlan = currentTier === tierCard.id;
          const tierOrder = ["free", "starter", "professional", "agency"];
          const isHigher = tierOrder.indexOf(tierCard.id) > tierOrder.indexOf(currentTier);

          const priceCents = tierCard.selfServe
            ? billingInterval === "annual"
              ? getAnnualPriceCents(tierCard.id as SelfServeTier)
              : PLACEHOLDER_MONTHLY_PRICE_CENTS[tierCard.id as SelfServeTier]
            : null;

          return (
            <Card
              key={tierCard.id}
              className={`relative flex flex-col ${
                tierCard.highlight
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : ""
              }`}
            >
              {tierCard.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {tierCard.icon}
                </div>
                <CardTitle className="text-xl">{tierCard.name}</CardTitle>
                <CardDescription className="text-sm">
                  {tierCard.description}
                </CardDescription>
                {priceCents !== null && (
                  <p className="text-2xl font-bold pt-2">
                    ${formatPrice(priceCents)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {billingInterval === "annual" ? "/year" : "/mo"}
                    </span>
                  </p>
                )}
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2.5">
                  {tierCard.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                {!tierCard.selfServe ? (
                  <Button asChild className="w-full" variant="outline">
                    <a href={MAX_TIER_CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                      Book a Discovery Call
                    </a>
                  </Button>
                ) : isCurrentPlan ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : isHigher ? (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(tierCard.id as SelfServeTier)}
                    disabled={loadingTier === tierCard.id || subLoading}
                  >
                    {loadingTier === tierCard.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Subscribe
                  </Button>
                ) : (
                  <Button variant="ghost" className="w-full" disabled>
                    Included in your plan
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
