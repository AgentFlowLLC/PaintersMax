import {
  serial,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const leadStageEnum = pgEnum("lead_stage", [
  "lead",
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "paid",
]);

export const templateTriggerStageEnum = pgEnum("template_trigger_stage", [
  "lead",
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "paid",
  "manual",
]);

export const automationTriggerTypeEnum = pgEnum("automation_trigger_type", [
  "stage_change",
  "scheduled",
  "manual",
  "days_after_stage",
]);

export const communicationTypeEnum = pgEnum("communication_type", [
  "email",
  "call",
  "note",
  "sms",
  "system",
]);

export const communicationDirectionEnum = pgEnum("communication_direction", [
  "inbound",
  "outbound",
  "internal",
]);

export const conversationDirectionEnum = pgEnum("conversation_direction", [
  "inbound",
  "outbound",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
]);

export const crewStatusEnum = pgEnum("crew_status", ["active", "inactive"]);

export const photoTypeEnum = pgEnum("photo_type", ["before", "after"]);

export const blogStatusEnum = pgEnum("blog_status", [
  "draft",
  "published",
  "archived",
]);

// ─── Users (Auth) ────────────────────────────────────────────────────────────
// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  businessName: varchar("businessName", { length: 200 }).notNull(),
  industry: varchar("industry", { length: 100 }).notNull().default("painting"),
  subdomain: varchar("subdomain", { length: 100 }).notNull().unique(),
  customDomain: varchar("customDomain", { length: 255 }).unique(),
  plan: varchar("plan", { length: 50 }).notNull().default("starter"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  billingStatus: varchar("billingStatus", { length: 50 }).notNull().default("active"),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 20 }),
  secondaryColor: varchar("secondaryColor", { length: 20 }),
  brandName: varchar("brandName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export const tenantIntegrations = pgTable("tenant_integrations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  service: varchar("service", { length: 100 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("shared"),
  apiKeyEncrypted: text("apiKeyEncrypted"),
  configJson: text("configJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TenantIntegration = typeof tenantIntegrations.$inferSelect;
export type InsertTenantIntegration = typeof tenantIntegrations.$inferInsert;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // ─── Subscription billing ─────────────────────────────────────────────────
  subscriptionTier: text("subscription_tier").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionStatus: text("subscription_status").default("inactive").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Leads ───────────────────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").default(1).notNull(),
  // Contact info
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  // Project info
  projectType: varchar("projectType", { length: 100 }),
  projectAddress: text("projectAddress"),
  projectDescription: text("projectDescription"),
  estimatedValue: decimal("estimatedValue", { precision: 10, scale: 2 }),
  // Pipeline
  stage: leadStageEnum("stage").default("lead").notNull(),
  // Metadata
  source: varchar("source", { length: 100 }),
  assignedTo: integer("assignedTo"),
  lastContactedAt: timestamp("lastContactedAt"),
  scheduledDate: timestamp("scheduledDate"),
  completedDate: timestamp("completedDate"),
  // Stripe
  stripeCustomerId: varchar("stripeCustomerId", { length: 100 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 100 }),
  stripePaymentLinkUrl: text("stripePaymentLinkUrl"),
  paidAt: timestamp("paidAt"),
  // Google Calendar
  calendarEventId: varchar("calendarEventId", { length: 200 }),
  // Customer Portal
  portalToken: varchar("portalToken", { length: 64 }).unique(),
  portalPhotos: jsonb("portalPhotos").$type<{ url: string; caption: string; type: "before" | "after" | "progress" }[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Email Templates ─────────────────────────────────────────────────────────
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    body: text("body").notNull(),
    // Trigger info
    triggerStage: templateTriggerStageEnum("triggerStage").default("manual"),
    isActive: boolean("isActive").default(true).notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("email_templates_tenantId_idx").on(table.tenantId),
  })
);

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// ─── Automation Rules ─────────────────────────────────────────────────────────
export const automationRules = pgTable(
  "automation_rules",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    triggerType: automationTriggerTypeEnum("triggerType").notNull(),
    triggerStage: leadStageEnum("triggerStage"),
    delayHours: integer("delayHours").default(0),
    templateId: integer("templateId").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("automation_rules_tenantId_idx").on(table.tenantId),
  })
);

export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = typeof automationRules.$inferInsert;

// ─── Communication Log ────────────────────────────────────────────────────────
export const communicationLog = pgTable(
  "communication_log",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    leadId: integer("leadId").notNull(),
    type: communicationTypeEnum("type").notNull(),
    direction: communicationDirectionEnum("direction").default("outbound"),
    subject: varchar("subject", { length: 500 }),
    content: text("content").notNull(),
    templateId: integer("templateId"),
    automationRuleId: integer("automationRuleId"),
    sentBy: integer("sentBy"),
    sentAt: timestamp("sentAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("communication_log_tenantId_idx").on(table.tenantId),
  })
);

export type CommunicationLog = typeof communicationLog.$inferSelect;
export type InsertCommunicationLog = typeof communicationLog.$inferInsert;

