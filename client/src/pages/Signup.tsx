import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAuthToken, getAuthToken } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceCity {
  city: string;
  state: string;
  radius: number;
}

interface SignupForm {
  // Step 1
  email: string;
  password: string;
  confirmPassword: string;
  // Step 2
  companyName: string;
  phone: string;
  businessEmail: string;
  address: string;
  website: string;
  yearsInBusiness: string;
  licenseNumber: string;
  insuranceCarrier: string;
  // Step 3
  serviceCities: ServiceCity[];
  serviceRadius: number;
  // Step 4
  chatbotName: string;
  chatbotAvatar: string;
  logoUrl: string;
  // Step 5
  hasWebsite: boolean | null;
  templateStyle: string | null;
  templateTier: string;
}

const INITIAL_FORM: SignupForm = {
  email: "",
  password: "",
  confirmPassword: "",
  companyName: "",
  phone: "",
  businessEmail: "",
  address: "",
  website: "",
  yearsInBusiness: "",
  licenseNumber: "",
  insuranceCarrier: "",
  serviceCities: [],
  serviceRadius: 25,
  chatbotName: "",
  chatbotAvatar: "avatar_1",
  logoUrl: "",
  hasWebsite: null,
  templateStyle: null,
  templateTier: "",
};

const RADIUS_OPTIONS = [10, 25, 50, 100];

const STEPS = [
  { number: 1, label: "Account" },
  { number: 2, label: "Business" },
  { number: 3, label: "Service Areas" },
  { number: 4, label: "Brand Kit" },
];

// ─── Google Places Autocomplete Hook ──────────────────────────────────────────
// Dynamically loads the Maps script and wires a city autocomplete to the input ref.

function usePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onSelect: (city: string, state: string) => void
) {
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;

    const init = () => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["(cities)"],
        componentRestrictions: { country: "us" },
        fields: ["address_components", "name"],
      });
      acRef.current = ac;
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.address_components) return;
        let city = "";
        let state = "";
        for (const comp of place.address_components) {
          if (comp.types.includes("locality")) city = comp.long_name;
          if (comp.types.includes("administrative_area_level_1")) state = comp.short_name;
        }
        if (!city && place.name) city = place.name;
        if (city) onSelect(city, state);
        if (inputRef.current) inputRef.current.value = "";
      });
    };

    if (window.google?.maps?.places) {
      init();
    } else {
      const scriptId = "google-places-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.onload = init;
        document.head.appendChild(script);
      } else {
        (document.getElementById(scriptId) as HTMLScriptElement).addEventListener("load", init);
      }
    }

    return () => {
      if (acRef.current) window.google?.maps?.event?.clearInstanceListeners(acRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── Painting-themed SVG Avatars ──────────────────────────────────────────────

const AVATAR_OPTIONS = [
  {
    id: "avatar_1",
    label: "Painter Pete",
    svg: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="32" cy="32" r="32" fill="#ddd6fe" />
        <circle cx="32" cy="24" r="10" fill="#7c3aed" />
        <ellipse cx="32" cy="50" rx="14" ry="10" fill="#7c3aed" />
        <rect x="22" y="14" width="20" height="5" rx="2" fill="#f59e0b" />
        <rect x="26" y="10" width="12" height="5" rx="2" fill="#f59e0b" />
        <rect x="44" y="30" width="3" height="14" rx="1" fill="#92400e" />
        <rect x="43" y="42" width="5" height="4" rx="1" fill="#7c3aed" />
      </svg>
    ),
  },
  {
    id: "avatar_2",
    label: "Iris",
    svg: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="32" cy="32" r="32" fill="#fde68a" />
        <circle cx="32" cy="24" r="10" fill="#d97706" />
        <ellipse cx="32" cy="50" rx="14" ry="10" fill="#d97706" />
        <ellipse cx="44" cy="36" rx="7" ry="5" fill="#fff" stroke="#d97706" strokeWidth="1.5" />
        <circle cx="42" cy="35" r="1.5" fill="#7c3aed" />
        <circle cx="45" cy="34" r="1.5" fill="#ef4444" />
        <circle cx="46" cy="37" r="1.5" fill="#10b981" />
        <path d="M22 22 Q32 10 42 22" stroke="#92400e" strokeWidth="3" fill="none" />
      </svg>
    ),
  },
  {
    id: "avatar_3",
    label: "Max",
    svg: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="32" cy="32" r="32" fill="#d1fae5" />
        <circle cx="32" cy="24" r="10" fill="#059669" />
        <ellipse cx="32" cy="50" rx="14" ry="10" fill="#059669" />
        <rect x="44" y="26" width="3" height="16" rx="1" fill="#6b7280" />
        <rect x="42" y="26" width="7" height="6" rx="2" fill="#10b981" />
        <path d="M44 32 Q44 38 46 40" stroke="#10b981" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    id: "avatar_4",
    label: "Bella",
    svg: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="32" cy="32" r="32" fill="#fce7f3" />
        <circle cx="32" cy="24" r="10" fill="#db2777" />
        <ellipse cx="32" cy="50" rx="14" ry="10" fill="#db2777" />
        <path d="M24 16 L28 20 L24 24" stroke="#f9a8d4" strokeWidth="2" fill="none" />
        <path d="M40 16 L36 20 L40 24" stroke="#f9a8d4" strokeWidth="2" fill="none" />
        <circle cx="32" cy="20" r="2" fill="#f9a8d4" />
        <rect x="43" y="32" width="8" height="10" rx="2" fill="#db2777" />
        <rect x="43" y="30" width="8" height="3" rx="1" fill="#9d174d" />
      </svg>
    ),
  },
  {
    id: "avatar_5",
    label: "Chip",
    svg: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="32" cy="32" r="32" fill="#e0f2fe" />
        <circle cx="32" cy="24" r="10" fill="#0284c7" />
        <ellipse cx="32" cy="50" rx="14" ry="10" fill="#0284c7" />
        <ellipse cx="32" cy="16" rx="12" ry="6" fill="#f59e0b" />
        <rect x="20" y="16" width="24" height="4" rx="1" fill="#f59e0b" />
        <circle cx="46" cy="32" r="3" fill="#0284c7" opacity="0.7" />
        <circle cx="50" cy="36" r="2" fill="#0284c7" opacity="0.5" />
        <circle cx="44" cy="38" r="1.5" fill="#0284c7" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: "avatar_6",
    label: "Sage",
    svg: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="32" cy="32" r="32" fill="#f3f4f6" />
        <circle cx="32" cy="24" r="10" fill="#374151" />
        <ellipse cx="32" cy="50" rx="14" ry="10" fill="#374151" />
        <circle cx="28" cy="24" r="4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        <circle cx="36" cy="24" r="4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        <line x1="32" y1="24" x2="32" y2="24" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="43" y="28" width="8" height="12" rx="1" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
        <line x1="45" y1="32" x2="49" y2="32" stroke="#9ca3af" strokeWidth="1" />
        <line x1="45" y1="35" x2="49" y2="35" stroke="#9ca3af" strokeWidth="1" />
      </svg>
    ),
  },
];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiSave(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const token = getAuthToken();
  const res = await fetch("/api/onboarding/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, error: data.error };
}

async function apiUploadLogo(file: File): Promise<string | null> {
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Signup() {
  const [step, setStep] = useState(1);
  const [websiteSubstep, setWebsiteSubstep] = useState<"fork" | "picker" | "existing">("fork");
  const [form, setForm] = useState<SignupForm>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [avatarUploadPreview, setAvatarUploadPreview] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [showCityPopup, setShowCityPopup] = useState(false);
  const [, navigate] = useLocation();

  const cityInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUploadRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof SignupForm>(field: K, value: SignupForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  // ── City management (Step 3) ────────────────────────────────────────────────

  const addCity = useCallback((city: string, state: string) => {
    setForm((prev) => {
      const exists = prev.serviceCities.some(
        (c) => c.city.toLowerCase() === city.toLowerCase() && c.state === state
      );
      if (exists) return prev;
      return {
        ...prev,
        serviceCities: [...prev.serviceCities, { city, state, radius: prev.serviceRadius }],
      };
    });
    setCityInput("");
  }, []);

  const removeCity = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      serviceCities: prev.serviceCities.filter((_, i) => i !== idx),
    }));
  };

  usePlacesAutocomplete(cityInputRef, addCity);

  // ── Logo (Step 4) ───────────────────────────────────────────────────────────

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarUploadPreview(ev.target?.result as string);
      update("chatbotAvatar", "custom");
    };
    reader.readAsDataURL(file);
  };

  // ── Step handlers ───────────────────────────────────────────────────────────

  async function handleStep1() {
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return setError("A valid email address is required.");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match.");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("__duplicate__");
        } else {
          setError(data.error ?? "Registration failed. Please try again.");
        }
        return;
      }
      setAuthToken(data.token);
      setStep(2);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2() {
    if (!form.companyName.trim()) return setError("Company name is required.");
    if (!form.phone.trim()) return setError("Phone number is required.");
    if (!form.businessEmail.trim()) return setError("Business email is required.");
    if (!form.address.trim()) return setError("Business address is required.");

    setLoading(true);
    setError(null);
    try {
      const { ok, error: apiErr } = await apiSave({
        company_name: form.companyName.trim(),
        phone: form.phone.trim(),
        business_email: form.businessEmail.trim(),
        address: form.address.trim(),
        website: form.website.trim() || null,
        years_in_business: form.yearsInBusiness ? parseInt(form.yearsInBusiness, 10) : null,
        license_number: form.licenseNumber.trim() || null,
        insurance_carrier: form.insuranceCarrier.trim() || null,
        signup_step: 2,
      });
      if (!ok) { setError(apiErr ?? "Failed to save. Please try again."); return; }
      setStep(3);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep3() {
    setLoading(true);
    setError(null);
    try {
      const { ok, error: apiErr } = await apiSave({
        service_cities: form.serviceCities,
        service_radius: form.serviceRadius,
        signup_step: 3,
      });
      if (!ok) { setError(apiErr ?? "Failed to save. Please try again."); return; }
      if (form.serviceCities.length > 0) {
        setShowCityPopup(true);
      } else {
        setStep(4);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep4() {
    setLoading(true);
    setError(null);
    try {
      let logoUrl = form.logoUrl;
      if (logoFile) {
        const uploaded = await apiUploadLogo(logoFile);
        if (uploaded) { logoUrl = uploaded; update("logoUrl", uploaded); }
      }
      const { ok, error: apiErr } = await apiSave({
        logo_url: logoUrl || null,
        chatbot_name: form.chatbotName.trim() || null,
        chatbot_avatar: form.chatbotAvatar || null,
        signup_step: 4,
      });
      if (!ok) { setError(apiErr ?? "Failed to save. Please try again."); return; }
      setStep(5);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 5 website fork — saves has_website then routes to sub-screen ───────

  async function handleWebsiteChoice(hasWebsite: boolean) {
    setLoading(true);
    setError(null);
    try {
      const { ok, error: apiErr } = await apiSave({
        has_website: hasWebsite,
        signup_step: 5,
      });
      if (!ok) { setError(apiErr ?? "Failed to save. Please try again."); return; }
      update("hasWebsite", hasWebsite);
      setWebsiteSubstep(hasWebsite ? "existing" : "picker");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 5A template select — saves template fields then advances to step 6 ─

  async function handleTemplatePick(templateStyle: string) {
    setLoading(true);
    setError(null);
    try {
      const { ok, error: apiErr } = await apiSave({
        template_style: templateStyle,
        template_tier: "starter",
        signup_step: 5,
      });
      if (!ok) { setError(apiErr ?? "Failed to save. Please try again."); return; }
      update("templateStyle", templateStyle);
      update("templateTier", "starter");
      setStep(6);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 5B keep site — saves null template then advances to step 6 ─────────

  async function handleKeepSite() {
    setLoading(true);
    setError(null);
    try {
      const { ok, error: apiErr } = await apiSave({
        template_style: null,
        template_tier: null,
        signup_step: 5,
      });
      if (!ok) { setError(apiErr ?? "Failed to save. Please try again."); return; }
      setStep(6);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Error rendering ─────────────────────────────────────────────────────────

  function renderError() {
    if (!error) return null;
    if (error === "__duplicate__") {
      return (
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You've already started signing up with this email —{" "}
          <Link href="/login" className="font-semibold underline hover:text-amber-900">
            log in to continue
          </Link>.
        </div>
      );
    }
    return (
      <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // ── Progress ────────────────────────────────────────────────────────────────

  const progressPct = step >= 5 ? 100 : ((step - 1) / 4) * 100;

  // ── Render ──────────────────────────────────────────────────────────────────

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
            Already have an account?{" "}
            <span className="font-semibold text-blue-600">Log in</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {/* Step indicators (hidden on confirmation screen) */}
          {step <= 4 && (
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

            {/* ── STEP 1 — Account ──────────────────────────────────────────── */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Free to start — no credit card required.
                </p>
                <div className="space-y-4">
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
                      autoFocus
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

                {renderError()}

                <div className="mt-8 flex justify-end">
                  <Button
                    onClick={handleStep1}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    {loading ? "Creating account…" : "Continue →"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 2 — Business Info ─────────────────────────────────────── */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Tell us about your business</h2>
                <p className="text-gray-500 text-sm mb-6">
                  This info powers your profile, quotes, and landing pages.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="companyName">Company Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="companyName"
                      placeholder="DFW Pro Painters LLC"
                      value={form.companyName}
                      onChange={(e) => update("companyName", e.target.value)}
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(214) 555-0100"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className="mt-1"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessEmail">Business Email <span className="text-red-500">*</span></Label>
                    <Input
                      id="businessEmail"
                      type="email"
                      placeholder="hello@yourcompany.com"
                      value={form.businessEmail}
                      onChange={(e) => update("businessEmail", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="address">Business Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="address"
                      placeholder="123 Main St, Dallas, TX 75201"
                      value={form.address}
                      onChange={(e) => update("address", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="website">
                      Website URL{" "}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={form.website}
                      onChange={(e) => update("website", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="yearsInBusiness">
                      Years in Business{" "}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="yearsInBusiness"
                      type="number"
                      min="0"
                      placeholder="5"
                      value={form.yearsInBusiness}
                      onChange={(e) => update("yearsInBusiness", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="licenseNumber">
                      License Number{" "}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="licenseNumber"
                      placeholder="TX-12345"
                      value={form.licenseNumber}
                      onChange={(e) => update("licenseNumber", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="insuranceCarrier">
                      Insurance Carrier{" "}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="insuranceCarrier"
                      placeholder="State Farm"
                      value={form.insuranceCarrier}
                      onChange={(e) => update("insuranceCarrier", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {renderError()}

                <div className="mt-8 flex justify-between">
                  <Button variant="outline" onClick={() => { setError(null); setStep(1); }} disabled={loading}>
                    ← Back
                  </Button>
                  <Button
                    onClick={handleStep2}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    {loading ? "Saving…" : "Continue →"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 3 — Service Areas ─────────────────────────────────────── */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  How far will you travel from each city?
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  We'll create dedicated landing pages for cities within this range — helping you rank on Google in each one.
                </p>

                {/* Radius selector */}
                <div className="mb-5">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Travel radius
                  </Label>
                  <div className="flex gap-3">
                    {RADIUS_OPTIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => update("serviceRadius", r)}
                        className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                          form.serviceRadius === r
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                        }`}
                      >
                        {r} mi
                      </button>
                    ))}
                  </div>
                </div>

                {/* City search */}
                <div className="mb-3">
                  <Label htmlFor="city_search" className="text-sm font-medium text-gray-700 mb-1 block">
                    Search cities
                  </Label>
                  <input
                    id="city_search"
                    ref={cityInputRef}
                    type="text"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="Start typing any US city…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-400 mt-1">Powered by Google Places</p>
                </div>

                {/* City chips */}
                {form.serviceCities.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-5 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    {form.serviceCities.map((sc, idx) => (
                      <span
                        key={`${sc.city}-${sc.state}-${idx}`}
                        className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-800 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm"
                      >
                        <span>📍</span>
                        <span>{sc.city}{sc.state ? `, ${sc.state}` : ""}</span>
                        <button
                          onClick={() => removeCity(idx)}
                          className="ml-0.5 w-4 h-4 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-900 flex items-center justify-center transition-colors text-xs"
                          aria-label={`Remove ${sc.city}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mb-5 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                    <p className="text-xs text-gray-400">
                      No cities added yet — search above to add your service areas
                    </p>
                  </div>
                )}

                {renderError()}

                <div className="mt-8 flex justify-between">
                  <Button variant="outline" onClick={() => { setError(null); setStep(2); }} disabled={loading}>
                    ← Back
                  </Button>
                  <Button
                    onClick={handleStep3}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    {loading ? "Saving…" : "Continue →"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 4 — Brand Kit ─────────────────────────────────────────── */}
            {step === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Brand Kit</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Upload your logo and choose your AI assistant's look. Colors are set when you pick your website template.
                </p>

                <div className="space-y-6">
                  {/* Logo upload */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1 block">
                      Company Logo{" "}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors min-h-[100px]"
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="max-h-16 max-w-full object-contain"
                        />
                      ) : (
                        <>
                          <span className="text-3xl mb-2">🖼️</span>
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

                  {/* Chatbot name */}
                  <div>
                    <Label htmlFor="chatbotName" className="text-sm font-medium text-gray-700 mb-1 block">
                      Name your AI assistant{" "}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="chatbotName"
                      value={form.chatbotName}
                      onChange={(e) => update("chatbotName", e.target.value)}
                      placeholder="Iris"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      This name appears on your chatbot widget and customer conversations.
                    </p>
                  </div>

                  {/* Chatbot avatar */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Chatbot Avatar
                    </Label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {AVATAR_OPTIONS.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => {
                            update("chatbotAvatar", avatar.id);
                            setAvatarUploadPreview(null);
                          }}
                          className={`relative rounded-xl p-1.5 border-2 transition-all flex flex-col items-center gap-1 ${
                            form.chatbotAvatar === avatar.id && !avatarUploadPreview
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-gray-200 hover:border-blue-300 bg-white"
                          }`}
                        >
                          <div className="w-10 h-10">{avatar.svg}</div>
                          <span className="text-[9px] text-gray-500 font-medium leading-tight">
                            {avatar.label}
                          </span>
                          {form.chatbotAvatar === avatar.id && !avatarUploadPreview && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-[8px]">✓</span>
                            </div>
                          )}
                        </button>
                      ))}
                      {/* Upload custom photo */}
                      <button
                        type="button"
                        onClick={() => avatarUploadRef.current?.click()}
                        className={`relative rounded-xl p-1.5 border-2 transition-all flex flex-col items-center justify-center gap-1 min-h-[64px] ${
                          form.chatbotAvatar === "custom"
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-dashed border-gray-300 hover:border-blue-300 bg-white"
                        }`}
                      >
                        {avatarUploadPreview ? (
                          <>
                            <img
                              src={avatarUploadPreview}
                              alt="Custom avatar"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <span className="text-[9px] text-gray-500 font-medium">Custom</span>
                            {form.chatbotAvatar === "custom" && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-[8px]">✓</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-xl">📷</span>
                            <span className="text-[9px] text-gray-500 font-medium text-center leading-tight">
                              Upload photo
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      ref={avatarUploadRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>
                </div>

                {renderError()}

                <div className="mt-8 flex justify-between">
                  <Button variant="outline" onClick={() => { setError(null); setStep(3); }} disabled={loading}>
                    ← Back
                  </Button>
                  <Button
                    onClick={handleStep4}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    {loading ? "Saving…" : "Finish Setup →"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 5 — Website Choice Fork ───────────────────────────────── */}
            {step === 5 && websiteSubstep === "fork" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Do you already have a website?
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  We'll set up your online presence based on your answer.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card A — needs a website */}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleWebsiteChoice(false)}
                    className="text-left rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-white p-6 transition-all focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                  >
                    <div className="text-4xl mb-3">🚀</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      I need a website
                    </h3>
                    <p className="text-sm text-gray-500">
                      We'll build you one — free with your plan
                    </p>
                  </button>

                  {/* Card B — already has a website */}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleWebsiteChoice(true)}
                    className="text-left rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-white p-6 transition-all focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                  >
                    <div className="text-4xl mb-3">🌐</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      I already have a website
                    </h3>
                    <p className="text-sm text-gray-500">
                      Keep it or let us rebuild it
                    </p>
                  </button>
                </div>

                {renderError()}

                <div className="mt-8 flex justify-start">
                  <Button
                    variant="outline"
                    onClick={() => { setError(null); setStep(4); }}
                    disabled={loading}
                  >
                    ← Back
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 5A — Template Picker ───────────────────────────────────── */}
            {step === 5 && websiteSubstep === "picker" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {form.hasWebsite
                    ? "Let's give your site an upgrade"
                    : "Choose your website style"}
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  You can change this anytime.
                </p>

                {/* Template card — Noir A4 */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full max-w-xs rounded-2xl border-2 border-yellow-600 bg-gray-900 overflow-hidden shadow-lg">
                    {/* Gold accent bar */}
                    <div className="h-2 bg-yellow-500 w-full" />
                    {/* CSS placeholder preview */}
                    <div className="flex flex-col items-center justify-center gap-4 p-6" style={{ minHeight: "300px" }}>
                      {/* Simulated logo area */}
                      <div className="w-12 h-12 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
                        <span className="text-yellow-400 text-xl">🎨</span>
                      </div>
                      {/* Simulated headline */}
                      <div className="space-y-2 w-full">
                        <div className="h-2.5 bg-yellow-500/50 rounded-full w-3/4 mx-auto" />
                        <div className="h-2 bg-gray-700 rounded-full w-full" />
                        <div className="h-2 bg-gray-700 rounded-full w-5/6 mx-auto" />
                      </div>
                      {/* Simulated CTA button */}
                      <div className="w-full border border-yellow-500/60 rounded-lg px-4 py-3 flex items-center justify-center mt-2">
                        <div className="h-2 bg-yellow-500/40 rounded-full w-1/2" />
                      </div>
                      {/* Simulated content blocks */}
                      <div className="grid grid-cols-3 gap-2 w-full">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-10 rounded bg-gray-800 border border-gray-700" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Template meta */}
                  <div className="text-center">
                    <p className="font-bold text-gray-900 text-lg">Noir</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                      Dark &amp; Elegant
                    </span>
                  </div>

                  <Button
                    onClick={() => handleTemplatePick("noir-a4")}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-10"
                  >
                    {loading ? "Saving…" : "Select This Style →"}
                  </Button>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                  More styles coming soon — Pro and Agency plans unlock 16 premium designs.
                </p>

                {renderError()}

                <div className="mt-6 flex justify-start">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setError(null);
                      setWebsiteSubstep(form.hasWebsite ? "existing" : "fork");
                    }}
                    disabled={loading}
                  >
                    ← Back
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 5B — Existing Site Options ────────────────────────────── */}
            {step === 5 && websiteSubstep === "existing" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  What would you like to do with your current site?
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  Either way, PaintersMax will help you get more leads.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1 — Redesign */}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => { setError(null); setWebsiteSubstep("picker"); }}
                    className="text-left rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-white p-6 transition-all focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                  >
                    <div className="text-4xl mb-3">✨</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      Redesign my site
                    </h3>
                    <p className="text-sm text-gray-500">
                      Let PaintersMax give it a professional upgrade
                    </p>
                  </button>

                  {/* Option 2 — Keep */}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleKeepSite}
                    className="text-left rounded-2xl border-2 border-gray-200 hover:border-blue-400 bg-white p-6 transition-all focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                  >
                    <div className="text-4xl mb-3">🔒</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      Keep my current site
                    </h3>
                    <p className="text-sm text-gray-500">
                      We'll connect PaintersMax to what you already have
                    </p>
                  </button>
                </div>

                {renderError()}

                <div className="mt-8 flex justify-start">
                  <Button
                    variant="outline"
                    onClick={() => { setError(null); setWebsiteSubstep("fork"); }}
                    disabled={loading}
                  >
                    ← Back
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 6 — Temporary completion ──────────────────────────────── */}
            {/* TEMPORARY — REPLACE IN CHUNK 3 (Demo Data Engine) */}
            {step === 6 && (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  🎉 You're in{form.companyName ? `, ${form.companyName}` : ""}! Your dashboard is ready — let's take a look.
                </h2>
                <Button
                  className="mt-6"
                  onClick={() => navigate("/dashboard")}
                >
                  Go to Dashboard →
                </Button>
              </div>
            )}
            {/* END TEMPORARY */}

          </div>

          {/* Footer note */}
          {step < 5 && (
            <p className="text-center text-xs text-gray-400 mt-6">
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
          )}
        </div>
      </div>

      {/* ── City persuasion popup (shown after Step 3 save) ─────────────────── */}
      {showCityPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="text-4xl mb-4">📍</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Nice
              {form.companyName ? `, ${form.companyName}` : ""}
              !
            </h3>
            <p className="text-gray-600 mb-6">
              We'll build you{" "}
              <strong>{form.serviceCities.length} {form.serviceCities.length === 1 ? "city landing page" : "city landing pages"}</strong>{" "}
              for these areas. Each one is a new way homeowners find you on Google.
            </p>
            <Button
              onClick={() => { setShowCityPopup(false); setStep(4); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              Sounds great →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
