/**
 * Tests for overdue invoice alerts:
 *   - markOverdueInvoices() — marks sent invoices past due date as overdue, sends SMS
 *   - invoices.getOverdueCount — returns count of overdue invoices
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock db module ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock sms service ─────────────────────────────────────────────────────────
vi.mock("./services/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
}));

// ─── Mock routes/stripeWebhook ────────────────────────────────────────────────
vi.mock("./routes/stripeWebhook", () => ({
  registerStripeWebhook: vi.fn(),
}));

// ─── Mock services/invoices ───────────────────────────────────────────────────
vi.mock("./services/invoices", () => ({
  generateInvoice: vi.fn(),
  sendInvoice: vi.fn(),
  markInvoicePaid: vi.fn(),
}));

import { getDb } from "./db";
import { sendSMS } from "./services/sms";
import { markOverdueInvoices } from "./routers/invoices";
import { appRouter } from "./routers";

const mockGetDb = vi.mocked(getDb);
const mockSendSMS = vi.mocked(sendSMS);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

const makeInvoice = (overrides = {}) => ({
  id: 1,
  leadId: 10,
  invoiceNumber: "INV-001",
  status: "sent" as const,
  total: "500.00",
  dueDate: yesterday,
  stripePaymentLink: "https://buy.stripe.com/test_abc",
  stripePaymentLinkId: null,
  lineItems: [],
  subtotal: "500.00",
  tax: "0.00",
  notes: null,
  paidAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeLead = (overrides = {}) => ({
  id: 10,
  firstName: "John",
  lastName: "Doe",
  phone: "+15551234567",
  email: "john@example.com",
  ...overrides,
});

/**
 * Build a mock db that returns results in sequence.
 * The actual query chain for markOverdueInvoices is:
 *   1. db.select().from(invoices).where(and(eq, lt))  → overdueRows
 *   2. db.select().from(appSettings).limit(1)         → settingsRows
 *   3. (per invoice) db.update().set().where()        → void
 *   4. (per invoice) db.select().from(leads).where().limit(1) → leadRows
 */
function buildMockDb(overdueInvoices: object[], leads: object[], businessName = "PaintersMax") {
  let selectCallIndex = 0;
  const selectResults = [
    overdueInvoices,                     // call 0: overdue invoices
    [{ businessName }],                  // call 1: settings
    ...leads.map(l => [l]),              // calls 2+: one per invoice
  ];

  const makeChain = (result: object[]) => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(result)),
        then: (resolve: (v: object[]) => void) => Promise.resolve(result).then(resolve),
        [Symbol.toStringTag]: "Promise",
      })),
      limit: vi.fn(() => Promise.resolve(result)),
      // Allow direct await (no .where())
      then: (resolve: (v: object[]) => void) => Promise.resolve(result).then(resolve),
      [Symbol.toStringTag]: "Promise",
    })),
  });

  return {
    select: vi.fn(() => {
      const result = selectResults[selectCallIndex++] ?? [];
      return makeChain(result);
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("markOverdueInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { marked: 0, smsSent: 0 } when db is unavailable", async () => {
    mockGetDb.mockResolvedValue(null as never);
    const result = await markOverdueInvoices();
    expect(result).toEqual({ marked: 0, smsSent: 0 });
  });

  it("returns { marked: 0, smsSent: 0 } when no overdue invoices exist", async () => {
    // Return empty array for the overdue invoices query
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      })),
      update: vi.fn(),
    };
    mockGetDb.mockResolvedValue(db as never);
    const result = await markOverdueInvoices();
    expect(result).toEqual({ marked: 0, smsSent: 0 });
  });

  it("marks 1 overdue invoice and sends SMS when lead has phone", async () => {
    const invoice = makeInvoice();
    const lead = makeLead();
    const db = buildMockDb([invoice], [lead]);
    mockGetDb.mockResolvedValue(db as never);

    const result = await markOverdueInvoices();
    expect(result.marked).toBe(1);
    expect(mockSendSMS).toHaveBeenCalledOnce();
    // sendSMS(body, phone, leadId) — positional args
    const [body, toPhone] = mockSendSMS.mock.calls[0] as [string, string, number];
    expect(toPhone).toBe(lead.phone);
    expect(body).toContain("John Doe");
    expect(body).toContain("500.00");
  });

  it("skips SMS when lead has no phone", async () => {
    const invoice = makeInvoice();
    const leadNoPhone = makeLead({ phone: null });
    const db = buildMockDb([invoice], [leadNoPhone]);
    mockGetDb.mockResolvedValue(db as never);

    const result = await markOverdueInvoices();
    expect(result.marked).toBe(1);
    expect(result.smsSent).toBe(0);
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it("handles multiple overdue invoices", async () => {
    const invoice1 = makeInvoice({ id: 1, leadId: 10 });
    const invoice2 = makeInvoice({ id: 2, leadId: 11 });
    const lead1 = makeLead({ id: 10, phone: "+15551111111" });
    const lead2 = makeLead({ id: 11, phone: "+15552222222" });
    const db = buildMockDb([invoice1, invoice2], [lead1, lead2]);
    mockGetDb.mockResolvedValue(db as never);

    const result = await markOverdueInvoices();
    expect(result.marked).toBe(2);
    expect(mockSendSMS).toHaveBeenCalledTimes(2);
  });
});

describe("invoices.getOverdueCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when db is unavailable", async () => {
    mockGetDb.mockResolvedValue(null as never);
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test", email: "test@test.com", role: "admin", subscriptionStatus: "active" },
      req: {} as never,
      res: {} as never,
    });
    const count = await caller.invoices.getOverdueCount();
    expect(count).toBe(0);
  });

  it("returns the count of overdue invoices", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ cnt: 3 }])),
        })),
      })),
    };
    mockGetDb.mockResolvedValue(db as never);
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test", email: "test@test.com", role: "admin", subscriptionStatus: "active" },
      req: {} as never,
      res: {} as never,
    });
    const count = await caller.invoices.getOverdueCount();
    expect(count).toBe(3);
  });

  it("returns 0 when no overdue invoices exist", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
      })),
    };
    mockGetDb.mockResolvedValue(db as never);
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test", email: "test@test.com", role: "admin", subscriptionStatus: "active" },
      req: {} as never,
      res: {} as never,
    });
    const count = await caller.invoices.getOverdueCount();
    expect(count).toBe(0);
  });
});
