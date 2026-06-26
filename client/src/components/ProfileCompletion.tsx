/**
 * client/src/components/ProfileCompletion.tsx
 *
 * Profile Completion Widget — Improvement 5
 *
 * Shows a progress bar (0–100%) based on how many painter_profile fields
 * are filled in. Calculates score from:
 *   Business info complete:          +20%  (fields filled OR signup_step >= 5)
 *   Service areas added:             +20%
 *   Logo uploaded:                   +15%
 *   Website setup:                   +15%  (has_website set, or template_style/tier chosen)
 *   Chatbot name set:                +10%
 *   Plan selected (tier != 'free'):  +20%
 *
 * Only renders if onboarding_completed is false OR profile score < 100%.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getAuthToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PainterProfile {
  company_name?: string;
  phone?: string;
  business_email?: string;
  address?: string;
  service_cities?: unknown[];
  logo_url?: string;
  chatbot_name?: string;
  onboarding_completed?: boolean;
  // Chunk 1–2 signup fields
  signup_step?: number;
  has_website?: boolean | null;
  template_style?: string | null;
  template_tier?: string | null;
}

interface UserData {
  subscription_tier?: string;
}

interface SectionStatus {
  label: string;
  points: number;
  complete: boolean;
  href: string;
}

// ─── Score calculator ─────────────────────────────────────────────────────────
function calcScore(profile: PainterProfile | null, user: UserData | null): SectionStatus[] {
  const p = profile ?? {};
  const u = user ?? {};

  // True if all four core fields are filled, OR if the user has reached step 5+
  // (meaning they completed Account → Business Info → Service Areas → Brand Kit → Website Choice)
  const businessInfoComplete =
    (
      !!(p.company_name?.trim()) &&
      !!(p.phone?.trim()) &&
      !!(p.business_email?.trim()) &&
      !!(p.address?.trim())
    ) ||
    (typeof p.signup_step === "number" && p.signup_step >= 5);

  const serviceAreasAdded =
    Array.isArray(p.service_cities) && p.service_cities.length > 0;

  const logoUploaded = !!(p.logo_url?.trim());

  // True if the user completed the website-choice fork (has_website is set)
  // or selected a template style/tier — covers both the "need a site" and "keep my site" paths
  const websiteSetupComplete =
    p.has_website !== null && p.has_website !== undefined ||
    !!(p.template_style) ||
    !!(p.template_tier);

  const chatbotNameSet = !!(p.chatbot_name?.trim());

  const planSelected =
    !!(u.subscription_tier) && u.subscription_tier !== "free";

  return [
    {
      label: "Business info",
      points: 20,
      complete: businessInfoComplete,
      href: "/onboarding",
    },
    {
      label: "Service areas",
      points: 20,
      complete: serviceAreasAdded,
      href: "/onboarding",
    },
    {
      label: "Logo uploaded",
      points: 15,
      complete: logoUploaded,
      href: "/onboarding",
    },
    {
      label: "Website setup",
      points: 15,
      complete: websiteSetupComplete,
      href: "/signup",
    },
    {
      label: "AI assistant name",
      points: 10,
      complete: chatbotNameSet,
      href: "/onboarding",
    },
    {
      label: "Plan selected",
      points: 20,
      complete: planSelected,
      href: "/pricing",
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ProfileCompletion() {
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<PainterProfile | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    // Fetch onboarding status (includes profile)
    fetch("/api/onboarding/status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        setProfile(res.profile ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch user subscription tier from settings
    fetch("/api/trpc/settings.getProfile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        // tRPC response shape
        const data = res?.result?.data ?? res?.data ?? res;
        if (data?.subscription_tier) {
          setUser({ subscription_tier: data.subscription_tier });
        }
      })
      .catch(() => {});
  }, []);

  if (loading) return null;

  const sections = calcScore(profile, user);
  const score = sections.reduce((sum, s) => sum + (s.complete ? s.points : 0), 0);
  const onboardingCompleted = profile?.onboarding_completed ?? false;

  // Only show if onboarding not completed OR score < 100
  if (onboardingCompleted && score >= 100) return null;

  const incomplete = sections.filter((s) => !s.complete);

  return (
    <Card className="border shadow-sm bg-gradient-to-r from-purple-50 to-amber-50 border-purple-100">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: progress info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-gray-900">
                Complete your profile
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  score >= 80
                    ? "bg-green-100 text-green-700"
                    : score >= 50
                    ? "bg-amber-100 text-amber-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {score}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {score < 100
                ? `${100 - score}% remaining — a complete profile helps you get more leads.`
                : "Your profile is complete! 🎉"}
            </p>

            {/* Progress bar */}
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${score}%`,
                  background:
                    score >= 80
                      ? "#10b981"
                      : score >= 50
                      ? "#f59e0b"
                      : "#7c3aed",
                }}
              />
            </div>

            {/* Section checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
              {sections.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      s.complete
                        ? "bg-green-500"
                        : "bg-gray-200"
                    }`}
                  >
                    {s.complete ? (
                      <span className="text-white text-[9px] font-bold">✓</span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">○</span>
                    )}
                  </div>
                  <span
                    className={`text-xs ${
                      s.complete ? "text-gray-500 line-through" : "text-gray-700 font-medium"
                    }`}
                  >
                    {s.label}
                  </span>
                  {!s.complete && (
                    <span className="text-[10px] text-purple-500 font-semibold">
                      +{s.points}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: CTA */}
          {incomplete.length > 0 && (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4 whitespace-nowrap"
                onClick={() => setLocation(incomplete[0].href)}
              >
                Complete now →
              </Button>
              {incomplete.length > 1 && (
                <p className="text-[10px] text-gray-400 text-center">
                  {incomplete.length} items remaining
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
