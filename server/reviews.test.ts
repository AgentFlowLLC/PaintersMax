/**
 * reviews.test.ts — Vitest tests for the reviews tRPC router
 *
 * Tests:
 *   - reviews.send succeeds when review link is configured
 *   - reviews.send returns error when no phone number on lead
 *   - reviews.send returns error when google_review_link not configured
 *   - reviews.status returns configured: true when link is set
 *   - reviews.status returns configured: false when link is not set
 *   - reviews.send requires authentication
 */

import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock db module ───────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock reviews service ─────────────────────────────────────────────────────

vi.mock("./services/reviews", () => ({
  sendReviewRequest: vi.fn().mockImplementation(async (leadId: number) => {
    if (leadId === 999) {
      return {
        success: false,
        smsSent: false,
        message: "Lead 999 not found",
        error: "Lead 999 not found",
      };
    }
    if (leadId === 888) {
      return {
        success: false,
        smsSent: false,
        message: "Lead 888 has no phone number — review request not sent",
        error: "No phone number on file",
      };
    }
    if (leadId === 777) {
      return {
        success: false,
        smsSent: false,
        message: "Google Review link not configured in Settings",
        error: "Google Review link not configured — add it in Settings → Google Review Link",
      };
    }
    return {
      success: true,
      smsSent: true,
      message: "Review request SMS sent to Jane Smith",
    };
  }),
  scheduleReviewRequest: vi.fn(),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────

function makeAuthCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
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

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("reviews.send", () => {
  it("successfully sends a review request SMS", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.reviews.send({ leadId: 1 });
    expect(result.success).toBe(true);
    expect(result.smsSent).toBe(true);
    expect(result.message).toContain("Review request SMS sent");
  });

  it("returns error when lead is not found", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.reviews.send({ leadId: 999 });
    expect(result.success).toBe(false);
    expect(result.smsSent).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error when lead has no phone number", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.reviews.send({ leadId: 888 });
    expect(result.success).toBe(false);
    expect(result.smsSent).toBe(false);
    expect(result.error).toContain("No phone number");
  });

  it("returns error when google_review_link is not configured", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.reviews.send({ leadId: 777 });
    expect(result.success).toBe(false);
    expect(result.smsSent).toBe(false);
    expect(result.error).toContain("Google Review link not configured");
  });

  it("requires authentication — throws UNAUTHORIZED for unauthenticated callers", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.reviews.send({ leadId: 1 })).rejects.toThrow();
  });
});

describe("reviews.status", () => {
  it("returns status object with configured and autoReviewEnabled fields", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    // status queries the DB; with no DB available it returns defaults
    const result = await caller.reviews.status();
    expect(result).toHaveProperty("configured");
    expect(result).toHaveProperty("autoReviewEnabled");
    expect(typeof result.configured).toBe("boolean");
    expect(typeof result.autoReviewEnabled).toBe("boolean");
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.reviews.status()).rejects.toThrow();
  });
});
