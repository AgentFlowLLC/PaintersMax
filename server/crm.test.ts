import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ─────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getLeads: vi.fn().mockResolvedValue([]),
  getLeadById: vi.fn().mockResolvedValue(undefined),
  createLead: vi.fn().mockResolvedValue({ insertId: 42 }),
  updateLead: vi.fn().mockResolvedValue(undefined),
  deleteLead: vi.fn().mockResolvedValue(undefined),
  getLeadsByStage: vi.fn().mockResolvedValue([]),
  getEmailTemplates: vi.fn().mockResolvedValue([]),
  getEmailTemplateById: vi.fn().mockResolvedValue(undefined),
  createEmailTemplate: vi.fn().mockResolvedValue(undefined),
  updateEmailTemplate: vi.fn().mockResolvedValue(undefined),
  deleteEmailTemplate: vi.fn().mockResolvedValue(undefined),
  getTemplatesByTriggerStage: vi.fn().mockResolvedValue([]),
  getAutomationRules: vi.fn().mockResolvedValue([]),
  getAutomationRuleById: vi.fn().mockResolvedValue(undefined),
  createAutomationRule: vi.fn().mockResolvedValue(undefined),
  updateAutomationRule: vi.fn().mockResolvedValue(undefined),
  deleteAutomationRule: vi.fn().mockResolvedValue(undefined),
  getRulesByTriggerStage: vi.fn().mockResolvedValue([]),
  getCommunicationLog: vi.fn().mockResolvedValue([]),
  createCommunicationLogEntry: vi.fn().mockResolvedValue(undefined),
  getAttachmentsByLeadId: vi.fn().mockResolvedValue([]),
  createAttachment: vi.fn().mockResolvedValue(undefined),
  deleteAttachment: vi.fn().mockResolvedValue(undefined),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalLeads: 5,
    stageCounts: { lead: 2, quoted: 1, scheduled: 1, in_progress: 0, completed: 1, paid: 0 },
    totalRevenue: 15000,
    paidRevenue: 5000,
    upcomingJobs: [],
    recentActivity: [],
  }),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/file.pdf", key: "file.pdf" }),
}));

import * as db from "./db";

// ─── Test Context ─────────────────────────────────────────────────────────────
function createTestCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
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
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth", () => {
  it("me returns the current user", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toMatchObject({ id: 1, email: "test@example.com" });
  });

  it("logout clears session cookie and returns success", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

// ─── Leads Tests ─────────────────────────────────────────────────────────────
describe("leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getLeads).mockResolvedValue([]);
    vi.mocked(db.getLeadsByStage).mockResolvedValue([]);
    vi.mocked(db.getLeadById).mockResolvedValue(undefined);
    vi.mocked(db.createLead).mockResolvedValue({ insertId: 42 } as ReturnType<typeof db.createLead> extends Promise<infer T> ? T : never);
    vi.mocked(db.updateLead).mockResolvedValue(undefined);
    vi.mocked(db.deleteLead).mockResolvedValue(undefined);
    vi.mocked(db.createCommunicationLogEntry).mockResolvedValue(undefined);
    vi.mocked(db.getRulesByTriggerStage).mockResolvedValue([]);
    vi.mocked(db.seedDefaultTemplates).mockResolvedValue(undefined);
  });

  it("list returns empty array when no leads", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.list();
    expect(result).toEqual([]);
  });

  it("kanban returns all six stage buckets", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.kanban();
    expect(Object.keys(result)).toEqual(["lead", "quoted", "scheduled", "in_progress", "completed", "paid"]);
    expect(result.lead).toEqual([]);
  });

  it("create creates a lead and logs creation", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.leads.create({
      firstName: "John",
      lastName: "Smith",
      email: "john@example.com",
      phone: "555-1234",
      projectType: "Interior Painting",
      projectAddress: "123 Main St",
      estimatedValue: "3500",
    });
    expect(db.createLead).toHaveBeenCalledOnce();
    expect(db.createCommunicationLogEntry).toHaveBeenCalledOnce();
  });

  it("update calls updateLead with correct id and data", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.leads.update({ id: 1, data: { firstName: "Jane" } });
    expect(db.updateLead).toHaveBeenCalledWith(1, expect.objectContaining({ firstName: "Jane" }));
  });

  it("updateStage logs stage change", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue({
      id: 1, firstName: "John", lastName: "Smith", stage: "lead",
      email: "j@example.com", phone: null, projectType: "Painting",
      projectAddress: "123 Main", estimatedValue: "2000",
      stripePaymentLinkUrl: null, scheduledDate: null,
      createdAt: new Date(), updatedAt: new Date(),
      createdBy: 1, assignedTo: null, source: null,
      lastContactedAt: null, completedDate: null, paidAt: null,
      calendarEventId: null, stripeCustomerId: null, stripeInvoiceId: null,
      projectDescription: null,
    });
    vi.mocked(db.getRulesByTriggerStage).mockResolvedValue([]);

    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.updateStage({ id: 1, stage: "quoted" });
    expect(result).toEqual({ success: true });
    expect(db.updateLead).toHaveBeenCalledWith(1, expect.objectContaining({ stage: "quoted" }));
    expect(db.createCommunicationLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "system", subject: "Stage Updated" })
    );
  });

  it("delete calls deleteLead with correct id", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.leads.delete({ id: 5 });
    expect(db.deleteLead).toHaveBeenCalledWith(5);
  });
});