// ─── Attachments ──────────────────────────────────────────────────────────────
export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    leadId: integer("leadId").notNull(),
    fileName: varchar("fileName", { length: 300 }).notNull(),
    fileKey: varchar("fileKey", { length: 500 }).notNull(),
    fileUrl: text("fileUrl").notNull(),
    mimeType: varchar("mimeType", { length: 100 }),
    fileSize: integer("fileSize"),
    uploadedBy: integer("uploadedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("attachments_tenantId_idx").on(table.tenantId),
  })
);

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

// ─── App Settings ──────────────────────────────────────────────────────────────
export const appSettings = pgTable(
  "app_settings",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    companyName: varchar("companyName", { length: 200 }),
    companyEmail: varchar("companyEmail", { length: 320 }),
    reviewLink: text("reviewLink"),
    stripeSecretKey: text("stripeSecretKey"),
    googleCalendarId: varchar("googleCalendarId", { length: 300 }),
    googleServiceAccountKey: text("googleServiceAccountKey"),
    /** Google Business review URL pasted by the owner */
    googleReviewLink: text("googleReviewLink"),
    /** When true, automatically send a review request SMS when a lead is moved to 'completed' */
    autoReviewEnabled: boolean("autoReviewEnabled").default(false).notNull(),
    // ─── White-label branding ───────────────────────────────────────────────────
    /** Business display name shown in sidebar and browser tab */
    businessName: varchar("businessName", { length: 200 }),
    /** Owner full name */
    ownerName: varchar("ownerName", { length: 200 }),
    /** Business phone number */
    phone: varchar("phone", { length: 30 }),
    /** Business city */
    city: varchar("city", { length: 100 }),
    /** Business state */
    state: varchar("state", { length: 50 }),
    /** Business website URL */
    website: varchar("website", { length: 500 }),
    /** Subscription plan: starter, pro, max */
    plan: varchar("plan", { length: 50 }).default("starter"),
    /** S3/CDN URL of the uploaded business logo */
    logoUrl: text("logoUrl"),
    /** S3 key for the logo file (used for deletion) */
    logoKey: varchar("logoKey", { length: 500 }),
    /** Primary brand color as a hex string, e.g. '#1e40af' */
    primaryColor: varchar("primaryColor", { length: 20 }),
    /** Secondary brand color as a hex string */
    secondaryColor: varchar("secondaryColor", { length: 20 }),
    /** Stripe Publishable Key (pk_live_... or pk_test_...) stored in DB, overrides ENV */
    stripePublishableKey: text("stripePublishableKey"),
    // ─── Analytics ──────────────────────────────────────────────────────────────
    /** Google Analytics 4 Measurement ID, e.g. G-XXXXXXXXXX */
    googleAnalyticsId: varchar("googleAnalyticsId", { length: 50 }),
    // ─── Social Media ────────────────────────────────────────────────────────────
    /** Master toggle — show social media bar on website/portal */
    socialMediaEnabled: boolean("socialMediaEnabled").default(true).notNull(),
    facebookUrl: text("facebookUrl"),
    facebookEnabled: boolean("facebookEnabled").default(true).notNull(),
    instagramUrl: text("instagramUrl"),
    instagramEnabled: boolean("instagramEnabled").default(true).notNull(),
    whatsappNumber: varchar("whatsappNumber", { length: 30 }),
    whatsappEnabled: boolean("whatsappEnabled").default(true).notNull(),
    twitterUrl: text("twitterUrl"),
    twitterEnabled: boolean("twitterEnabled").default(true).notNull(),
    youtubeUrl: text("youtubeUrl"),
    youtubeEnabled: boolean("youtubeEnabled").default(true).notNull(),
    tiktokUrl: text("tiktokUrl"),
    tiktokEnabled: boolean("tiktokEnabled").default(true).notNull(),
    linkedinUrl: text("linkedinUrl"),
    linkedinEnabled: boolean("linkedinEnabled").default(true).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("app_settings_tenantId_idx").on(table.tenantId),
  })
);

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = typeof appSettings.$inferInsert;

