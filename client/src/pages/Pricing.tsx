/**
 * Pricing.tsx — Subscription pricing page at /pricing
 *
 * Displays 3 tier cards: Starter, Professional, Agency
 * - No hardcoded prices — prices are managed in Stripe dashboard only
 * - Subscribe button calls /api/create-checkout
 * - "Current Plan" badge on active tier
 * - "Manage Subscription" button calls /api/create-portal-session
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription, SubscriptionTier } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Rocket, Building2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TierCard {
  id: SubscriptionTier;
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  highlight?: boolean;
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
      "14-day free trial",
    ],
  },
  {
    id: "professional",
    name: "Professional",
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
  },
  {
    id: "agency",
    name: "Agency",
    description: "Enterprise-grade tools for multi-crew painting companies",
    icon: <Building2 className="h-6 w-6" />,
    features: [
      "Everything in Professional",
      "White-label branding",
      "Custom domain support",
      "AI assistant",
      "fal.ai color visualizer",
      "Dedicated support",
    ],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const { tier: currentTier, isLoading: subLoading } = useSubscription();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleSubscribe(tier: string) {
    if (!user) {
      toast.error("Please log in to subscribe");
      return;
    }

    setLoadingTier(tier);
    try {
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          painter_id: user.id,
          tier,
          email: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoadingTier(null);
    }
  }

  async function handleManageSubscription() {
    if (!user) return;

    setPortalLoading(true);
    try {
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ painter_id: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create portal session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground text-lg">
          Scale your painting business with the right tools for your stage
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {TIERS.map((tierCard) => {
          const isCurrentPlan = currentTier === tierCard.id;
          const isHigher =
            ["starter", "professional", "agency"].indexOf(tierCard.id) >
            ["free", "starter", "professional", "agency"].indexOf(currentTier);

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
                {isCurrentPlan ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Manage Subscription
                  </Button>
                ) : isHigher ? (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(tierCard.id)}
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

      {/* Manage subscription section for users with active plans */}
      {currentTier !== "free" && (
        <div className="text-center border-t pt-6">
          <p className="text-sm text-muted-foreground mb-3">
            Need to update your payment method or cancel?
          </p>
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={portalLoading}
          >
            {portalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Manage Subscription in Stripe
          </Button>
        </div>
      )}
    </div>
  );
}
