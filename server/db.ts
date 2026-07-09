import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  Attachment,
  AutomationRule,
  CommunicationLog,
  EmailTemplate,
  InsertAttachment,
  InsertAutomationRule,
  InsertCommunicationLog,
  InsertEmailTemplate,
  InsertLead,
  InsertUser,
  Lead,
  attachments,
  automationRules,
  communicationLog,
  emailTemplates,
  leads,
  users,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, {
        ssl: "require",
        prepare: false,        // REQUIRED for Supabase Transaction Pooler (port 6543)
        max: 1,                // one connection per serverless instance — pooler handles the rest
        idle_timeout: 20,      // seconds — release unused connections quickly
        connect_timeout: 10,   // seconds — fail fast instead of hanging (matches CONNECT_TIMEOUT symptom)
      });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? null;
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(filters?: {
  stage?: string;
  search?: string;
  assignedTo?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(leads).$dynamic();

  const conditions = [];
  if (filters?.stage) {
    conditions.push(eq(leads.stage, filters.stage as Lead["stage"]));
  }
  if (filters?.search) {
    const s = `%${filters.search}%`;
    conditions.push(
      or(
        like(leads.firstName, s),
        like(leads.lastName, s),
        like(leads.email, s),
        like(leads.phone, s),
        like(leads.projectType, s)
      )
    );
  }
  if (filters?.assignedTo) {
    conditions.push(eq(leads.assignedTo, filters.assignedTo));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query.orderBy(desc(leads.updatedAt));
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

export async function createLead(data: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(leads).values(data);
  return result[0];
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(leads).where(eq(leads.id, id));
}

export async function getLeadsByStage() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads).orderBy(desc(leads.updatedAt));
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export async function getEmailTemplates(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailTemplates).where(eq(emailTemplates.tenantId, tenantId)).orderBy(desc(emailTemplates.updatedAt));
}

export async function getEmailTemplateById(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId))).limit(1);
  return result[0];
}

export async function createEmailTemplate(data: InsertEmailTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(emailTemplates).values(data);
}

export async function updateEmailTemplate(id: number, data: Partial<InsertEmailTemplate>, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(emailTemplates).set(data).where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)));
}

export async function deleteEmailTemplate(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)));
}

export async function getTemplatesByTriggerStage(stage: string, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailTemplates)
    .where(
      and(
        sql`${emailTemplates.triggerStage} = ${stage}`,
        eq(emailTemplates.isActive, true),
        eq(emailTemplates.tenantId, tenantId)
      )
    );
}

// ─── Automation Rules ─────────────────────────────────────────────────────────

export async function getAutomationRules(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationRules).where(eq(automationRules.tenantId, tenantId)).orderBy(desc(automationRules.updatedAt));
}

export async function getAutomationRuleById(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(automationRules).where(and(eq(automationRules.id, id), eq(automationRules.tenantId, tenantId))).limit(1);
  return result[0];
}

export async function createAutomationRule(data: InsertAutomationRule) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(automationRules).values(data);
}

export async function updateAutomationRule(id: number, data: Partial<InsertAutomationRule>, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(automationRules).set(data).where(and(eq(automationRules.id, id), eq(automationRules.tenantId, tenantId)));
}

export async function deleteAutomationRule(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(automationRules).where(and(eq(automationRules.id, id), eq(automationRules.tenantId, tenantId)));
}

export async function getRulesByTriggerStage(stage: string, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  const validStage = stage as NonNullable<AutomationRule["triggerStage"]>;
  return db
    .select()
    .from(automationRules)
    .where(
      and(
        sql`${automationRules.triggerStage} = ${validStage}`,
        eq(automationRules.isActive, true),
        eq(automationRules.triggerType, "stage_change"),
        eq(automationRules.tenantId, tenantId)
      )
    );
}

// ─── Communication Log ────────────────────────────────────────────────────────

