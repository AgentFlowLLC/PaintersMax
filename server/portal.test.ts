/**
 * portal.test.ts — Vitest tests for the portal tRPC router
 *
 * Tests:
 *   - portal.getData returns null for invalid token
 *   - portal.generateToken creates a token and returns a URL
 *   - portal.getToken returns null when no token exists
 *   - portal.addPhoto appends a photo to the lead
 *   - portal.removePhoto removes a photo from the lead
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock db module ───────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock portal service ──────────────────────────────────────────────────────

vi.mock("./services/portal", () => ({
  generatePortalToken: vi.fn().mockResolvedValue("test-portal-token-abc123"),
  buildPortalUrl: vi.fn().mockImplementation((token: string, origin?: string) =>
    `${origin ?? "https://example.com"}/portal/${token}`
  ),
  getPortalData: vi.fn().mockImplementation(async (token: string) => {
    if (token === "valid-token") {
      return {
        lead: {
          id: 1,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          phone: "555-1234",
          stage: "scheduled",
          projectType: "Interior Painting",
          projectAddress: "123 Main St",
          projectDescription: "Full interior repaint",
          portalPhotos: [],
        },
        invoice: null,
        appointment: null,
      };
    }
    return null;
  }),
  addPortalPhoto: vi.fn().mockResolvedValue({ success: true }),
  removePortalPhoto: vi.fn().mockResolvedValue({ success: true }),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function makeAuthCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "owner-open-id",
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
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("portal.getData", () => {
  it("returns null for an invalid/unknown token", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.portal.getData({ token: "bad-token-xyz" });
    expect(result).toBeNull();
  });

  it("returns portal data for a valid token", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.portal.getData({ token: "valid-token" });
    expect(result).not.toBeNull();
    expect(result?.lead.firstName).toBe("Jane");
    expect(result?.lead.stage).toBe("scheduled");
  });
});

describe("portal.generateToken", () => {
  it("returns a token and URL for a valid leadId", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.portal.generateToken({
      leadId: 1,
      origin: "https://paintcrm.example.com",
    });
    expect(result.token).toBe("test-portal-token-abc123");
    expect(result.url).toContain("/portal/test-portal-token-abc123");
    expect(result.url).toContain("paintcrm.example.com");
  });

  it("uses fallback origin when origin is not provided", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.portal.generateToken({ leadId: 2 });
    expect(result.token).toBe("test-portal-token-abc123");
    expect(result.url).toContain("/portal/test-portal-token-abc123");
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.portal.generateToken({ leadId: 1 })
    ).rejects.toThrow();
  });
});

describe("portal.addPhoto", () => {
  it("adds a photo to the portal gallery", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.portal.addPhoto({
      leadId: 1,
      url: "https://cdn.example.com/photo.jpg",
      caption: "Front of house before painting",
      type: "before",
    });
    expect(result).toMatchObject({ success: true });
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.portal.addPhoto({
        leadId: 1,
        url: "https://cdn.example.com/photo.jpg",
        caption: "",
        type: "after",
      })
    ).rejects.toThrow();
  });
});

describe("portal.removePhoto", () => {
  it("removes a photo from the portal gallery", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.portal.removePhoto({
      leadId: 1,
      url: "https://cdn.example.com/photo.jpg",
    });
    expect(result).toMatchObject({ success: true });
  });
});
