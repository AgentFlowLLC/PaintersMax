/**
 * client/src/pages/Onboarding.tsx
 *
 * Self-serve onboarding flow for new PaintersMax painting company clients.
 * 6 steps with progress bar:
 *   1. Welcome
 *   2. Business Info
 *   3. Service Areas  (Google Places Autocomplete — Improvement 1)
 *   4. Brand Kit      (Chatbot name/avatar + template previews — Improvements 2 & 3)
 *   5. Choose Plan
 *   6. Done (confetti + welcome email)
 *
 * Improvements:
 *   1. Step 3: Google Places city search with removable chips
 *   2. Step 4: Chatbot name + 6 illustrated avatar options + upload own photo
 *   3. Step 4: Color info text + 3 template preview cards
 *   4. All steps 2-4: "Save progress and continue later" with Resend email
 *   5. Dashboard: ProfileCompletion widget (separate component)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthToken } from "@/lib/auth";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServiceCity {
  city: string;
  state: string;
  radius: number;
}

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
  // Step 3 — Service Areas (new: array of {city, state, radius})
  service_cities_v2: ServiceCity[];
  service_radius: number;
  // Step 4 — Brand Kit
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  tagline: string;
  // Step 4 — Chatbot (new)
  chatbot_name: string;
  chatbot_avatar: string;
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
  service_cities_v2: [],
  service_radius: 25,
  logo_url: "",
  primary_color: "#7c3aed",
  secondary_color: "#f59e0b",
  tagline: "",
  chatbot_name: "",
  chatbot_avatar: "avatar_1",
};

const RADIUS_OPTIONS = [10, 25, 50, 100];

const TOTAL_STEPS = 6;

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
        {/* painter hat */}
        <rect x="22" y="14" width="20" height="5" rx="2" fill="#f59e0b" />
        <rect x="26" y="10" width="12" height="5" rx="2" fill="#f59e0b" />
        {/* paint brush */}
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
        {/* paint palette */}
        <ellipse cx="44" cy="36" rx="7" ry="5" fill="#fff" stroke="#d97706" strokeWidth="1.5" />
        <circle cx="42" cy="35" r="1.5" fill="#7c3aed" />
        <circle cx="45" cy="34" r="1.5" fill="#ef4444" />
        <circle cx="46" cy="37" r="1.5" fill="#10b981" />
        {/* hair */}
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
        {/* roller */}
        <rect x="44" y="26" width="3" height="16" rx="1" fill="#6b7280" />
        <rect x="42" y="26" width="7" height="6" rx="2" fill="#10b981" />
        {/* paint drip */}
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
        {/* bow */}
        <path d="M24 16 L28 20 L24 24" stroke="#f9a8d4" strokeWidth="2" fill="none" />
        <path d="M40 16 L36 20 L40 24" stroke="#f9a8d4" strokeWidth="2" fill="none" />
        <circle cx="32" cy="20" r="2" fill="#f9a8d4" />
        {/* paint can */}
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
        {/* hard hat */}
        <ellipse cx="32" cy="16" rx="12" ry="6" fill="#f59e0b" />
        <rect x="20" y="16" width="24" height="4" rx="1" fill="#f59e0b" />
        {/* paint splatter */}
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
        {/* glasses */}
        <circle cx="28" cy="24" r="4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        <circle cx="36" cy="24" r="4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        <line x1="32" y1="24" x2="32" y2="24" stroke="#f59e0b" strokeWidth="1.5" />
        {/* clipboard */}
        <rect x="43" y="28" width="8" height="12" rx="1" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
        <line x1="45" y1="32" x2="49" y2="32" stroke="#9ca3af" strokeWidth="1" />
        <line x1="45" y1="35" x2="49" y2="35" stroke="#9ca3af" strokeWidth="1" />
      </svg>
    ),
  },
];

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

// ─── Google Places Autocomplete Hook ─────────────────────────────────────────
declare global {
  interface Window {
    google: typeof google;
    initGooglePlaces?: () => void;
  }
}

function usePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onSelect: (city: string, state: string) => void
) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;

    const initAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["(cities)"],
        componentRestrictions: { country: "us" },
        fields: ["address_components", "name"],
      });
      autocompleteRef.current = ac;
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
      initAutocomplete();
    } else {
      const scriptId = "google-places-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.onload = initAutocomplete;
        document.head.appendChild(script);
      } else {
        // Script tag exists but not loaded yet — wait
        const existing = document.getElementById(scriptId) as HTMLScriptElement;
        existing.addEventListener("load", initAutocomplete);
      }
    }

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── Template Preview Cards ───────────────────────────────────────────────────
function TemplatePreviewCards({
  primary,
  secondary,
  companyName,
  chatbotName,
  logoPreview,
  selectedAvatarId,
}: {
  primary: string;
  secondary: string;
  companyName: string;
  chatbotName: string;
  logoPreview: string | null;
  selectedAvatarId: string;
}) {
  const avatarSvg = AVATAR_OPTIONS.find((a) => a.id === selectedAvatarId)?.svg;
  const displayName = chatbotName || "Iris";
  const displayCompany = companyName || "Your Company";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      {/* 1. Chatbot Widget */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-2 py-1 bg-gray-50 border-b border-gray-200">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
            Chatbot Widget
          </p>
        </div>
        <div className="p-2">
          <div
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: primary + "66" }}
          >
            <div
              className="px-2 py-1.5 flex items-center gap-1.5"
              style={{ background: primary }}
            >
              <div className="w-5 h-5 rounded-full bg-white/20 overflow-hidden flex-shrink-0">
                {avatarSvg ? (
                  <div className="w-full h-full">{avatarSvg}</div>
                ) : (
                  <span className="text-white text-[8px] font-bold flex items-center justify-center h-full">AI</span>
                )}
              </div>
              <div>
                <p className="text-white text-[9px] font-semibold leading-tight">{displayName}</p>
                <p className="text-white/70 text-[8px] leading-tight">{displayCompany}</p>
              </div>
            </div>
            <div className="bg-white px-2 py-1.5 space-y-1">
              <div
                className="rounded-lg px-2 py-1 text-[9px] text-white max-w-[80%]"
                style={{ background: primary }}
              >
                Hi! How can I help? 👋
              </div>
              <div
                className="rounded-lg px-2 py-1 text-[9px] text-white ml-auto max-w-[80%]"
                style={{ background: secondary }}
              >
                I need a quote!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Invoice Header */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-2 py-1 bg-gray-50 border-b border-gray-200">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
            Invoice Header
          </p>
        </div>
        <div className="p-2">
          <div className="rounded-lg overflow-hidden border border-gray-100">
            <div
              className="px-3 py-2 flex items-center justify-between"
              style={{ background: primary }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-5 object-contain" />
              ) : (
                <span className="text-white text-[10px] font-bold">{displayCompany}</span>
              )}
              <span className="text-white/80 text-[9px] font-medium">INVOICE</span>
            </div>
            <div className="bg-white px-3 py-2 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-[9px] text-gray-500">Invoice #</span>
                <span className="text-[9px] font-medium text-gray-700">INV-0042</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] text-gray-500">Total</span>
                <span
                  className="text-[9px] font-bold"
                  style={{ color: secondary }}
                >
                  $2,400.00
                </span>
              </div>
            </div>
            <div
              className="px-3 py-1 text-center"
              style={{ background: secondary + "22" }}
            >
              <span className="text-[8px] font-medium" style={{ color: secondary }}>
                Thank you for your business!
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Door Hanger Flyer */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-2 py-1 bg-gray-50 border-b border-gray-200">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
            Door Hanger Flyer
          </p>
        </div>
        <div className="p-2">
          <div
            className="rounded-lg overflow-hidden border"
            style={{ borderColor: primary + "44" }}
          >
            <div
              className="px-3 py-2 text-center"
              style={{ background: primary }}
            >
              <p className="text-white text-[10px] font-bold leading-tight">{displayCompany}</p>
              <p className="text-white/80 text-[8px]">Professional Painting</p>
            </div>
            <div className="bg-white px-2 py-2 text-center space-y-1">
              <p
                className="text-[9px] font-bold"
                style={{ color: primary }}
              >
                FREE ESTIMATE
              </p>
              <p className="text-[8px] text-gray-500">Interior & Exterior</p>
              <div
                className="rounded-full px-2 py-0.5 text-[8px] font-semibold text-white mx-auto inline-block"
                style={{ background: secondary }}
              >
                Call Today!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Onboarding Component ────────────────────────────────────────────────