// ─── Email Templates Tests ────────────────────────────────────────────────────
describe("emailTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getEmailTemplates).mockResolvedValue([]);
    vi.mocked(db.createEmailTemplate).mockResolvedValue(undefined);
    vi.mocked(db.updateEmailTemplate).mockResolvedValue(undefined);
    vi.mocked(db.deleteEmailTemplate).mockResolvedValue(undefined);
    vi.mocked(db.getAutomationRules).mockResolvedValue([]);
    vi.mocked(db.seedDefaultTemplates).mockResolvedValue(undefined);
  });

  it("list returns empty array when no templates", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.emailTemplates.list();
    expect(result).toEqual([]);
  });

  it("create creates a template", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.emailTemplates.create({
      name: "Test Template",
      subject: "Hello {customer_name}",
      body: "<p>Hi {customer_name}</p>",
      triggerStage: "lead",
      isActive: true,
    });
    expect(db.createEmailTemplate).toHaveBeenCalledOnce();
  });

  it("update updates a template", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.emailTemplates.update({ id: 1, data: { name: "Updated", subject: "New Subject", body: "<p>Body</p>" } });
    expect(db.updateEmailTemplate).toHaveBeenCalledWith(1, expect.objectContaining({ name: "Updated" }), 1);
  });

  it("delete deletes a template", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.emailTemplates.delete({ id: 3 });
    expect(db.deleteEmailTemplate).toHaveBeenCalledWith(3, 1);
  });
});

// ─── Automation Rules Tests ───────────────────────────────────────────────────
describe("automationRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAutomationRules).mockResolvedValue([]);
    vi.mocked(db.createAutomationRule).mockResolvedValue(undefined);
    vi.mocked(db.deleteAutomationRule).mockResolvedValue(undefined);
    vi.mocked(db.getEmailTemplates).mockResolvedValue([]);
    vi.mocked(db.seedDefaultTemplates).mockResolvedValue(undefined);
  });

  it("list returns empty array when no rules", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.automationRules.list();
    expect(result).toEqual([]);
  });

  it("create creates an automation rule", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.automationRules.create({
      name: "Quote Email",
      triggerType: "stage_change",
      triggerStage: "quoted",
      delayHours: 0,
      templateId: 1,
      isActive: true,
    });
    expect(db.createAutomationRule).toHaveBeenCalledOnce();
  });
});

// ─── Dashboard Tests ───────────────────────────────────────────────────────────────────
// The dashboard router now calls getDb() directly and runs SQL aggregates
// instead of delegating to getDashboardStats(). In tests, getDb() returns null,
// so the procedure returns null gracefully.
describe("dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getDb).mockResolvedValue(null);
    vi.mocked(db.seedDefaultTemplates).mockResolvedValue(undefined);
  });

  it("stats returns null when DB is unavailable", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();
    // getDb() returns null → router returns null gracefully
    expect(result).toBeNull();
  });
});

// ─── Communications Tests ─────────────────────────────────────────────────────
describe("communications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getCommunicationLog).mockResolvedValue([]);
    vi.mocked(db.createCommunicationLogEntry).mockResolvedValue(undefined);
    vi.mocked(db.getLeadById).mockResolvedValue(undefined);
    vi.mocked(db.seedDefaultTemplates).mockResolvedValue(undefined);
  });

  it("list returns empty array when no logs", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.communications.list();
    expect(result).toEqual([]);
  });

  it("create logs a communication entry", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.communications.create({
      leadId: 1,
      type: "note",
      content: "Called customer, left voicemail",
    });
    expect(result).toEqual({ success: true });
    expect(db.createCommunicationLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 1, type: "note" })
    );
  });
});

// ─── Settings Tests ───────────────────────────────────────────────────────────
describe("settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getDb).mockResolvedValue(null);
    vi.mocked(db.seedDefaultTemplates).mockResolvedValue(undefined);
  });

  it("get returns default settings when DB unavailable", async () => {
    const ctx = createTestCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.get();
    expect(result).toMatchObject({
      stripeEnabled: false,
      calendarEnabled: false,
    });
  });
});
