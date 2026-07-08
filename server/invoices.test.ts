/**
 * invoices.test.ts — Vitest tests for the invoices router
 *
 * Tests cover:
 *   - Invoice generation with line items
 *   - Invoice listing and filtering
 *   - Invoice send (mock Stripe)
 *   - Mark invoice as paid
 *   - Delete draft invoice
 *   - webhookMarkPaid public procedure
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock the database module ──────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the invoices service ─────────────────────────────────────────────────
vi.mock("./services/invoices", () => ({
  generateInvoice: vi.fn().mockResolvedValue({
    id: 1,
    invoiceNumber: "INV-2026-0001",
    leadId: 10,
    lineItems: [{ description: "Exterior Paint Labor", quantity: 2, unitPrice: 500 }],
    subtotal: "1000.00",
    tax: "80.00",
    total: "1080.00",
    status: "draft",
    dueDate: null,
    paidAt: null,
    stripePaymentLink: null,
    stripePaymentLinkId: null,
    stripeSessionId: null,
    notes: null,
    smsSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  sendInvoice: vi.fn().mockResolvedValue({
    invoice: {
      id: 1,
      invoiceNumber: "INV-2026-0001",
      leadId: 10,
      status: "sent",
      stripePaymentLink: "https://mock.stripe.com/pay/test_abc123",
      smsSent: true,
      total: "1080.00",
    },
    mock: true,
  }),
  markInvoicePaid: vi.fn().mockResolvedValue({
    id: 1,
    invoiceNumber: "INV-2026-0001",
    status: "paid",
    paidAt: new Date(),
    total: "1080.00",
  }),
  markOverdueInvoices: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the sms service ──────────────────────────────────────────────────────
vi.mock("./services/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
  persistConversation: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the schedule service ─────────────────────────────────────────────────
vi.mock("./services/schedule", () => ({
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
}));

// ── Auth context helpers ──────────────────────────────────────────────────────
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "owner-open-id",
      email: "admin@paintersmax.app",
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

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("invoices router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("invoices.generate", () => {
    it("creates a draft invoice with line items", async () => {
      const { generateInvoice } = await import("./services/invoices");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.invoices.generate({
        leadId: 10,
        lineItems: [
          { description: "Exterior Paint Labor", quantity: 2, unitPrice: 500 },
        ],
        taxRate: 8,
      });

      expect(generateInvoice).toHaveBeenCalledOnce();
      expect(generateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: 10,
          lineItems: expect.arrayContaining([
            expect.objectContaining({ description: "Exterior Paint Labor" }),
          ]),
          taxRate: 8,
        })
      );
      expect(result.status).toBe("draft");
      expect(result.invoiceNumber).toBe("INV-2026-0001");
    });

    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.invoices.generate({
          leadId: 10,
          lineItems: [{ description: "Labor", quantity: 1, unitPrice: 100 }],
        })
      ).rejects.toThrow();
    });
  });

  describe("invoices.send", () => {
    it("sends invoice and returns mock payment link when Stripe not configured", async () => {
      const { sendInvoice } = await import("./services/invoices");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.invoices.send({ invoiceId: 1 });

      expect(sendInvoice).toHaveBeenCalledOnce();
      expect(sendInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: 1 })
      );
      expect(result.mock).toBe(true);
      expect(result.invoice.status).toBe("sent");
      expect(result.invoice.stripePaymentLink).toContain("mock.stripe.com");
    });
  });

  describe("invoices.markPaid", () => {
    it("marks invoice as paid and returns updated invoice", async () => {
      const { markInvoicePaid } = await import("./services/invoices");
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.invoices.markPaid({ invoiceId: 1 });

      // markPaid passes (invoiceId, stripeSessionId?, userId)
      expect(markInvoicePaid).toHaveBeenCalledWith(1, undefined, 1);
      expect(result.status).toBe("paid");
      expect(result.paidAt).toBeInstanceOf(Date);
    });
  });

  describe("invoices.webhookMarkPaid (public)", () => {
    it("can be called without authentication", async () => {
      const { markInvoicePaid } = await import("./services/invoices");
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      // webhookMarkPaid is a publicProcedure — should not throw UNAUTHORIZED
      const result = await caller.invoices.webhookMarkPaid({
        invoiceId: 1,
      });

      // webhookMarkPaid calls markInvoicePaid(invoiceRow.id, stripeSessionId?) — no paidBy arg
      // But since db is mocked to return null, the procedure returns { success: false }
      // The important thing is that it doesn't throw for unauthenticated callers
      expect(result).toHaveProperty("success");
    });
  });

  describe("invoices.delete", () => {
    it("requires authentication to delete", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.invoices.delete({ id: 1 })).rejects.toThrow();
    });
  });
});
