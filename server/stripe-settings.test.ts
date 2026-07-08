import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock db module ────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock storage ──────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/logo.png", key: "logo.png" }),
  storageGet: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/logo.png", key: "logo.png" }),
}));

function makeAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      subscriptionStatus: "active",
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("settings.testStripeConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects keys that don't start with sk_live_ or sk_test_", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.testStripeConnection({ secretKey: "invalid_key_format" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid key format/i);
  });

  it("accepts sk_test_ prefixed keys for format validation", async () => {
    // We can't make a real Stripe call in tests, but we can verify the format check passes
    // and the function attempts a network call (which will fail in test env)
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.testStripeConnection({ secretKey: "sk_test_validformat123" });
    // Should either succeed (if Stripe is reachable) or fail with a network/auth error
    // but NOT with "Invalid key format"
    if (!result.success) {
      expect(result.error).not.toMatch(/Invalid key format/i);
    }
  });

  it("accepts sk_live_ prefixed keys for format validation", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.testStripeConnection({ secretKey: "sk_live_validformat456" });
    if (!result.success) {
      expect(result.error).not.toMatch(/Invalid key format/i);
    }
  });

  it("rejects empty string key", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    // Zod should reject empty string (min(1))
    await expect(
      caller.settings.testStripeConnection({ secretKey: "" })
    ).rejects.toThrow();
  });

  it("rejects pk_ publishable keys (wrong type)", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.testStripeConnection({ secretKey: "pk_test_shouldfail" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid key format/i);
  });
});

describe("settings.getBranding (public)", () => {
  it("returns default branding when DB is unavailable", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    });
    const branding = await caller.settings.getBranding();
    expect(branding.businessName).toBe("PaintersMax");
    expect(branding.primaryColor).toBe("#1e3a5f");
    expect(branding.secondaryColor).toBe("#3b82f6");
    expect(branding.logoUrl).toBeNull();
  });
});

describe("settings.get (protected)", () => {
  it("returns stripeSecretKeySet: false when DB unavailable", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.get();
    expect(result.stripeSecretKeySet).toBe(false);
    expect(result.stripePublishableKey).toBeNull();
  });

  it("returns stripeEnabled: false when DB unavailable", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.get();
    expect(result.stripeEnabled).toBe(false);
  });
});
