import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAuthToken } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 — Account Info
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  confirmPassword: string;
  // Step 2 — Business Details
  phone: string;
  city: string;
  state: string;
  website: string;
  hearAboutUs: string;
  // Step 3 — Plan
  plan: "Starter" | "Pro" | "Max" | "";
}

const INITIAL_FORM: FormData = {
  businessName: "",
  ownerName: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  city: "",
  state: "",
  website: "",
  hearAboutUs: "",
  plan: "",
};

// ─── Pricing data ─────────────────────────────────────────────────────────────

const plans = [
  {
    name: "Starter" as const,
    price: "$97",
    period: "/mo",
    description: "Perfect for solo painters just getting started.",
    features: [
      "1 user seat",
      "Unlimited leads & pipeline",
      "Professional invoicing",
      "Stripe payment collection",
      "Customer portal",
      "Email notifications",
    ],
    highlight: false,
  },
  {
    name: "Pro" as const,
    price: "$197",
    period: "/mo",
    description: "The most popular plan for growing painting businesses.",
    features: [
      "Up to 5 user seats",
      "Everything in Starter",
      "SMS automation (Twilio)",
      "Job scheduling & crew",
      "Google review requests",
      "Photo gallery",
    ],
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Max" as const,
    price: "$397",
    period: "/mo",
    description: "For established companies that want every advantage.",
    features: [
      "Unlimited user seats",
      "Everything in Pro",
      "White-label branding",
      "AI assistant",
      "Priority support",
      "API access",
    ],
    highlight: false,
  },
];

