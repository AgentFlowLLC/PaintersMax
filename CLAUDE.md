# PaintersMax Project Context

## Who's Building This
Rogelio Arroyo, CEO/Founder, Agent Flow LLC (Dallas, TX, Central Time).
Beginner-to-intermediate developer learning by building. Makes all final
product decisions. See SKILL-paintersmax.md in repo root / Claude project
files for full session protocol, build status, and locked architecture
decisions — this file covers tech stack and DB schema only.

## Tech Stack
- Frontend/Backend: Next.js (App Router), TypeScript, Tailwind CSS
- Hosting: Vercel
- Database & Auth: Supabase (project ID: gxykhuoeqgdbnqahyiwr)
  - Auth: custom JWT (jose + bcryptjs) — NOT Supabase Auth
  - Connection: Transaction Pooler ONLY (port 6543) — direct connection
    (5432) is blocked by Vercel's serverless network
- DNS/Domain: Cloudflare
- Email: Resend (verified at mail.paintersmax.app)
- Payments: Stripe (sandbox — live mode pending business bank account)
- AI: Claude API (Haiku 4.5 for in-product chatbot/estimate tools)

## Planned Google Integrations
- **Google Places API** — client address autocompletion. Plugs into:
  signup Step 3 (Service Areas, city search) and `leads.projectAddress` /
  `leads.address` fields. Free tier via AI Studio key for early testing;
  production key goes through Google Cloud Console once usage exceeds
  free tier.
- **Google Calendar API** — scheduling estimates/jobs. Plugs into the
  existing `appointments` table, specifically the unused
  `calendarEventId` column — this integration is wiring an existing
  empty slot, not new schema.
- ~~Gmail API~~ — **holding off.** Transactional email (booking
  confirmations, lead alerts) is already handled by Resend +
  `email_templates` + `communication_log`. Only revisit Gmail API if the
  goal becomes sending from the painter's own Gmail address rather than
  the platform's Resend domain.

## Core Database Architecture (Supabase, live schema as of June 30 2026)

### ⚠️ Naming convention split — read before writing any SQL
- `painter_profiles` = **snake_case** (raw SQL migration 0026 exception)
- ALL other tables = **camelCase**, Drizzle ORM
- camelCase columns inside raw `sql\`\`` templates MUST be double-quoted
  (`"estimatedValue"` not `estimatedValue`) or Postgres silently
  lowercases them → silent 500 errors
- `tenantId` must NEVER be hardcoded as `1` — always derive from
  request/session context

### users
`id, openId, name, email, loginMethod, role (user/admin), passwordHash,
subscription_tier, stripe_customer_id, stripe_subscription_id,
trial_ends_at, subscription_status, createdAt, updatedAt, lastSignedIn`

### painter_profiles (snake_case — FK to users.id)
`id, user_id, company_name, phone, business_email, website, address,
years_in_business, license_number, insurance_carrier,
service_cities (jsonb), service_radius, logo_url, tagline,
onboarding_completed, chatbot_name (default 'Iris'), chatbot_avatar,
template_style (default 'dark-gold'), template_tier (default 'starter'),
signup_step (default 1), signup_updated_at, has_website`

### leads
`id, tenantId, firstName, lastName, email, phone, projectType,
projectAddress, projectDescription, estimatedValue, stage (enum: lead/
quoted/scheduled/in_progress/completed/paid), source, assignedTo,
lastContactedAt, scheduledDate, completedDate, stripeCustomerId,
stripeInvoiceId, stripePaymentLinkUrl, paidAt, calendarEventId,
portalToken, portalPhotos (jsonb), painting_type, rooms,
square_footage, surface_types (jsonb), paint_condition, timeline,
budget, photo_urls (jsonb), referral_source, notes, painter_id, address,
name, status, isDemo, demoExpiresAt, createdAt, updatedAt, createdBy`

### appointments
`id, tenantId, leadId, crewAssigned, jobType, scheduledDate, timeSlot,
status (enum: scheduled/confirmed/in_progress/completed/cancelled/
no_show), notes, smsSent, emailSent, isDemo, demoExpiresAt, createdAt,
updatedAt, createdBy`
→ `calendarEventId` does not live here yet — it's on `leads`. Calendar
sync writes back to `leads.calendarEventId` per appointment.

### invoices
`id, tenantId, leadId, invoiceNumber, lineItems (jsonb), subtotal, tax,
total, status (enum: draft/sent/paid/overdue), dueDate, paidAt,
stripePaymentLink, stripePaymentLinkId, stripeSessionId, notes,
smsSent, isDemo, demoExpiresAt, createdAt, updatedAt, createdBy`

### quotes
`id, tenantId, leadId, quoteNumber, lineItems (jsonb), subtotal, tax,
total, status, validUntil, sentAt, acceptedAt, rejectedAt, pdfUrl,
notes, smsSent, createdAt, updatedAt, createdBy`

### crew_members
`id, tenantId, name, phone, email, role, status (active/inactive),
createdAt, updatedAt`

### job_photos
`id, tenantId, leadId, photoUrl, photoKey, type (before/after), caption,
uploadedBy, uploadedAt`

### email_templates
`id, tenantId, name, subject, body, triggerStage (enum incl. manual),
isActive, isDefault, createdAt, updatedAt`

### automation_rules
`id, tenantId, name, triggerType (stage_change/scheduled/manual/
days_after_stage), triggerStage, delayHours, templateId, isActive,
createdAt, updatedAt`

### communication_log
`id, tenantId, leadId, type (email/call/note/sms/system), direction
(inbound/outbound/internal), subject, content, templateId,
automationRuleId, sentBy, sentAt, createdAt`

### conversations (SMS/Twilio thread log)
`id, tenantId, leadId, direction, body, fromNumber, toNumber, twilioSid,
status, read, createdAt`

### blog_posts / blog_images
`blog_posts: id, tenantId, title, slug, content, excerpt, seoTitle,
seoKeywords, seoDescription, featuredImageUrl, projectAddress,
projectLatitude, projectLongitude, status (draft/published/archived),
publishedAt, createdAt, updatedAt`
`blog_images: id, postId, imageUrl, caption, displayOrder`

### attachments
`id, tenantId, leadId, fileName, fileKey, fileUrl, mimeType, fileSize,
uploadedBy, createdAt`

### app_settings (tenant-level config)
`id, tenantId, companyName, companyEmail, reviewLink, stripeSecretKey,
googleCalendarId, googleServiceAccountKey, googleReviewLink,
autoReviewEnabled, businessName, logoUrl, logoKey, primaryColor,
secondaryColor, stripePublishableKey, googleAnalyticsId,
socialMediaEnabled, facebookUrl/Enabled, instagramUrl/Enabled,
whatsappNumber/Enabled, twitterUrl/Enabled, youtubeUrl/Enabled,
tiktokUrl/Enabled, linkedinUrl/Enabled, ownerName, phone, city, state,
website, plan, updatedAt`
→ `googleCalendarId` and `googleServiceAccountKey` already exist here —
this is the intended home for Calendar API service-account credentials
once that integration is wired. Note: `primaryColor`/`secondaryColor`
on this table are legacy — per locked decision, visual colors now come
from the chosen template only, not these columns.

## Google API Key Handling
- Never paste API keys into chat, prompts, or commits — placeholder
  syntax only (`GOOGLE_PLACES_API_KEY=your_key_here`), substitute real
  values directly in Vercel environment variables
- Restrict each key by API + HTTP referrer in Google Cloud Console
  before using outside local dev
- Service-role/server-side keys (e.g. `googleServiceAccountKey`) never
  go in `VITE_`-prefixed or client-exposed env vars
