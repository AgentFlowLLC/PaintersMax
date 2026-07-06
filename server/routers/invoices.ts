/**
 * invoices router — tRPC procedures for the invoicing system
 *
 * Procedures:
 *   invoices.list        — list all invoices (optionally filtered by lead or status)
 *   invoices.byLead      — list all invoices for a specific lead
 *   invoices.byId        — get a single invoice by ID
 *   invoices.generate    — create a draft invoice with line items
 *   invoices.send        — generate Stripe link + send SMS + mark as "sent"
 *   invoices.markPaid    — manually mark an invoice as paid
 *   invoices.update      — update invoice fields (notes, dueDate, lineItems)
 *   invoices.delete      — delete a draft invoice
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { invoices, leads, appSettings } from "../../drizzle/schema";
import { eq, desc, and, lt, count } from "drizzle-orm";
import {
  generateInvoice,
  sendInvoice,
  markInvoicePaid,
} from "../services/invoices";
import { sendSMS } from "../services/sms";

/**
 * markOverdueInvoices — server-side function called by the daily cron job.
 * Queries all invoices where status='sent' and dueDate < now,
 * updates them to 'overdue', and sends an SMS reminder to the customer.
 * This is a system job, so it processes invoices across all tenants.
 */
export async function markOverdueInvoices(): Promise<{ marked: number; smsSent: number }> {
  const db = await getDb();
  if (!db) return { marked: 0, smsSent: 0 };

  const now = new Date();

  // Find all sent invoices past their due date
  const overdueRows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "sent"),
        lt(invoices.dueDate, now)
      )
    );

  if (overdueRows.length === 0) return { marked: 0, smsSent: 0 };

  // Fetch business name from settings
  const settingsRows = await db.select().from(appSettings).limit(1);
  const businessName = settingsRows[0]?.businessName ?? "Your painting contractor";

  let smsSent = 0;

  for (const invoice of overdueRows) {
    // Update status to overdue
    await db
      .update(invoices)
      .set({ status: "overdue" })
      .where(eq(invoices.id, invoice.id));

    // Fetch the lead for customer name and phone
    const leadRows = await db
      .select()
      .from(leads)
      .where(eq(leads.id, invoice.leadId))
      .limit(1);
    const lead = leadRows[0];
    if (!lead?.phone) continue;

    const customerName = `${lead.firstName} ${lead.lastName}`.trim();
    const totalFormatted = `$${parseFloat(invoice.total ?? "0").toFixed(2)}`;
    const payLink = invoice.stripePaymentLink ?? "";

    const smsBody = payLink
      ? `Hi ${customerName}, this is a reminder that your invoice of ${totalFormatted} from ${businessName} is past due. Please pay here: ${payLink}`
      : `Hi ${customerName}, this is a reminder that your invoice of ${totalFormatted} from ${businessName} is past due. Please contact us to arrange payment.`;

    try {
      await sendSMS(smsBody, lead.phone, invoice.leadId);
      smsSent++;
    } catch {
      // Non-fatal — continue processing other invoices
    }
  }

  return { marked: overdueRows.length, smsSent };
}

// ─── Shared schemas ───────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
});

const invoiceStatusEnum = z.enum(["draft", "sent", "paid", "overdue"]);

