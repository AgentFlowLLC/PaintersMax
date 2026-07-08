import { z } from "zod";
import { paidProcedure, router } from "../_core/trpc";
import {
  createLead,
  createCommunicationLogEntry,
  deleteLead,
  getLeadById,
  getLeads,
  getLeadsByStage,
  getRulesByTriggerStage,
  getEmailTemplateById,
  updateLead,
} from "../db";
import { scheduleReviewRequest } from "../services/reviews";
import { sendNewLeadNotification, sendQuoteEmail } from "../services/email";
import { sendJobCompletionEmail } from "../lib/email";
import { sendNewLeadSMS, sendJobCompletionSMS } from "../lib/sms";
import { getDb } from "../db";
import { appSettings, leads } from "../../drizzle/schema";
import { eq, and, or, like, desc } from "drizzle-orm";
import { ENV } from "../_core/env";

const stageEnum = z.enum([
  "lead",
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "paid",
]);

const leadInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  projectType: z.string().optional(),
  projectAddress: z.string().optional(),
  projectDescription: z.string().optional(),
  estimatedValue: z.string().optional(),
  source: z.string().optional(),
  stage: stageEnum.optional(),
  scheduledDate: z.string().optional(),
});

function interpolateTemplate(body: string, lead: Record<string, unknown>): string {
  return body
    .replace(/\{customer_name\}/g, `${lead.firstName} ${lead.lastName}`)
    .replace(/\{first_name\}/g, String(lead.firstName || ""))
    .replace(/\{last_name\}/g, String(lead.lastName || ""))
    .replace(/\{project_type\}/g, String(lead.projectType || "your project"))
    .replace(/\{project_address\}/g, String(lead.projectAddress || ""))
    .replace(/\{quote_amount\}/g, lead.estimatedValue ? `$${lead.estimatedValue}` : "TBD")
    .replace(/\{remaining_balance\}/g, lead.estimatedValue ? `$${lead.estimatedValue}` : "TBD")
    .replace(/\{payment_link\}/g, String(lead.stripePaymentLinkUrl || "#"))
    .replace(/\{scheduled_date\}/g, lead.scheduledDate ? new Date(lead.scheduledDate as string).toLocaleDateString() : "TBD")
    .replace(/\{scheduled_time\}/g, lead.scheduledDate ? new Date(lead.scheduledDate as string).toLocaleTimeString() : "TBD")
    .replace(/\{company_name\}/g, "Your Company")
    .replace(/\{review_link\}/g, "#")
    .replace(/\{project_duration\}/g, "1-3 days");
}

