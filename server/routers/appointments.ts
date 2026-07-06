/**
 * appointments router — tRPC procedures for the scheduling system
 *
 * Procedures:
 *   appointments.list         — list all appointments (optionally filtered by week or lead)
 *   appointments.byLead       — list all appointments for a specific lead
 *   appointments.byId         — get a single appointment by ID
 *   appointments.create       — create appointment + trigger confirmation SMS/email
 *   appointments.update       — update appointment fields
 *   appointments.cancel       — cancel an appointment
 *   appointments.upcoming     — get appointments in the next N days (for dashboard)
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { appointments, leads } from "../../drizzle/schema";
import { eq, gte, lte, and, desc, asc } from "drizzle-orm";
import {
  createAppointment,
  updateAppointment,
  cancelAppointment,
  sendAppointmentReminder,
} from "../services/schedule";

// ─── Shared input schemas ─────────────────────────────────────────────────────

const appointmentStatusEnum = z.enum([
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

export const appointmentsRouter = router({
  /**
   * List all appointments, optionally filtered by a date range (week view).
   * Returns appointments joined with basic lead info for display.
   */
  list: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        leadId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const tenantId = ctx.user.id;

      // Build where conditions
      const conditions = [eq(appointments.tenantId, tenantId)];
      if (input?.from) conditions.push(gte(appointments.scheduledDate, input.from));
      if (input?.to) conditions.push(lte(appointments.scheduledDate, input.to));
      if (input?.leadId) conditions.push(eq(appointments.leadId, input.leadId));

      const apptRows = conditions.length > 0
        ? await db.select().from(appointments).where(and(...conditions)).orderBy(asc(appointments.scheduledDate))
        : await db.select().from(appointments).orderBy(asc(appointments.scheduledDate));

      if (apptRows.length === 0) return [];

      // Fetch associated leads for display names
      const leadIds = Array.from(new Set(apptRows.map((a) => a.leadId)));
      const leadRows = await db
        .select({
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          phone: leads.phone,
          email: leads.email,
          projectAddress: leads.projectAddress,
        })
        .from(leads)
        .where(
          leadIds.length === 1
            ? eq(leads.id, leadIds[0])
            : eq(leads.id, leadIds[0]) // fallback; full list fetched below
        );

      // Fetch all leads in batch if more than one
      const allLeadRows =
        leadIds.length > 1
          ? await db
              .select({
                id: leads.id,
                firstName: leads.firstName,
                lastName: leads.lastName,
                phone: leads.phone,
                email: leads.email,
                projectAddress: leads.projectAddress,
              })
              .from(leads)
              .where(eq(leads.tenantId, tenantId))
          : leadRows;

      const leadMap = new Map(allLeadRows.map((l) => [l.id, l]));

      return apptRows.map((appt) => ({
        ...appt,
        lead: leadMap.get(appt.leadId) ?? null,
      }));
    }),

  /** Get all appointments for a specific lead */
  byLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = ctx.user.id;
      return db
        .select()
        .from(appointments)
        .where(and(eq(appointments.leadId, input.leadId), eq(appointments.tenantId, tenantId)))
        .orderBy(desc(appointments.scheduledDate));
    }),

  /** Get a single appointment by ID */
  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = ctx.user.id;
      const rows = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, input.id), eq(appointments.tenantId, tenantId)))
        .limit(1);
      return rows[0] ?? null;
    }),

  /**
   * Create a new appointment.
   * Automatically triggers confirmation SMS and email if the lead has
   * phone/email on file and the respective flags are not explicitly disabled.
   */
  create: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        crewAssigned: z.string().optional(),
        jobType: z.string().optional(),
        scheduledDate: z.date(),
        timeSlot: z.string().optional(),
        notes: z.string().optional(),
        sendConfirmationSms: z.boolean().optional().default(true),
        sendConfirmationEmail: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return createAppointment({
        ...input,
        tenantId: tenantId,
        createdBy: ctx.user.id,
      });
    }),

  /** Update appointment fields */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        crewAssigned: z.string().optional(),
        jobType: z.string().optional(),
        scheduledDate: z.date().optional(),
        timeSlot: z.string().optional(),
        status: appointmentStatusEnum.optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const tenantId = ctx.user.id;
      // Verify appointment belongs to tenant before updating
      const appt = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, input.id), eq(appointments.tenantId, tenantId)))
        .limit(1);
      if (!appt[0]) throw new Error("Appointment not found or access denied");

      return updateAppointment(input);
    }),

  /** Cancel an appointment */
  cancel: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const tenantId = ctx.user.id;
      // Verify appointment belongs to tenant before cancelling
      const appt = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, input.id), eq(appointments.tenantId, tenantId)))
        .limit(1);
      if (!appt[0]) throw new Error("Appointment not found or access denied");

      return cancelAppointment(input.id, input.reason, ctx.user.id);
    }),

  /**
   * Get upcoming appointments in the next N days.
   * Used by the Dashboard "Upcoming Jobs" widget.
   */
  upcoming: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(7) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const tenantId = ctx.user.id;
      const now = new Date();
      const future = new Date(now.getTime() + input.days * 24 * 60 * 60 * 1000);

      const apptRows = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            gte(appointments.scheduledDate, now),
            lte(appointments.scheduledDate, future),
            // Exclude cancelled and no_show
            eq(appointments.status, "scheduled")
          )
        )
        .orderBy(asc(appointments.scheduledDate))
        .limit(20);

      if (apptRows.length === 0) return [];

      const leadIds = Array.from(new Set(apptRows.map((a) => a.leadId)));
      const allLeads = await db
        .select({
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          phone: leads.phone,
          projectAddress: leads.projectAddress,
        })
        .from(leads)
        .where(eq(leads.tenantId, tenantId));

      const leadMap = new Map(allLeads.map((l) => [l.id, l]));

      return apptRows.map((appt) => ({
        ...appt,
        lead: leadMap.get(appt.leadId) ?? null,
      }));
    }),

  /**
   * Send a 24-hour appointment reminder SMS to the customer.
   * SMS #2: Appointment Reminder — triggered manually or by a scheduled job.
   */
  sendReminder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const result = await sendAppointmentReminder(input.id, tenantId);
      return result;
    }),
});
