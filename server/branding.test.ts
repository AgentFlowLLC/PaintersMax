import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock database ─────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock storage ──────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/branding/logo-abc123.png", key: "branding/logo-abc123.png" }),
  storageGet: vi.fn(),
}));

// ─── Mock services ─────────────────────────────────────────────────────────────
vi.mock("./services/sms", () => ({ sendSMS: vi.fn(), persistConversation: vi.fn() }));
vi.mock("./services/invoices", () => ({ generateInvoice: vi.fn(), sendInvoice: vi.fn(), markInvoicePaid: vi.fn() }));
vi.mock("./services/schedule", () => ({ createAppointment: vi.fn(), updateAppointment: vi.fn(), cancelAppointment: vi.fn() }));
vi.mock("./services/portal", () => ({ generatePortalToken: vi.fn(), buildPortalUrl: vi.fn(), getPortalData: vi.fn() }));
vi.mock("./services/reviews", () => ({ sendReviewRequest: vi.fn(), scheduleReviewRequest: vi.fn() }));
vi.mock("./services/photos", () => ({ uploadPhoto: vi.fn(), listPhotos: vi.fn(), deletePhoto: vi.fn(), getPhotosByLead: vi.fn() }));

import { getDb } from "./db";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function makeAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      name: "Admin",
      email: "admin@example.com",
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

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeDbMock(settingsRow: Record<string, unknown> | null = null) {
  const rows = settingsRow ? [settingsRow] : [];
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────
describe("settings.getBranding (public)", () => {
  it("returns default branding when no settings row exists", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(makeDbMock(null));
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.settings.getBranding();
    expect(result.businessName).toBe("PaintersMax");
    expect(result.primaryColor).toBe("#1e3a5f");
    expect(result.secondaryColor).toBe("#3b82f6");
    expect(result.logoUrl).toBeNull();
  });

  it("returns stored branding values when settings row exists", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(makeDbMock({
      id: 1,
      businessName: "Elite Painters LLC",
      logoUrl: "https://cdn.example.com/logo.png",
      primaryColor: "#ff5500",
      secondaryColor: "#00aaff",
    }));
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.settings.getBranding();
    expect(result.businessName).toBe("Elite Painters LLC");
    expect(result.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(result.primaryColor).toBe("#ff5500");
    expect(result.secondaryColor).toBe("#00aaff");
  });

  it("falls back to defaults for null branding fields", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(makeDbMock({
      id: 1,
      businessName: null,
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
    }));
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.settings.getBranding();
    expect(result.businessName).toBe("PaintersMax");
    expect(result.primaryColor).toBe("#1e3a5f");
  });
});

describe("settings.update (branding fields)", () => {
  it("saves businessName, primaryColor, secondaryColor via update", async () => {
    const dbMock = makeDbMock({ id: 1, companyName: "Old Name" });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(dbMock);
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.update({
      businessName: "Elite Painters LLC",
      primaryColor: "#ff5500",
      secondaryColor: "#00aaff",
    });
    expect(result.success).toBe(true);
    expect(dbMock.update).toHaveBeenCalled();
  });
});

describe("settings.uploadLogo", () => {
  it("uploads logo to S3 and saves URL to settings", async () => {
    const dbMock = makeDbMock({ id: 1 });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(dbMock);
    const { storagePut } = await import("./storage");

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.uploadLogo({
      base64Data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      mimeType: "image/png",
      originalName: "logo.png",
    });

    expect(result.success).toBe(true);
    expect(result.logoUrl).toBe("https://cdn.example.com/branding/logo-abc123.png");
    expect(storagePut).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled();
  });
});

describe("settings.removeLogo", () => {
  it("clears logoUrl and logoKey from settings", async () => {
    const dbMock = makeDbMock({ id: 1, logoUrl: "https://cdn.example.com/logo.png", logoKey: "branding/logo.png" });
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(dbMock);

    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.settings.removeLogo();
    expect(result.success).toBe(true);
    expect(dbMock.update).toHaveBeenCalled();
  });
});
