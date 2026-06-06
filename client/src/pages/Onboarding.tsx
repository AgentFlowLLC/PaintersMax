/**
 * client/src/pages/Onboarding.tsx
 *
 * Self-serve onboarding flow for new PaintersMax painting company clients.
 * 6 steps with progress bar:
 *   1. Welcome
 *   2. Business Info
 *   3. Service Areas
 *   4. Brand Kit
 *   5. Choose Plan
 *   6. Done (confetti + welcome email)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getAuthToken } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingData {
  // Step 2 — Business Info
  company_name: string;
  phone: string;
  business_email: string;
  website: string;
  address: string;
  years_in_business: string;
  license_number: string;
  insurance_carrier: string;
  // Step 3 — Service Areas
  service_cities: string[];
  custom_city: string;
  service_radius: number;
  // Step 4 — Brand Kit
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  tagline: string;
}

const INITIAL_DATA: OnboardingData = {
  company_name: "",
  phone: "",
  business_email: "",
  website: "",
  address: "",
  years_in_business: "",
  license_number: "",
  insurance_carrier: "",
  service_cities: [],
  custom_city: "",
  service_radius: 25,
  logo_url: "",
  primary_color: "#7c3aed",
  secondary_color: "#f59e0b",
  tagline: "",
};

const DFW_CITIES = [
  "Dallas", "Fort Worth", "Plano", "Frisco", "McKinney", "Allen",
  "Arlington", "Garland", "Irving", "Mesquite", "Grand Prairie",
  "Carrollton", "Richardson", "Denton", "Lewisville", "Flower Mound",
  "Grapevine", "Southlake", "Keller", "Mansfield",
];

const RADIUS_OPTIONS = [10, 25, 50];

const TOTAL_STEPS = 6;

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-purple-700">
          Step {step} of {TOTAL_STEPS}
        </span>
        <span className="text-sm text-gray-500">
          {Math.round((step / TOTAL_STEPS) * 100)}% complete
        </span>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-600 rounded-full transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all duration-300 ${
              i + 1 < step
                ? "bg-purple-600 border-purple-600 text-white"
                : i + 1 === step
                ? "bg-white border-purple-600 text-purple-600"
                : "bg-white border-gray-300 text-gray-400"
            }`}
          >
            {i + 1 < step ? "✓" : i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];
    const particles: {
      x: number; y: number; r: number;
      color: string; vx: number; vy: number;
      alpha: number; rotation: number; rotationSpeed: number;
    }[] = [];

    for (let i = 0; i < 180; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 4 + 2,
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height) {
          p.alpha -= 0.02;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
        ctx.restore();
      });
      if (particles.some((p) => p.alpha > 0)) {
        animId = requestAnimationFrame(animate);
      }
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiPost(path: string, body: Record<string, unknown>) {
  const token = getAuthToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function uploadLogo(file: File): Promise<string | null> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append("logo", file);
  const res = await fetch("/api/onboarding/upload-logo", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  return data.url ?? null;
}

// ─── Main Onboarding Component ────────────────────────────────────────────────
export default function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [statusChecked, setStatusChecked] = useState(false);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check onboarding status on mount: skip to /dashboard if already completed,
  // redirect to /login if not authenticated
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate("/login");
      return;
    }
    fetch("/api/onboarding/status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.completed) {
          navigate("/dashboard");
        } else {
          setStatusChecked(true);
        }
      })
      .catch(() => {
        // If status check fails, still show onboarding
        setStatusChecked(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (field: keyof OnboardingData, value: OnboardingData[keyof OnboardingData]) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const toggleCity = (city: string) => {
    setData((prev) => {
      const cities = prev.service_cities.includes(city)
        ? prev.service_cities.filter((c) => c !== city)
        : [...prev.service_cities, city];
      return { ...prev, service_cities: cities };
    });
  };

  const addCustomCity = () => {
    const city = data.custom_city.trim();
    if (!city || data.service_cities.includes(city)) return;
    setData((prev) => ({
      ...prev,
      service_cities: [...prev.service_cities, city],
      custom_city: "",
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Save progress to API (non-blocking, best-effort)
  const saveProgress = useCallback(
    async (overrides?: Partial<OnboardingData>) => {
      const payload = { ...data, ...overrides };
      try {
        await apiPost("/api/onboarding/save", {
          company_name: payload.company_name,
          phone: payload.phone,
          business_email: payload.business_email,
          website: payload.website || null,
          address: payload.address,
          years_in_business: payload.years_in_business
            ? parseInt(payload.years_in_business, 10)
            : null,
          license_number: payload.license_number || null,
          insurance_carrier: payload.insurance_carrier || null,
          service_cities: payload.service_cities,
          service_radius: payload.service_radius,
          logo_url: payload.logo_url || null,
          primary_color: payload.primary_color || null,
          secondary_color: payload.secondary_color || null,
          tagline: payload.tagline || null,
        });
      } catch (err) {
        console.warn("[Onboarding] save error (non-fatal):", err);
      }
    },
    [data]
  );

  const goNext = async () => {
    setError(null);
    setSaving(true);
    try {
      // Step 2 validation
      if (step === 2) {
        if (!data.company_name.trim()) return setError("Company name is required.");
        if (!data.phone.trim()) return setError("Phone number is required.");
        if (!data.business_email.trim()) return setError("Business email is required.");
        if (!data.address.trim()) return setError("Business address is required.");
        await saveProgress();
      }
      // Step 3 — save service areas
      if (step === 3) {
        await saveProgress();
      }
      // Step 4 — upload logo if selected, then save brand kit
      if (step === 4) {
        let logoUrl = data.logo_url;
        if (logoFile) {
          const uploaded = await uploadLogo(logoFile);
          if (uploaded) {
            logoUrl = uploaded;
            setData((prev) => ({ ...prev, logo_url: uploaded }));
          }
        }
        await saveProgress({ logo_url: logoUrl });
      }
      // Step 6 — complete onboarding
      if (step === 5) {
        // Just advance to step 6 (plan selection is handled by /pricing redirect)
      }
      setStep((s) => s + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await apiPost("/api/onboarding/complete", {
        business_email: data.business_email,
        company_name: data.company_name,
      });
      setShowConfetti(true);
      setTimeout(() => navigate("/dashboard"), 4500);
    } catch (err) {
      console.error("[Onboarding] complete error:", err);
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!statusChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 flex flex-col items-center justify-center p-4">
      {showConfetti && <Confetti />}

      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-lg font-bold text-gray-900">PaintersMax</span>
        </div>

        {/* Progress bar (shown on steps 1–6) */}
        <ProgressBar step={step} />

        {/* ── STEP 1 — Welcome ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">🎨</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Welcome to PaintersMax!
            </h1>
            <p className="text-lg text-gray-600 mb-2">
              Let's set up your account in 5 minutes
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              We'll walk you through your business info, service areas, brand kit,
              and plan selection — so you can start winning more jobs right away.
            </p>
            <Button
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white px-10 py-3 text-base font-semibold rounded-xl"
              onClick={() => setStep(2)}
            >
              Get Started →
            </Button>
          </div>
        )}

        {/* ── STEP 2 — Business Info ───────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Business Info</h2>
            <p className="text-gray-500 mb-6 text-sm">Tell us about your painting company.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={data.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="DFW Pro Painters LLC"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={data.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="(214) 555-0100"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="business_email">Business Email *</Label>
                <Input
                  id="business_email"
                  type="email"
                  value={data.business_email}
                  onChange={(e) => update("business_email", e.target.value)}
                  placeholder="hello@yourcompany.com"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Business Address *</Label>
                <Input
                  id="address"
                  value={data.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="123 Main St, Dallas, TX 75201"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="website">Website URL (optional)</Label>
                <Input
                  id="website"
                  type="url"
                  value={data.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="years_in_business">Years in Business</Label>
                <Input
                  id="years_in_business"
                  type="number"
                  min="0"
                  value={data.years_in_business}
                  onChange={(e) => update("years_in_business", e.target.value)}
                  placeholder="5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  value={data.license_number}
                  onChange={(e) => update("license_number", e.target.value)}
                  placeholder="TX-12345"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="insurance_carrier">Insurance Carrier</Label>
                <Input
                  id="insurance_carrier"
                  value={data.insurance_carrier}
                  onChange={(e) => update("insurance_carrier", e.target.value)}
                  placeholder="State Farm"
                  className="mt-1"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end mt-6">
              <Button
                onClick={goNext}
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-2 rounded-xl font-semibold"
              >
                {saving ? "Saving…" : "Continue →"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Service Areas ───────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Service Areas</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Select the DFW cities you serve. You can add custom cities too.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {DFW_CITIES.map((city) => (
                <label
                  key={city}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                    data.service_cities.includes(city)
                      ? "bg-purple-50 border-purple-400 text-purple-800 font-medium"
                      : "bg-white border-gray-200 text-gray-700 hover:border-purple-300"
                  }`}
                >
                  <Checkbox
                    checked={data.service_cities.includes(city)}
                    onCheckedChange={() => toggleCity(city)}
                    className="border-gray-400"
                  />
                  {city}
                </label>
              ))}
            </div>

            {/* Custom city */}
            <div className="flex gap-2 mb-6">
              <Input
                value={data.custom_city}
                onChange={(e) => update("custom_city", e.target.value)}
                placeholder="Add a custom city…"
                onKeyDown={(e) => e.key === "Enter" && addCustomCity()}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={addCustomCity}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                Add
              </Button>
            </div>

            {/* Custom cities chips */}
            {data.service_cities.filter((c) => !DFW_CITIES.includes(c)).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {data.service_cities
                  .filter((c) => !DFW_CITIES.includes(c))
                  .map((city) => (
                    <span
                      key={city}
                      className="flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1 rounded-full"
                    >
                      {city}
                      <button
                        onClick={() => toggleCity(city)}
                        className="ml-1 text-amber-600 hover:text-amber-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}

            {/* Radius selector */}
            <div className="mb-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Service Radius from Business Address
              </Label>
              <div className="flex gap-3">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => update("service_radius", r)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                      data.service_radius === r
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-purple-300"
                    }`}
                  >
                    {r} miles
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(2)} className="text-gray-500">
                ← Back
              </Button>
              <Button
                onClick={goNext}
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-2 rounded-xl font-semibold"
              >
                {saving ? "Saving…" : "Continue →"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4 — Brand Kit ───────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Brand Kit</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Upload your logo and set your brand colors. See a live preview of your chatbot widget.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: inputs */}
              <div className="space-y-4">
                {/* Logo upload */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">
                    Company Logo
                  </Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 transition-colors min-h-[100px]"
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="max-h-16 max-w-full object-contain"
                      />
                    ) : (
                      <>
                        <span className="text-3xl mb-1">🖼️</span>
                        <span className="text-sm text-gray-500">Click to upload logo</span>
                        <span className="text-xs text-gray-400 mt-1">PNG, JPG, WebP — max 5MB</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </div>

                {/* Primary color */}
                <div>
                  <Label htmlFor="primary_color" className="text-sm font-medium text-gray-700 mb-1 block">
                    Primary Color
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={data.primary_color}
                      onChange={(e) => update("primary_color", e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                    />
                    <Input
                      id="primary_color"
                      value={data.primary_color}
                      onChange={(e) => update("primary_color", e.target.value)}
                      placeholder="#7c3aed"
                      className="flex-1 font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Secondary color */}
                <div>
                  <Label htmlFor="secondary_color" className="text-sm font-medium text-gray-700 mb-1 block">
                    Secondary Color
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={data.secondary_color}
                      onChange={(e) => update("secondary_color", e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                    />
                    <Input
                      id="secondary_color"
                      value={data.secondary_color}
                      onChange={(e) => update("secondary_color", e.target.value)}
                      placeholder="#f59e0b"
                      className="flex-1 font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Tagline */}
                <div>
                  <Label htmlFor="tagline" className="text-sm font-medium text-gray-700 mb-1 block">
                    Tagline / Slogan
                  </Label>
                  <Input
                    id="tagline"
                    value={data.tagline}
                    onChange={(e) => update("tagline", e.target.value)}
                    placeholder="Quality Painting, Guaranteed."
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Right: live preview */}
              <div className="flex flex-col items-center justify-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Live Widget Preview
                </p>
                <div className="relative w-64">
                  {/* Chat bubble */}
                  <div
                    className="rounded-2xl shadow-lg overflow-hidden"
                    style={{ background: "#fff", border: `2px solid ${data.primary_color}` }}
                  >
                    {/* Header */}
                    <div
                      className="px-4 py-3 flex items-center gap-3"
                      style={{ background: data.primary_color }}
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="w-8 h-8 rounded-full object-cover bg-white"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">P</span>
                        </div>
                      )}
                      <div>
                        <p className="text-white text-sm font-semibold leading-tight">
                          {data.company_name || "Your Company"}
                        </p>
                        {data.tagline && (
                          <p className="text-white/80 text-xs leading-tight">{data.tagline}</p>
                        )}
                      </div>
                    </div>
                    {/* Chat area */}
                    <div className="px-4 py-3 space-y-2">
                      <div
                        className="rounded-xl rounded-tl-none px-3 py-2 text-xs text-white max-w-[80%]"
                        style={{ background: data.primary_color }}
                      >
                        Hi! 👋 How can we help you today?
                      </div>
                      <div
                        className="rounded-xl rounded-tr-none px-3 py-2 text-xs text-white ml-auto max-w-[80%]"
                        style={{ background: data.secondary_color }}
                      >
                        I need a quote for interior painting.
                      </div>
                    </div>
                    {/* Input area */}
                    <div className="px-3 pb-3">
                      <div
                        className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                        style={{ borderColor: data.primary_color + "44" }}
                      >
                        <span className="text-xs text-gray-400 flex-1">Type a message…</span>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: data.secondary_color }}
                        >
                          <span className="text-white text-xs">→</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Floating button */}
                  <div
                    className="absolute -bottom-4 -right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
                    style={{ background: data.primary_color }}
                  >
                    <span className="text-white text-xl">💬</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="ghost" onClick={() => setStep(3)} className="text-gray-500">
                ← Back
              </Button>
              <Button
                onClick={goNext}
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-2 rounded-xl font-semibold"
              >
                {saving ? "Uploading…" : "Continue →"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 5 — Choose Plan ─────────────────────────────────────── */}
        {step === 5 && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Almost done!</h2>
            <p className="text-gray-600 mb-2 text-base">
              Choose your plan to activate your account.
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              You'll be redirected to our pricing page. After selecting a plan, you can
              return here to complete your setup.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-base font-semibold rounded-xl"
                onClick={() => {
                  // Save progress before redirecting
                  saveProgress();
                  window.location.href = "/pricing";
                }}
              >
                View Plans & Pricing →
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-gray-300 text-gray-600 hover:bg-gray-50 px-8 py-3 rounded-xl"
                onClick={() => setStep(6)}
              >
                Skip for now
              </Button>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              You can return to complete onboarding after selecting a plan.
            </p>

            <div className="flex justify-start mt-6">
              <Button variant="ghost" onClick={() => setStep(4)} className="text-gray-500">
                ← Back
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 6 — Done ───────────────────────────────────────────── */}
        {step === 6 && (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              You're all set!
            </h2>
            <p className="text-lg text-gray-700 mb-2 font-medium">
              Your account is being configured.
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              You'll receive a welcome email within 24 hours with your login details and next steps.
            </p>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-8 max-w-sm mx-auto text-left">
              <p className="text-sm font-semibold text-purple-800 mb-1">What's next?</p>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>✓ Check your inbox for a welcome email</li>
                <li>✓ Explore your new dashboard</li>
                <li>✓ Add your first lead to the pipeline</li>
              </ul>
            </div>

            <Button
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white px-10 py-3 text-base font-semibold rounded-xl"
              onClick={handleComplete}
              disabled={saving}
            >
              {saving ? "Setting up…" : "Go to Dashboard →"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