const hearAboutOptions = [
  "Google Search",
  "Facebook / Instagram",
  "Referral from another painter",
  "YouTube",
  "Trade show / event",
  "Email / newsletter",
  "Other",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

// ─── Step labels ──────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Account" },
  { number: 2, label: "Business" },
  { number: 3, label: "Plan" },
  { number: 4, label: "Done" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Signup() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  // ── Validation per step ────────────────────────────────────────────────────

  function validateStep1(): string | null {
    if (!form.businessName.trim()) return "Business name is required.";
    if (!form.ownerName.trim()) return "Owner full name is required.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return "A valid email address is required.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    return null;
  }

  function validateStep2(): string | null {
    if (!form.phone.trim()) return "Phone number is required.";
    if (!form.city.trim()) return "City is required.";
    if (!form.state) return "State is required.";
    return null;
  }

  function validateStep3(): string | null {
    if (!form.plan) return "Please select a plan to continue.";
    return null;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function handleNext() {
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    else if (step === 2) err = validateStep2();
    else if (step === 3) err = validateStep3();

    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  }

  function handleBack() {
    setError(null);
    setStep((s) => s - 1);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          ownerName: form.ownerName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          city: form.city.trim(),
          state: form.state,
          website: form.website.trim() || undefined,
          hearAboutUs: form.hearAboutUs || undefined,
          plan: form.plan || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }
      setAuthToken(data.token);
      await utils.auth.me.invalidate();
      // Redirect new users to the onboarding flow
      setLocation("/onboarding");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Progress bar ───────────────────────────────────────────────────────────

  const progressPct = step === 4 ? 100 : ((step - 1) / 3) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <span className="font-bold text-xl text-gray-900">PaintersMax</span>
          </Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
            Already have an account? <span className="font-semibold text-blue-600">Log in</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {/* Progress steps */}
          {step < 4 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                {STEPS.map((s) => (
                  <div key={s.number} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        step > s.number
                          ? "bg-blue-600 text-white"
                          : step === s.number
                          ? "bg-blue-600 text-white ring-4 ring-blue-100"
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {step > s.number ? "✓" : s.number}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        step >= s.number ? "text-blue-600" : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

            {/* ── Step 1: Account Info ──────────────────────────────────────── */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
                <p className="text-gray-500 text-sm mb-6">Start your 14-day free trial — no credit card required.</p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="businessName"
                      placeholder="ABC Painting Co."
                      value={form.businessName}
                      onChange={(e) => update("businessName", e.target.value)}
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="ownerName">Owner Full Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="ownerName"
                      placeholder="John Smith"
                      value={form.ownerName}
                      onChange={(e) => update("ownerName", e.target.value)}
                      className="mt-1"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@abcpainting.com"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className="mt-1"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      className="mt-1"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repeat your password"
                      value={form.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      className="mt-1"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Business Details ──────────────────────────────────── */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Tell us about your business</h2>
                <p className="text-gray-500 text-sm mb-6">This helps us personalize your experience.</p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(214) 555-1234"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className="mt-1"
                      autoComplete="tel"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                      <Input
                        id="city"
                        placeholder="Dallas"
                        value={form.city}
                        onChange={(e) => update("city", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
                      <select
                        id="state"
                        value={form.state}
                        onChange={(e) => update("state", e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select state</option>
                        {US_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="website">Website <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://abcpainting.com"
                      value={form.website}
                      onChange={(e) => update("website", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hearAboutUs">How did you hear about us?</Label>
                    <select
                      id="hearAboutUs"
                      value={form.hearAboutUs}
                      onChange={(e) => update("hearAboutUs", e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Select an option —</option>
                      {hearAboutOptions.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Choose Plan ───────────────────────────────────────── */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose your plan</h2>
                <p className="text-gray-500 text-sm mb-6">All plans include a 14-day free trial. Cancel anytime.</p>
                <div className="grid grid-cols-1 gap-4">
                  {plans.map((plan) => (
                    <button
                      key={plan.name}
                      type="button"
                      onClick={() => update("plan", plan.name)}
                      className={`relative text-left rounded-xl border-2 p-5 transition-all focus:outline-none ${
                        form.plan === plan.name
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                          : "border-gray-200 hover:border-blue-300 bg-white"
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute top-3 right-3 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                          {plan.badge}
                        </span>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              form.plan === plan.name
                                ? "border-blue-600 bg-blue-600"
                                : "border-gray-300"
                            }`}
                          >
                            {form.plan === plan.name && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <span className="font-bold text-gray-900 text-lg">{plan.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                          <span className="text-gray-400 text-sm">{plan.period}</span>
                        </div>
                      </div>
                      <p className="text-gray-500 text-sm mb-3 ml-8">{plan.description}</p>
                      <ul className="ml-8 space-y-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="text-blue-500 font-bold">✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 4: Confirmation ──────────────────────────────────────── */}
            {step === 4 && (
              <div className="text-center py-4">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome to PaintersMax!
                </h2>
                <p className="text-gray-500 mb-6">
                  Check your email to get started. Your account is ready.
                </p>

                {/* Summary */}
                <div className="bg-gray-50 rounded-xl p-5 text-left mb-8 space-y-2">
                  <h3 className="font-semibold text-gray-700 mb-3">Account Summary</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-gray-500">Business</span>
                    <span className="font-medium text-gray-900">{form.businessName}</span>
                    <span className="text-gray-500">Owner</span>
                    <span className="font-medium text-gray-900">{form.ownerName}</span>
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{form.email}</span>
                    {form.phone && (
                      <>
                        <span className="text-gray-500">Phone</span>
                        <span className="font-medium text-gray-900">{form.phone}</span>
                      </>
                    )}
                    {(form.city || form.state) && (
                      <>
                        <span className="text-gray-500">Location</span>
                        <span className="font-medium text-gray-900">
                          {[form.city, form.state].filter(Boolean).join(", ")}
                        </span>
                      </>
                    )}
                    {form.plan && (
                      <>
                        <span className="text-gray-500">Plan</span>
                        <span className="font-medium text-blue-600">{form.plan}</span>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 text-base rounded-xl"
                  onClick={() => setLocation("/dashboard")}
                >
                  Go to My Dashboard →
                </Button>
              </div>
            )}

            {/* ── Error message ─────────────────────────────────────────────── */}
            {error && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* ── Navigation buttons ────────────────────────────────────────── */}
            {step < 4 && (
              <div className={`mt-8 flex gap-3 ${step > 1 ? "justify-between" : "justify-end"}`}>
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={loading}
                    className="px-6"
                  >
                    ← Back
                  </Button>
                )}
                {step < 3 && (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    Continue →
                  </Button>
                )}
                {step === 3 && (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || !form.plan}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    {loading ? "Creating account…" : "Create My Account →"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Footer note */}
          {step < 4 && (
            <p className="text-center text-xs text-gray-400 mt-6">
              By signing up, you agree to our Terms of Service and Privacy Policy.
              <br />
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