export default function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [statusChecked, setStatusChecked] = useState(false);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [saving, setSaving] = useState(false);
  const [savingLater, setSavingLater] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [avatarUploadPreview, setAvatarUploadPreview] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const [cityInputValue, setCityInputValue] = useState("");

  // Google Places Autocomplete for Step 3
  usePlacesAutocomplete(cityInputRef, (city, state) => {
    addCity(city, state);
    setCityInputValue("");
  });

  // Check onboarding status on mount
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

  // ── Service Cities (Step 3) ──────────────────────────────────────────────
  const addCity = (city: string, state: string) => {
    const trimmed = city.trim();
    if (!trimmed) return;
    setData((prev) => {
      const exists = prev.service_cities_v2.some(
        (c) => c.city.toLowerCase() === trimmed.toLowerCase() && c.state === state
      );
      if (exists) return prev;
      return {
        ...prev,
        service_cities_v2: [
          ...prev.service_cities_v2,
          { city: trimmed, state, radius: prev.service_radius },
        ],
      };
    });
  };

  const removeCity = (index: number) => {
    setData((prev) => ({
      ...prev,
      service_cities_v2: prev.service_cities_v2.filter((_, i) => i !== index),
    }));
  };

  // ── Logo ─────────────────────────────────────────────────────────────────
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Avatar Upload ─────────────────────────────────────────────────────────
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarUploadPreview(result);
      setData((prev) => ({ ...prev, chatbot_avatar: "custom" }));
    };
    reader.readAsDataURL(file);
  };

  // ── Save Progress ─────────────────────────────────────────────────────────
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
          service_cities: payload.service_cities_v2,
          service_radius: payload.service_radius,
          logo_url: payload.logo_url || null,
          primary_color: payload.primary_color || null,
          secondary_color: payload.secondary_color || null,
          tagline: payload.tagline || null,
          chatbot_name: payload.chatbot_name || null,
          chatbot_avatar: payload.chatbot_avatar || null,
        });
      } catch (err) {
        console.warn("[Onboarding] save error (non-fatal):", err);
      }
    },
    [data]
  );

  // ── Save and Continue Later ───────────────────────────────────────────────
  const handleSaveLater = async () => {
    setSavingLater(true);
    try {
      await saveProgress();
      await apiPost("/api/onboarding/save-later", {
        business_email: data.business_email,
        company_name: data.company_name,
        current_step: step,
      });
      toast.success("Progress saved! Check your email to continue later.");
    } catch (err) {
      console.warn("[Onboarding] save-later error:", err);
      toast.success("Progress saved!");
    } finally {
      setSavingLater(false);
    }
  };

  const goNext = async () => {
    setError(null);
    setSaving(true);
    try {
      if (step === 2) {
        if (!data.company_name.trim()) return setError("Company name is required.");
        if (!data.phone.trim()) return setError("Phone number is required.");
        if (!data.business_email.trim()) return setError("Business email is required.");
        if (!data.address.trim()) return setError("Business address is required.");
        await saveProgress();
      }
      if (step === 3) {
        await saveProgress();
      }
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

  // Save & Continue Later button (shown on steps 2, 3, 4)
  const SaveLaterButton = () =>
    step >= 2 && step <= 4 ? (
      <button
        type="button"
        onClick={handleSaveLater}
        disabled={savingLater}
        className="text-xs text-gray-400 hover:text-purple-600 underline underline-offset-2 transition-colors disabled:opacity-50"
      >
        {savingLater ? "Saving…" : "Save progress and continue later"}
      </button>
    ) : null;

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

        {/* Progress bar */}
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

            <div className="flex items-center justify-between mt-6">
              <SaveLaterButton />
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

        {/* ── STEP 3 — Service Areas (Google Places) ───────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Service Areas</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Add the cities you serve. You can add as many as you like.
            </p>

            {/* Google Places search input */}
            <div className="mb-3">
              <Label htmlFor="city_search" className="text-sm font-medium text-gray-700 mb-1 block">
                Search Cities
              </Label>
              <input
                id="city_search"
                ref={cityInputRef}
                type="text"
                value={cityInputValue}
                onChange={(e) => setCityInputValue(e.target.value)}
                placeholder="Start typing any US city — we'll find it"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-1">
                Default suggestions: Texas cities — powered by Google Places
              </p>
            </div>

            {/* Selected city chips */}
            {data.service_cities_v2.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5 p-3 bg-purple-50 rounded-xl border border-purple-100">
                {data.service_cities_v2.map((sc, idx) => (
                  <span
                    key={`${sc.city}-${sc.state}-${idx}`}
                    className="flex items-center gap-1.5 bg-white border border-purple-200 text-purple-800 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm"
                  >
                    <span>📍</span>
                    <span>
                      {sc.city}{sc.state ? `, ${sc.state}` : ""}
                    </span>
                    <button
                      onClick={() => removeCity(idx)}
                      className="ml-0.5 w-4 h-4 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 hover:text-purple-900 flex items-center justify-center transition-colors text-xs leading-none"
                      aria-label={`Remove ${sc.city}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {data.service_cities_v2.length === 0 && (
              <div className="mb-5 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                <p className="text-xs text-gray-400">No cities added yet — search above to add your service areas</p>
              </div>
            )}

            {/* Radius selector */}
            <div className="mb-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Default Service Radius from Each City
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
                    {r} mi
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setStep(2)} className="text-gray-500 px-0">
                  ← Back
                </Button>
                <SaveLaterButton />
              </div>
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
              Upload your logo, set your brand colors, and customize your AI assistant.
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

                {/* Color info text */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    These colors will appear on: your AI chatbot widget, PDF quotes and invoices,
                    email templates, and marketing materials. You can update these anytime in{" "}
                    <strong>Settings → Brand Kit</strong>.
                  </p>
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

                {/* Chatbot name */}
                <div>
                  <Label htmlFor="chatbot_name" className="text-sm font-medium text-gray-700 mb-1 block">
                    Name your AI assistant
                  </Label>
                  <Input
                    id="chatbot_name"
                    value={data.chatbot_name}
                    onChange={(e) => update("chatbot_name", e.target.value)}
                    placeholder="Iris"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    This name will appear on your chatbot widget and customer conversations.
                  </p>
                </div>

                {/* Chatbot avatar */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Chatbot Avatar
                  </Label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {AVATAR_OPTIONS.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          setData((prev) => ({ ...prev, chatbot_avatar: avatar.id }));
                          setAvatarUploadPreview(null);
                        }}
                        className={`relative rounded-xl p-1.5 border-2 transition-all flex flex-col items-center gap-1 ${
                          data.chatbot_avatar === avatar.id && !avatarUploadPreview
                            ? "border-purple-500 bg-purple-50 shadow-sm"
                            : "border-gray-200 hover:border-purple-300 bg-white"
                        }`}
                      >
                        <div className="w-10 h-10">{avatar.svg}</div>
                        <span className="text-[9px] text-gray-500 font-medium leading-tight">
                          {avatar.label}
                        </span>
                        {data.chatbot_avatar === avatar.id && !avatarUploadPreview && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-[8px]">✓</span>
                          </div>
                        )}
                      </button>
                    ))}
                    {/* Upload own photo */}
                    <button
                      type="button"
                      onClick={() => avatarUploadRef.current?.click()}
                      className={`relative rounded-xl p-1.5 border-2 transition-all flex flex-col items-center justify-center gap-1 min-h-[64px] ${
                        data.chatbot_avatar === "custom"
                          ? "border-purple-500 bg-purple-50 shadow-sm"
                          : "border-dashed border-gray-300 hover:border-purple-300 bg-white"
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
                          {data.chatbot_avatar === "custom" && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
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

              {/* Right: live preview */}
              <div className="flex flex-col">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 text-center">
                  Live Widget Preview
                </p>
                <div className="relative w-64 mx-auto">
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
                      {/* Avatar in header */}
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex-shrink-0">
                        {avatarUploadPreview ? (
                          <img
                            src={avatarUploadPreview}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : data.chatbot_avatar && data.chatbot_avatar !== "custom" ? (
                          <div className="w-full h-full">
                            {AVATAR_OPTIONS.find((a) => a.id === data.chatbot_avatar)?.svg}
                          </div>
                        ) : logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo"
                            className="w-8 h-8 rounded-full object-cover bg-white"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">AI</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold leading-tight">
                          {data.chatbot_name || "Iris"}
                        </p>
                        <p className="text-white/80 text-xs leading-tight">
                          {data.company_name || "Your Company"}
                        </p>
                        {data.tagline && (
                          <p className="text-white/70 text-[10px] leading-tight">{data.tagline}</p>
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
                    className="absolute -bottom-4 -right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center overflow-hidden"
                    style={{ background: data.primary_color }}
                  >
                    {avatarUploadPreview ? (
                      <img src={avatarUploadPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : data.chatbot_avatar && data.chatbot_avatar !== "custom" ? (
                      <div className="w-full h-full p-1">
                        {AVATAR_OPTIONS.find((a) => a.id === data.chatbot_avatar)?.svg}
                      </div>
                    ) : (
                      <span className="text-white text-xl">💬</span>
                    )}
                  </div>
                </div>

                {/* Template preview cards */}
                <div className="mt-8">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">
                    Colors Applied Across Your Materials
                  </p>
                  <TemplatePreviewCards
                    primary={data.primary_color}
                    secondary={data.secondary_color}
                    companyName={data.company_name}
                    chatbotName={data.chatbot_name}
                    logoPreview={logoPreview}
                    selectedAvatarId={data.chatbot_avatar}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setStep(3)} className="text-gray-500 px-0">
                  ← Back
                </Button>
                <SaveLaterButton />
              </div>
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
