/**
 * appointments.test.ts — Vitest tests for the appointments tRPC router
 *
 * Tests cover: list, byLead, byId, create, update, cancel, upcoming procedures.
 * All database and service calls are mocked so no real DB connection is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock database helpers ────────────────────────────────────────────────────

const mockAppointment = {
  id: 1,
  leadId: 10,
  crewAssigned: "Mike",
  jobType: "Exterior Paint",
  scheduledDate: new Date("2026-05-15T12:00:00Z"),
  timeSlot: "8:00 AM – 12:00 PM",
  status: "scheduled" as const,
  notes: "Use low-VOC paint",
  smsSent: false,
  emailSent: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 1,
};

const mockLead = {
  id: 10,
  firstName: "Jane",
  lastName: "Smith",
  phone: "+15551234567",
  email: "jane@example.com",
  projectAddress: "123 Main St",
  projectType: "Exterior Paint",
  stage: "scheduled" as const,
  estimatedValue: "2500.00",
  source: null,
  assignedTo: null,
  lastContactedAt: null,
  scheduledDate: null,
  completedDate: null,
  stripeCustomerId: null,
  stripeInvoiceId: null,
  stripePaymentLinkUrl: null,
  paidAt: null,
  calendarEventId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  projectDescription: null,
};

vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
  getDashboardStats: vi.fn(),
  getRulesByTriggerStage: vi.fn().mockResolvedValue([]),
  getTemplatesByTriggerStage: vi.fn().mockResolvedValue([]),
}));

vi.mock("./services/schedule", () => ({
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
}));

vi.mock("./services/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true, twilioSid: "SM123", status: "queued" }),
  persistConversation: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test context ─────────────────────────────────────────────────────────────

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "owner-open-id",
      name: "Test Admin",
      email: "admin@test.com",
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

describe("appointments.list", () => {
  it("returns empty array when db returns no rows", async () => {
    const { getDb } = await import("./db");
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn().mockReturnValue(mockSelect) } as any);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.list({});
    expect(result).toEqual([]);
  });
});

describe("appointments.byLead", () => {
  it("returns appointments for a given lead", async () => {
    const { getDb } = await import("./db");
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([mockAppointment]),
    };
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn().mockReturnValue(mockSelect) } as any);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.byLead({ leadId: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].leadId).toBe(10);
  });
});

describe("appointments.byId", () => {
  it("returns null when appointment not found", async () => {
    const { getDb } = await import("./db");
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn().mockReturnValue(mockSelect) } as any);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.byId({ id: 999 });
    expect(result).toBeNull();
  });

  it("returns the appointment when found", async () => {
    const { getDb } = await import("./db");
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockAppointment]),
    };
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn().mockReturnValue(mockSelect) } as any);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.byId({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.jobType).toBe("Exterior Paint");
  });
});

describe("appointments.create", () => {
  it("calls createAppointment service and returns result", async () => {
    const { createAppointment } = await import("./services/schedule");
    vi.mocked(createAppointment).mockResolvedValue({
      appointment: mockAppointment,
      smsSent: true,
      emailSent: false,
      smsError: undefined,
      emailError: undefined,
    });

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.create({
      leadId: 10,
      scheduledDate: new Date("2026-05-15T12:00:00Z"),
      jobType: "Exterior Paint",
      crewAssigned: "Mike",
      timeSlot: "8:00 AM – 12:00 PM",
      sendConfirmationSms: true,
      sendConfirmationEmail: false,
    });

    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 10,
        jobType: "Exterior Paint",
        crewAssigned: "Mike",
        createdBy: 1,
      })
    );
    expect(result.smsSent).toBe(true);
    expect(result.emailSent).toBe(false);
  });
});

describe("appointments.update", () => {
  it("calls updateAppointment service with correct fields", async () => {
    const { updateAppointment } = await import("./services/schedule");
    const updated = { ...mockAppointment, status: "confirmed" as const };
    vi.mocked(updateAppointment).mockResolvedValue(updated);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.update({ id: 1, status: "confirmed" });

    expect(updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, status: "confirmed" })
    );
    expect(result.status).toBe("confirmed");
  });
});

describe("appointments.cancel", () => {
  it("calls cancelAppointment service and returns cancelled appointment", async () => {
    const { cancelAppointment } = await import("./services/schedule");
    const cancelled = { ...mockAppointment, status: "cancelled" as const };
    vi.mocked(cancelAppointment).mockResolvedValue(cancelled);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.cancel({ id: 1, reason: "Customer rescheduled" });

    expect(cancelAppointment).toHaveBeenCalledWith(1, "Customer rescheduled", 1);
    expect(result.status).toBe("cancelled");
  });
});

describe("appointments.upcoming", () => {
  it("returns empty array when no upcoming appointments", async () => {
    const { getDb } = await import("./db");
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn().mockReturnValue(mockSelect) } as any);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.appointments.upcoming({ days: 7 });
    expect(result).toEqual([]);
  });
});