// ─── SMS Conversations ────────────────────────────────────────────────────────
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    leadId: integer("leadId").notNull(),
    direction: conversationDirectionEnum("direction").notNull(),
    body: text("body").notNull(),
    fromNumber: varchar("fromNumber", { length: 30 }).notNull(),
    toNumber: varchar("toNumber", { length: 30 }).notNull(),
    /** Twilio message SID for deduplication and status tracking */
    twilioSid: varchar("twilioSid", { length: 64 }),
    /** Twilio delivery status */
    status: varchar("status", { length: 30 }).default("queued").notNull(),
    /** Whether this message has been read by the user */
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("conversations_tenantId_idx").on(table.tenantId),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// ─── Appointments ───────────────────────────────────────────────────────────────────────────────
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").default(1).notNull(),
  /** Foreign key to leads.id */
  leadId: integer("leadId").notNull(),
  /** Name(s) of crew member(s) assigned to this job */
  crewAssigned: varchar("crewAssigned", { length: 300 }),
  /** Type of job, e.g. Interior Paint, Exterior Paint, Deck Stain */
  jobType: varchar("jobType", { length: 200 }),
  /** Date of the appointment (stored as UTC timestamp) */
  scheduledDate: timestamp("scheduledDate").notNull(),
  /** Human-readable time slot, e.g. '8:00 AM – 12:00 PM' */
  timeSlot: varchar("timeSlot", { length: 100 }),
  /** Appointment status */
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  /** Internal notes about this appointment */
  notes: text("notes"),
  /** Whether a confirmation SMS was sent to the customer */
  smsSent: boolean("smsSent").default(false).notNull(),
  /** Whether a confirmation email was sent to the customer */
  emailSent: boolean("emailSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

// ─── Invoices ──────────────────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").default(1).notNull(),
  /** Foreign key to leads.id */
  leadId: integer("leadId").notNull(),
  /** Human-readable invoice number, e.g. INV-0042 */
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull(),
  /**
   * JSON array of line items:
   * [{ description: string, quantity: number, unitPrice: number }]
   */
  lineItems: jsonb("lineItems").notNull(),
  /** Subtotal before tax (sum of quantity * unitPrice) */
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  /** Tax amount in dollars */
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00").notNull(),
  /** Total = subtotal + tax */
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  /** Invoice lifecycle status */
  status: invoiceStatusEnum("status").default("draft").notNull(),
  /** Due date for payment */
  dueDate: timestamp("dueDate"),
  /** Timestamp when payment was confirmed */
  paidAt: timestamp("paidAt"),
  /** Stripe Payment Link URL sent to the customer */
  stripePaymentLink: text("stripePaymentLink"),
  /** Stripe Payment Link ID for webhook matching */
  stripePaymentLinkId: varchar("stripePaymentLinkId", { length: 100 }),
  /** Stripe Checkout Session ID (set when payment is initiated) */
  stripeSessionId: varchar("stripeSessionId", { length: 100 }),
  /** Internal notes */
  notes: text("notes"),
  /** Whether a payment link SMS was sent to the customer */
  smsSent: boolean("smsSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/** Typed line item stored in the lineItems JSON column */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

// ─── Crew Members ────────────────────────────────────────────────────────────
export const crewMembers = pgTable(
  "crew_members",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    /** Full name of the crew member */
    name: varchar("name", { length: 200 }).notNull(),
    /** Contact phone number */
    phone: varchar("phone", { length: 30 }),
    /** Contact email */
    email: varchar("email", { length: 200 }),
    /** Job role, e.g. Lead Painter, Apprentice, Foreman */
    role: varchar("role", { length: 100 }),
    /** Active or inactive status */
    status: crewStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("crew_members_tenantId_idx").on(table.tenantId),
  })
);
export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertCrewMember = typeof crewMembers.$inferInsert;

// ─── Job Photos ───────────────────────────────────────────────────────────────
export const jobPhotos = pgTable(
  "job_photos",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    /** Foreign key to leads.id */
    leadId: integer("leadId").notNull(),
    /** Public S3/CDN URL of the uploaded photo */
    photoUrl: text("photoUrl").notNull(),
    /** S3 object key for deletion */
    photoKey: varchar("photoKey", { length: 500 }).notNull(),
    /** Photo type: before the job or after the job */
    type: photoTypeEnum("type").notNull(),
    /** Optional caption or label */
    caption: varchar("caption", { length: 300 }),
    /** ID of the user who uploaded the photo */
    uploadedBy: integer("uploadedBy"),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("job_photos_tenantId_idx").on(table.tenantId),
  })
);

export type JobPhoto = typeof jobPhotos.$inferSelect;
export type InsertJobPhoto = typeof jobPhotos.$inferInsert;

// ─── Blog Posts ──────────────────────────────────────────────────────────────
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").default(1).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 600 }).notNull().unique(),
    content: text("content"),
    excerpt: varchar("excerpt", { length: 500 }),
    seoTitle: varchar("seoTitle", { length: 200 }),
    seoKeywords: varchar("seoKeywords", { length: 500 }),
    seoDescription: varchar("seoDescription", { length: 200 }),
    featuredImageUrl: text("featuredImageUrl"),
    projectAddress: text("projectAddress"),
    projectLatitude: decimal("projectLatitude", { precision: 10, scale: 7 }),
    projectLongitude: decimal("projectLongitude", { precision: 10, scale: 7 }),
    status: blogStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("blog_posts_tenantId_idx").on(table.tenantId),
  })
);
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

// ─── Blog Images ─────────────────────────────────────────────────────────────
export const blogImages = pgTable("blog_images", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  caption: varchar("caption", { length: 500 }),
  displayOrder: integer("displayOrder").default(0).notNull(),
});
export type BlogImage = typeof blogImages.$inferSelect;
export type InsertBlogImage = typeof blogImages.$inferInsert;