export async function getCommunicationLog(filters?: {
  leadId?: number;
  type?: string;
  search?: string;
  tenantId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(communicationLog).$dynamic();
  const conditions = [];

  const tenantId = filters?.tenantId ?? 1;
  conditions.push(eq(communicationLog.tenantId, tenantId));

  if (filters?.leadId) {
    conditions.push(eq(communicationLog.leadId, filters.leadId));
  }
  if (filters?.type) {
    conditions.push(eq(communicationLog.type, filters.type as CommunicationLog["type"]));
  }
  if (filters?.search) {
    const s = `%${filters.search}%`;
    conditions.push(or(like(communicationLog.subject, s), like(communicationLog.content, s)));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query.orderBy(desc(communicationLog.sentAt));
}

export async function createCommunicationLogEntry(data: InsertCommunicationLog) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(communicationLog).values(data);
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function getAttachmentsByLeadId(leadId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(attachments)
    .where(and(eq(attachments.leadId, leadId), eq(attachments.tenantId, tenantId)))
    .orderBy(desc(attachments.createdAt));
}

export async function createAttachment(data: InsertAttachment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(attachments).values(data);
}

export async function deleteAttachment(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(attachments).where(and(eq(attachments.id, id), eq(attachments.tenantId, tenantId)));
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const allLeads = await db.select().from(leads).where(eq(leads.tenantId, tenantId));

  const stageCounts: Record<string, number> = {
    lead: 0,
    quoted: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    paid: 0,
  };

  let totalRevenue = 0;
  let paidRevenue = 0;
  let upcomingJobs: Lead[] = [];

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const lead of allLeads) {
    stageCounts[lead.stage] = (stageCounts[lead.stage] || 0) + 1;
    const val = parseFloat(String(lead.estimatedValue || "0"));
    totalRevenue += val;
    if (lead.stage === "paid") paidRevenue += val;
    if (
      lead.scheduledDate &&
      lead.scheduledDate >= now &&
      lead.scheduledDate <= nextWeek
    ) {
      upcomingJobs.push(lead);
    }
  }

  const recentActivity = await db
    .select()
    .from(communicationLog)
    .where(eq(communicationLog.tenantId, tenantId))
    .orderBy(desc(communicationLog.sentAt))
    .limit(10);

  return {
    totalLeads: allLeads.length,
    stageCounts,
    totalRevenue,
    paidRevenue,
    upcomingJobs: upcomingJobs.sort(
      (a, b) =>
        (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0)
    ),
    recentActivity,
  };
}

export async function seedDefaultTemplates() {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(emailTemplates).limit(1);
  if (existing.length > 0) return; // Already seeded

  const defaultTemplates: InsertEmailTemplate[] = [
    {
      name: "Welcome - New Lead",
      subject: "Welcome to {company_name} — Let's Get Started!",
      body: `<p>Hi {customer_name},</p>
<p>Thank you for reaching out to <strong>{company_name}</strong>! We're excited to help you with your {project_type} project.</p>
<p>To get started, we'd love to learn more about your project:</p>
<ul>
  <li>Project location: {project_address}</li>
  <li>Preferred start date</li>
  <li>Any specific requirements or concerns</li>
</ul>
<p>One of our team members will be in touch within 24 hours to schedule a free consultation.</p>
<p>Best regards,<br/><strong>{company_name}</strong></p>`,
      triggerStage: "lead",
      isActive: true,
      isDefault: true,
    },
    {
      name: "Quote Ready",
      subject: "Your Quote is Ready — {project_type} at {project_address}",
      body: `<p>Hi {customer_name},</p>
<p>Great news! We've prepared a detailed quote for your <strong>{project_type}</strong> project.</p>
<p><strong>Quote Summary:</strong></p>
<ul>
  <li>Project Address: {project_address}</li>
  <li>Estimated Value: <strong>{quote_amount}</strong></li>
  <li>Estimated Duration: {project_duration}</li>
</ul>
<p>Please review the attached quote document. If you have any questions or would like to make adjustments, don't hesitate to reach out.</p>
<p>To move forward, simply reply to this email or call us directly.</p>
<p>Best regards,<br/><strong>{company_name}</strong></p>`,
      triggerStage: "quoted",
      isActive: true,
      isDefault: true,
    },
    {
      name: "Job Scheduled Confirmation",
      subject: "Your {project_type} is Scheduled — {scheduled_date}",
      body: `<p>Hi {customer_name},</p>
<p>Your project is officially on the calendar! Here are the details:</p>
<p><strong>Job Details:</strong></p>
<ul>
  <li>Service: {project_type}</li>
  <li>Address: {project_address}</li>
  <li>Date: <strong>{scheduled_date}</strong></li>
  <li>Time: {scheduled_time}</li>
</ul>
<p>Our team will arrive within the scheduled window. Please ensure the work area is accessible.</p>
<p>A calendar invite has been sent to your email for easy reference.</p>
<p>Questions? Reply to this email or call us anytime.</p>
<p>Best regards,<br/><strong>{company_name}</strong></p>`,
      triggerStage: "scheduled",
      isActive: true,
      isDefault: true,
    },
    {
      name: "Project Completion & Payment",
      subject: "Project Complete — Final Invoice for {project_type}",
      body: `<p>Hi {customer_name},</p>
<p>We're pleased to let you know that your <strong>{project_type}</strong> project has been completed!</p>
<p><strong>Final Invoice:</strong></p>
<ul>
  <li>Project: {project_type} at {project_address}</li>
  <li>Total Amount: <strong>{quote_amount}</strong></li>
  <li>Remaining Balance: <strong>{remaining_balance}</strong></li>
</ul>
<p>You can pay securely online using the button below:</p>
<p><a href="{payment_link}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Pay Now</a></p>
<p>Thank you for choosing {company_name}. We hope you love the results!</p>
<p>Best regards,<br/><strong>{company_name}</strong></p>`,
      triggerStage: "completed",
      isActive: true,
      isDefault: true,
    },
    {
      name: "Follow-up & Review Request",
      subject: "How Did We Do? + Your Work Guarantee",
      body: `<p>Hi {customer_name},</p>
<p>It's been two weeks since we completed your <strong>{project_type}</strong> project, and we wanted to check in!</p>
<p><strong>Your Warranty:</strong> All work completed by {company_name} is covered by our <strong>2-year workmanship guarantee</strong>. If you notice any issues, contact us immediately and we'll make it right at no charge.</p>
<p>If you're happy with the results, we'd truly appreciate a quick review:</p>
<p><a href="{review_link}" style="background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Leave a Google Review</a></p>
<p>Your feedback helps us serve more homeowners like you!</p>
<p>Best regards,<br/><strong>{company_name}</strong></p>`,
      triggerStage: "paid",
      isActive: true,
      isDefault: true,
    },
  ];

  await db.insert(emailTemplates).values(defaultTemplates);

  // Seed default automation rules
  const templates = await db.select().from(emailTemplates);
  const templateMap: Record<string, number> = {};
  for (const t of templates) {
    if (t.triggerStage && t.triggerStage !== "manual") {
      templateMap[t.triggerStage] = t.id;
    }
  }

  const defaultRules: InsertAutomationRule[] = [];
  for (const [stage, templateId] of Object.entries(templateMap)) {
    defaultRules.push({
      name: `Auto-send on ${stage} stage`,
      triggerType: "stage_change",
      triggerStage: stage as AutomationRule["triggerStage"],
      delayHours: 0,
      templateId,
      isActive: true,
    });
  }

  if (defaultRules.length > 0) {
    await db.insert(automationRules).values(defaultRules);
  }
}