export const leadsRouter = router({
  list: paidProcedure
    .input(
      z.object({
        stage: stageEnum.optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const tenantId = ctx.user.id;
      let query = db.select().from(leads).$dynamic();

      const conditions = [eq(leads.tenantId, tenantId)];
      if (input?.stage) {
        conditions.push(eq(leads.stage, input.stage as any));
      }
      if (input?.search) {
        const s = `%${input.search}%`;
        const searchCondition = or(
          like(leads.firstName, s),
          like(leads.lastName, s),
          like(leads.email, s),
          like(leads.phone, s),
          like(leads.projectType, s)
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      query = query.where(and(...conditions));
      return query.orderBy(desc(leads.updatedAt));
    }),

  kanban: paidProcedure.query(async ({ ctx }) => {
    const stages: Record<string, any[]> = {
      lead: [],
      quoted: [],
      scheduled: [],
      in_progress: [],
      completed: [],
      paid: [],
    };

    const db = await getDb();
    if (!db) return stages;

    const tenantId = ctx.user.id;
    const all = await db
      .select()
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .orderBy(desc(leads.updatedAt));

    for (const lead of all) {
      if (stages[lead.stage]) stages[lead.stage].push(lead);
    }
    return stages;
  }),

  byId: paidProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return undefined;

      const tenantId = ctx.user.id;
      const result = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.id), eq(leads.tenantId, tenantId)))
        .limit(1);
      return result[0];
    }),

  create: paidProcedure
    .input(leadInput)
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const data = {
        ...input,
        estimatedValue: input.estimatedValue || undefined,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
        createdBy: ctx.user.id,
        tenantId: tenantId,
        lastContactedAt: new Date(),
      };
      const result = await createLead(data);
      const newLeadId = (result as { id?: number; insertId?: number })?.id
        || (result as { insertId?: number })?.insertId
        || 0;

      // Log creation
      await createCommunicationLogEntry({
        leadId: newLeadId,
        type: "system",
        direction: "internal",
        subject: "Lead Created",
        content: `New lead created: ${input.firstName} ${input.lastName}`,
        sentBy: ctx.user.id,
      });

      // ── Fetch settings once for both email and SMS notifications ──
      const db2 = await getDb();
      let businessName = "PaintersMax";
      let ownerPhone: string | undefined;
      if (db2) {
        try {
          const settingsRows = await db2
            .select({ businessName: appSettings.businessName })
            .from(appSettings)
            .limit(1);
          businessName = settingsRows[0]?.businessName || businessName;
        } catch { /* non-fatal */ }
      }

      // Send new lead notification email to business owner (non-fatal)
      try {
        const ownerEmail = ENV.ownerEmail;
        if (ownerEmail) {
          await sendNewLeadNotification({
            leadFirstName: input.firstName,
            leadLastName: input.lastName,
            leadEmail: input.email || null,
            leadPhone: input.phone || null,
            leadSource: input.source || null,
            estimatedValue: input.estimatedValue || null,
            notes: input.projectDescription || null,
            ownerEmail,
            businessName,
          });
        }
      } catch (emailErr) {
        console.warn("[Leads] Failed to send new lead notification email:", (emailErr as Error).message);
      }

      // ── SMS #1: New Lead → Business Owner ──
      // Owner phone is read from OWNER_PHONE env var (set in Vercel/env)
      try {
        ownerPhone = process.env.OWNER_PHONE;
        if (ownerPhone) {
          await sendNewLeadSMS({
            ownerPhone,
            leadName: `${input.firstName} ${input.lastName}`.trim(),
            leadPhone: input.phone || null,
            leadSource: input.source || null,
          });
        }
      } catch (smsErr) {
        console.warn("[Leads] Failed to send new lead SMS:", (smsErr as Error).message);
      }

      return result;
    }),

  update: paidProcedure
    .input(z.object({ id: z.number(), data: leadInput.partial() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Only verify tenant ownership if DB is available
      if (db) {
        const tenantId = ctx.user.id;
        const lead = await db
          .select()
          .from(leads)
          .where(and(eq(leads.id, input.id), eq(leads.tenantId, tenantId)))
          .limit(1);
        if (!lead[0]) throw new Error("Lead not found or access denied");
      }

      const data = {
        ...input.data,
        scheduledDate: input.data.scheduledDate
          ? new Date(input.data.scheduledDate)
          : undefined,
      };
      await updateLead(input.id, data);
      return { success: true };
    }),

  updateStage: paidProcedure
    .input(z.object({ id: z.number(), stage: stageEnum }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      let lead: (typeof leads.$inferSelect) | undefined;

      // Only verify tenant ownership if DB is available
      if (db) {
        const tenantId = ctx.user.id;
        const leadResult = await db
          .select()
          .from(leads)
          .where(and(eq(leads.id, input.id), eq(leads.tenantId, tenantId)))
          .limit(1);
        lead = leadResult[0];
        if (!lead) throw new Error("Lead not found or access denied");
      }

      const updateData: Record<string, unknown> = {
        stage: input.stage,
        lastContactedAt: new Date(),
      };

      if (input.stage === "completed") updateData.completedDate = new Date();
      if (input.stage === "paid") updateData.paidAt = new Date();

      await updateLead(input.id, updateData);

      // Log stage change
      await createCommunicationLogEntry({
        leadId: input.id,
        type: "system",
        direction: "internal",
        subject: "Stage Updated",
        content: lead
          ? `Stage changed from "${lead.stage}" to "${input.stage}"`
          : `Stage changed to "${input.stage}"`,
        sentBy: ctx.user.id,
      });

      // Fire automation rules
      const tenantId = ctx.user.id;
      const rules = await getRulesByTriggerStage(input.stage, tenantId);
      for (const rule of rules) {
        if (rule.delayHours && rule.delayHours > 0) continue; // Skip delayed for now
        const template = await getEmailTemplateById(rule.templateId, tenantId);
        if (!template) continue;

        const leadRecord = lead ? { ...lead, ...updateData } : updateData;
        const interpolatedBody = interpolateTemplate(template.body, leadRecord);
        const interpolatedSubject = interpolateTemplate(template.subject, leadRecord);

        await createCommunicationLogEntry({
          leadId: input.id,
          type: "email",
          direction: "outbound",
          subject: interpolatedSubject,
          content: interpolatedBody,
          templateId: template.id,
          automationRuleId: rule.id,
          sentBy: ctx.user.id,
        });
      }

      // ── Send quote email when stage moves to 'quoted' ──
      if (input.stage === "quoted" && lead?.email) {
        try {
          const db = await getDb();
          let businessName = "PaintersMax";
          if (db) {
            const settingsRows = await db
              .select({ businessName: appSettings.businessName })
              .from(appSettings)
              .limit(1);
            businessName = settingsRows[0]?.businessName || businessName;
          }
          const customerName = `${lead.firstName} ${lead.lastName}`.trim();
          const quoteAmount = lead.estimatedValue
            ? `$${parseFloat(String(lead.estimatedValue)).toFixed(2)}`
            : "TBD";
          await sendQuoteEmail({
            customerName,
            customerEmail: lead.email,
            quoteAmount,
            jobDescription: lead.projectDescription || lead.projectType || undefined,
            businessName,
            notes: lead.projectDescription || null,
          });
        } catch (emailErr) {
          console.warn("[Leads] Failed to send quote email:", (emailErr as Error).message);
        }
      }

      // ── Auto-trigger Google Review request + SMS when stage moves to 'completed' ──
      if (input.stage === "completed") {
        try {
          const db = await getDb();
          if (db) {
            const settingsRows = await db
              .select({
                autoReviewEnabled: appSettings.autoReviewEnabled,
                businessName: appSettings.businessName,
                googleReviewLink: appSettings.googleReviewLink,
              })
              .from(appSettings)
              .limit(1);
            const autoEnabled = settingsRows[0]?.autoReviewEnabled ?? false;
            if (autoEnabled) {
              // Schedule review request 2 hours after job completion
              scheduleReviewRequest(input.id, 2 * 60 * 60 * 1000, ctx.user.id);
            }
            const bName = settingsRows[0]?.businessName || "PaintersMax";
            const reviewLink = settingsRows[0]?.googleReviewLink || undefined;

            // Send job completion email to customer (non-fatal)
            if (lead && lead.email) {
              try {
                await sendJobCompletionEmail({
                  customerName: `${lead.firstName} ${lead.lastName}`.trim(),
                  customerEmail: lead.email,
                  businessName: bName,
                  jobDescription: lead.projectDescription || lead.projectType || undefined,
                  completionDate: new Date().toLocaleDateString(),
                  googleReviewLink: reviewLink,
                });
              } catch (completionEmailErr) {
                console.warn("[Leads] Failed to send job completion email:", (completionEmailErr as Error).message);
              }
            }

            // ── SMS #4: Job Completion → Customer ──
            if (lead && lead.phone) {
              try {
                await sendJobCompletionSMS({
                  customerPhone: lead.phone,
                  businessName: bName,
                  googleReviewLink: reviewLink,
                });
              } catch (completionSmsErr) {
                console.warn("[Leads] Failed to send job completion SMS:", (completionSmsErr as Error).message);
              }
            }
          }
        } catch (reviewErr) {
          // Non-fatal — log but don't block the stage update
          console.warn("[Leads] Failed to schedule review request:", (reviewErr as Error).message);
        }
      }

      return { success: true };
    }),

  delete: paidProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Only verify tenant ownership if DB is available
      if (db) {
        const tenantId = ctx.user.id;
        const lead = await db
          .select()
          .from(leads)
          .where(and(eq(leads.id, input.id), eq(leads.tenantId, tenantId)))
          .limit(1);
        if (!lead[0]) throw new Error("Lead not found or access denied");
      }

      await deleteLead(input.id);
      return { success: true };
    }),
});