export const invoicesRouter = router({
  /** List all invoices, optionally filtered by leadId or status */
  list: protectedProcedure
    .input(
      z
        .object({
          leadId: z.number().optional(),
          status: invoiceStatusEnum.optional(),
          limit: z.number().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const tenantId = ctx.user.id;

      let rows;
      if (input?.leadId && input?.status) {
        rows = await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              eq(invoices.leadId, input.leadId),
              eq(invoices.status, input.status)
            )
          )
          .orderBy(desc(invoices.createdAt))
          .limit(input.limit);
      } else if (input?.leadId) {
        rows = await db
          .select()
          .from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.leadId, input.leadId)))
          .orderBy(desc(invoices.createdAt))
          .limit(input.limit);
      } else if (input?.status) {
        rows = await db
          .select()
          .from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, input.status)))
          .orderBy(desc(invoices.createdAt))
          .limit(input.limit);
      } else {
        rows = await db
          .select()
          .from(invoices)
          .where(eq(invoices.tenantId, tenantId))
          .orderBy(desc(invoices.createdAt))
          .limit(input?.limit ?? 50);
      }

      if (rows.length === 0) return [];

      // Join with lead names for display
      const allLeads = await db
        .select({
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          email: leads.email,
          phone: leads.phone,
        })
        .from(leads)
        .where(eq(leads.tenantId, tenantId));

      const leadMap = new Map(allLeads.map((l) => [l.id, l]));

      return rows.map((inv) => ({
        ...inv,
        lead: leadMap.get(inv.leadId) ?? null,
      }));
    }),

  /** Get all invoices for a specific lead */
  byLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = ctx.user.id;
      return db
        .select()
        .from(invoices)
        .where(and(eq(invoices.leadId, input.leadId), eq(invoices.tenantId, tenantId)))
        .orderBy(desc(invoices.createdAt));
    }),

  /** Get a single invoice by ID */
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = ctx.user.id;
      const rows = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.id), eq(invoices.tenantId, tenantId)))
        .limit(1);
      return rows[0] ?? null;
    }),

  /**
   * Generate a draft invoice with line items.
   * Calculates subtotal, tax, and total automatically.
   */
  generate: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
        taxRate: z.number().min(0).max(100).default(0),
        dueDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return generateInvoice({
        ...input,
        tenantId: tenantId,
        createdBy: ctx.user.id,
      });
    }),

  /**
   * Send an invoice to the customer:
   * - Creates a Stripe Payment Link
   * - Sends it via SMS
   * - Updates status to "sent"
   */
  send: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        sendSmsToCustomer: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Only verify tenant ownership if DB is available
      if (db) {
        const tenantId = ctx.user.id;
        const inv = await db
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, tenantId)))
          .limit(1);
        if (!inv[0]) throw new Error("Invoice not found or access denied");
      }

      return sendInvoice({
        invoiceId: input.invoiceId,
        sendSmsToCustomer: input.sendSmsToCustomer,
        createdBy: ctx.user.id,
      });
    }),

  /** Manually mark an invoice as paid */
  markPaid: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        stripeSessionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Only verify tenant ownership if DB is available
      if (db) {
        const tenantId = ctx.user.id;
        const inv = await db
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, tenantId)))
          .limit(1);
        if (!inv[0]) throw new Error("Invoice not found or access denied");
      }

      return markInvoicePaid(
        input.invoiceId,
        input.stripeSessionId,
        ctx.user.id
      );
    }),

  /** Update invoice fields (notes, dueDate, lineItems — only on draft invoices) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        lineItems: z.array(lineItemSchema).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        dueDate: z.date().optional().nullable(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tenantId = ctx.user.id;
      const rows = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.id), eq(invoices.tenantId, tenantId)))
        .limit(1);
      const invoice = rows[0];
      if (!invoice) throw new Error(`Invoice ${input.id} not found`);
      if (invoice.status !== "draft") {
        throw new Error("Only draft invoices can be edited");
      }

      const updateValues: Record<string, unknown> = {};

      if (input.notes !== undefined) updateValues.notes = input.notes;
      if (input.dueDate !== undefined) updateValues.dueDate = input.dueDate;

      if (input.lineItems) {
        const subtotal = input.lineItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0
        );
        const taxRate = input.taxRate ?? 0;
        const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;

        updateValues.lineItems = input.lineItems;
        updateValues.subtotal = subtotal.toFixed(2);
        updateValues.tax = tax.toFixed(2);
        updateValues.total = total.toFixed(2);
      }

      if (Object.keys(updateValues).length > 0) {
        await db
          .update(invoices)
          .set(updateValues)
          .where(eq(invoices.id, input.id));
      }

      const updated = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id))
        .limit(1);
      return updated[0] ?? invoice;
    }),

  /** Get count of overdue invoices for the sidebar badge */
  getOverdueCount: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return 0;
      const tenantId = ctx.user.id;
      const rows = await db
        .select({ cnt: count() })
        .from(invoices)
        .where(and(eq(invoices.status, "overdue"), eq(invoices.tenantId, tenantId)));
      return rows[0]?.cnt ?? 0;
    }),

  /** Delete a draft invoice */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tenantId = ctx.user.id;
      const rows = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.id), eq(invoices.tenantId, tenantId)))
        .limit(1);
      const invoice = rows[0];
      if (!invoice) throw new Error(`Invoice ${input.id} not found`);
      if (invoice.status !== "draft") {
        throw new Error("Only draft invoices can be deleted");
      }

      await db.delete(invoices).where(eq(invoices.id, input.id));
      return { success: true };
    }),

  /**
   * Stripe webhook handler — called from the Express webhook route.
   * Marks the invoice as paid when checkout.session.completed fires.
   * This is a public procedure because Stripe webhooks don't carry auth cookies.
   */
  webhookMarkPaid: publicProcedure
    .input(
      z.object({
        stripePaymentLinkId: z.string().optional(),
        stripeSessionId: z.string().optional(),
        invoiceId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      let invoiceRow;

      if (input.invoiceId) {
        const rows = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, input.invoiceId))
          .limit(1);
        invoiceRow = rows[0];
      } else if (input.stripePaymentLinkId) {
        const rows = await db
          .select()
          .from(invoices)
          .where(eq(invoices.stripePaymentLinkId, input.stripePaymentLinkId))
          .limit(1);
        invoiceRow = rows[0];
      }

      if (!invoiceRow) return { success: false, reason: "Invoice not found" };
      if (invoiceRow.status === "paid") return { success: true, alreadyPaid: true };

      await markInvoicePaid(invoiceRow.id, input.stripeSessionId);
      return { success: true };
    }),
});
