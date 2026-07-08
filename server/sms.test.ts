/**
 * sms.test.ts — Vitest tests for the SMS router and sms service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock the database ────────────────────────────────────────────────────────

const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    select: () => ({ from: () => ({ where: mockWhere }) }),
  }),
  // Required by routers.ts top-level call
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
  // Stub other db helpers used by routers
  getLeadById: vi.fn().mockResolvedValue(null),
  updateLead: vi.fn().mockResolvedValue(undefined),
  createCommunicationLogEntry: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock the sms service ─────────────────────────────────────────────────────

vi.mock("./services/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue({
    success: true,
    twilioSid: "SM_test_sid_123",
    status: "queued",
  }),
  persistConversation: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock ENV ─────────────────────────────────────────────────────────────────

vi.mock("./_core/env", () => ({
  ENV: {
    twilioAccountSid: "ACtest",
    twilioAuthToken: "test_auth_token",
    twilioPhoneNumber: "+15550001234",
    stripeSecretKey: "",
    appUrl: "https://test.example.com",
    appId: "",
    cookieSecret: "test_secret",
    databaseUrl: "",
    oAuthServerUrl: "",
    ownerOpenId: "",
    ownerName: "",
    isProduction: false,
    forgeApiUrl: "",
    forgeApiKey: "",
    twilioAccountSid2: "",
    twilioAuthToken2: "",
    twilioPhoneNumber2: "",
  },
}));

// ─── Test context factory ─────────────────────────────────────────────────────

function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("sms.status", () => {
  it("returns configured: true when Twilio env vars are set", async () => {
    const caller = appRouter.createCaller(createTestContext());
    const result = await caller.sms.status();
    expect(result.configured).toBe(true);
    expect(result.fromNumber).toBe("+15550001234");
  });
});

describe("sms.list", () => {
  it("returns an array of conversations for a lead", async () => {
    const caller = appRouter.createCaller(createTestContext());
    const result = await caller.sms.list({ leadId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("sms.send", () => {
  it("calls sendSMS and returns success result", async () => {
    const { sendSMS } = await import("./services/sms");
    const caller = appRouter.createCaller(createTestContext());

    const result = await caller.sms.send({
      leadId: 1,
      to: "+15559876543",
      message: "Your appointment is confirmed!",
    });

    expect(sendSMS).toHaveBeenCalledWith(
      "+15559876543",
      "Your appointment is confirmed!",
      1,
      1
    );
    expect(result.success).toBe(true);
    expect(result.twilioSid).toBe("SM_test_sid_123");
    expect(result.persisted).toBe(true);
  });

  it("rejects empty message body", async () => {
    const caller = appRouter.createCaller(createTestContext());
    await expect(
      caller.sms.send({ leadId: 1, to: "+15559876543", message: "" })
    ).rejects.toThrow();
  });

  it("rejects missing phone number", async () => {
    const caller = appRouter.createCaller(createTestContext());
    await expect(
      caller.sms.send({ leadId: 1, to: "", message: "Hello" })
    ).rejects.toThrow();
  });
});

describe("sendSMS service (unit)", () => {
  it("is exported from server/services/sms", async () => {
    const mod = await import("./services/sms");
    expect(typeof mod.sendSMS).toBe("function");
    expect(typeof mod.persistConversation).toBe("function");
  });
});
