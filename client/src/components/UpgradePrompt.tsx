/**
 * UpgradePrompt.tsx — Reusable feature gate component
 *
 * Shows an upgrade message when a user accesses a locked feature.
 * Props: requiredTier, featureName
 * Shows current plan, required plan, and Upgrade button.
 */
import { useSubscription, SubscriptionTier } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowUpRight } from "lucide-react";
import { useLocation } from "wouter";

interface UpgradePromptProps {
  requiredTier: SubscriptionTier;
  featureName: string;
  /** Optional description of what the feature does */
  description?: string;
  /** If true, renders inline (no card wrapper) */
  inline?: boolean;
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  agency: "Agency",
};

export function UpgradePrompt({
  requiredTier,
  featureName,
  description,
  inline = false,
}: UpgradePromptProps) {
  const { tier: currentTier } = useSubscription();
  const [, navigate] = useLocation();

  const content = (
    <div className="flex flex-col items-center text-center gap-4 py-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Lock className="h-7 w-7" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">
          {featureName} requires an upgrade
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Current plan:</span>
          <Badge variant="outline">{TIER_LABELS[currentTier]}</Badge>
        </div>
        <span className="text-muted-foreground">&rarr;</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Required:</span>
          <Badge className="bg-primary/10 text-primary border-primary/30">
            {TIER_LABELS[requiredTier]}
          </Badge>
        </div>
      </div>

      <Button
        onClick={() => navigate("/pricing")}
        className="mt-2"
      >
        <ArrowUpRight className="h-4 w-4 mr-2" />
        Upgrade to {TIER_LABELS[requiredTier]}
      </Button>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <Card className="max-w-lg mx-auto mt-8 border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-0">
        <CardTitle className="sr-only">Upgrade Required</CardTitle>
        <CardDescription className="sr-only">
          This feature requires a higher subscription tier
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
