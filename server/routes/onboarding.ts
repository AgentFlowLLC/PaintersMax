/**
 * server/routes/onboarding.ts
 *
 * Registers plain /api/ route handlers for the self-serve onboarding flow.
 * Uses Transaction Pooler (port 6543) via DATABASE_URL env var.
 *
 * Routes:
 *   GET  /api/onboarding/status          — Check if current user has completed onboarding
 *   POST /api/onboarding/save            — Upsert painter_profiles row for the current user
 *   POST /api/onboarding/upload-logo     — Upload logo to Supabase Storage bucket 'brand-assets'
 *   POST /api/onboarding/complete        — Mark onboarding as completed + send welcome email
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { verifyEmailJwt } from "./emailPasswordAuth";
import { getUserById } from "../db";
import { sendEmail } from "../lib/email";

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = await verifyEmailJwt(token);
  if (!payload) return null;
  return getUserById(payload.userId);
}

// ─── Supabase Storage upload helper ──────────────────────────────────────────
async function uploadToSupabaseStorage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[Onboarding] Supabase credentials missing — logo upload skipped.");
    return null;
  }
  const bucket = "brand-assets";
  const path = `logos/${Date.now()}-${fileName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: fileBuffer as unknown as BodyInit,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[Onboarding] Supabase Storage upload failed:", err);
    return null;
  }
  // Build public URL
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// ─── Raw SQL helpers (avoids schema import issues for new table) ──────────────
async function getPainterProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(
    sql`SELECT * FROM painter_profiles WHERE user_id = ${userId} LIMIT 1`
  );
  return (rows as unknown as { rows: unknown[] }).rows?.[0] ?? null;
}

async function upsertPainterProfile(userId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getPainterProfile(userId);
  const signupStep = (data.signup_step as number) ?? null;
  if (existing) {
    // UPDATE — only overwrite columns that were actually provided in this call
    await db.execute(sql`
      UPDATE painter_profiles SET
        company_name      = COALESCE(${(data.company_name as string) ?? null}, company_name),
        phone             = COALESCE(${(data.phone as string) ?? null}, phone),
        business_email    = COALESCE(${(data.business_email as string) ?? null}, business_email),
        website           = ${(data.website as string) ?? null},
        address           = COALESCE(${(data.address as string) ?? null}, address),
        years_in_business = ${(data.years_in_business as number) ?? null},
        license_number    = ${(data.license_number as string) ?? null},
        insurance_carrier = ${(data.insurance_carrier as string) ?? null},
        service_cities    = ${JSON.stringify(data.service_cities ?? [])}::jsonb,
        service_radius    = ${(data.service_radius as number) ?? null},
        logo_url          = ${(data.logo_url as string) ?? null},
        tagline           = ${(data.tagline as string) ?? null},
        chatbot_name      = ${(data.chatbot_name as string) ?? null},
        chatbot_avatar    = ${(data.chatbot_avatar as string) ?? null},
        has_website       = ${(data.has_website as boolean) ?? null},
        template_style    = ${(data.template_style as string) ?? null},
        template_tier     = ${(data.template_tier as string) ?? null},
        signup_step       = CASE WHEN ${signupStep}::integer IS NOT NULL THEN ${signupStep}::integer ELSE signup_step END,
        signup_updated_at = CASE WHEN ${signupStep}::integer IS NOT NULL THEN now() ELSE signup_updated_at END,
        updated_at        = now()
      WHERE user_id = ${userId}
    `);
  } else {
    // INSERT — fallback for users who somehow have no profile row yet
    await db.execute(sql`
      INSERT INTO painter_profiles (
        user_id, company_name, phone, business_email, website, address,
        years_in_business, license_number, insurance_carrier,
        service_cities, service_radius, logo_url,
        tagline,
        chatbot_name, chatbot_avatar,
        has_website, template_style, template_tier,
        signup_step, signup_updated_at,
        onboarding_completed, created_at, updated_at
      ) VALUES (
        ${userId},
        ${(data.company_name as string) ?? ''},
        ${(data.phone as string) ?? ''},
        ${(data.business_email as string) ?? ''},
        ${(data.website as string) ?? null},
        ${(data.address as string) ?? ''},
        ${(data.years_in_business as number) ?? null},
        ${(data.license_number as string) ?? null},
        ${(data.insurance_carrier as string) ?? null},
        ${JSON.stringify(data.service_cities ?? [])}::jsonb,
        ${(data.service_radius as number) ?? null},
        ${(data.logo_url as string) ?? null},
        ${(data.tagline as string) ?? null},
        ${(data.chatbot_name as string) ?? 'Iris'},
        ${(data.chatbot_avatar as string) ?? null},
        ${(data.has_website as boolean) ?? null},
        ${(data.template_style as string) ?? null},
        ${(data.template_tier as string) ?? null},
        ${signupStep ?? 1},
        now(),
        false,
        now(),
        now()
      )
    `);
  }
  return getPainterProfile(userId);
}

async function markOnboardingComplete(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    UPDATE painter_profiles
    SET onboarding_completed = true, updated_at = now()
    WHERE user_id = ${userId}
  `);
}

// ─── Save-Later reminder email ──────────────────────────────────────────────────
const STEP_NAMES: Record<number, string> = {
  2: "Business Info",
  3: "Service Areas",
  4: "Brand Kit",
  5: "Choose Plan",
};

async function sendSaveLaterEmail(
  businessEmail: string,
  businessName: string,
  currentStep: number
) {
  const stepName = STEP_NAMES[currentStep] ?? `Step ${currentStep}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #7c3aed; padding: 24px 32px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Complete your PaintersMax setup — you're almost there!</h1>
      <p style="color: #ddd6fe; margin: 6px 0 0; font-size: 14px;">Your progress has been saved.</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi <strong>${businessName || "there"}</strong>,</p>
      <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
        You saved your progress on the PaintersMax setup wizard. You left off on <strong>${stepName}</strong>.
        Pick up right where you left off — it only takes a few more minutes to complete!
      </p>
      <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 16px 20px; margin: 20px 0; text-align: center;">
        <a href="https://paintersmax.app/onboarding"
           style="display: inline-block; background: #7c3aed; color: #ffffff; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
          Continue Setup →
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0;">
        Once you complete setup, you'll have access to your full dashboard — leads, invoices, scheduling, and your AI chatbot.
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">© PaintersMax — <a href="mailto:support@paintersmax.app" style="color: #9ca3af;">support@paintersmax.app</a></p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to: businessEmail,
    subject: "Complete your PaintersMax setup — you're almost there!",
    html,
  });
}

// ─── Welcome email ────────────────────────────────────────────────────────────
async function sendWelcomeEmail(businessEmail: string, businessName: string) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #7c3aed; padding: 24px 32px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Welcome to PaintersMax!</h1>
      <p style="color: #ddd6fe; margin: 6px 0 0; font-size: 14px;">Your account is ready.</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi <strong>${businessName}</strong>,</p>
      <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
        Congratulations — your PaintersMax account has been configured and is ready to go!
        You can now log in and start managing your leads, invoices, scheduling, and more.
      </p>
      <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
        <p style="color: #5b21b6; font-size: 14px; margin: 0 0 8px;"><strong>Your Login URL:</strong></p>
        <a href="https://paintersmax.app" style="color: #7c3aed; font-size: 15px; font-weight: 600;">https://paintersmax.app</a>
      </div>
      <p style="color: #374151; font-size: 15px; margin: 20px 0 8px;">
        Need help getting started? Our support team is here for you:
      </p>
      <a href="mailto:support@paintersmax.app" style="color: #7c3aed; font-size: 15px;">support@paintersmax.app</a>
      <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0;">
        We're excited to have you on board. Let's grow your painting business together!
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">© PaintersMax — support@paintersmax.app</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to: businessEmail,
    subject: "Welcome to PaintersMax — Your Account is Ready",
    html,
  });
}

// ─── Sample quote email ───────────────────────────────────────────────────────
async function sendSampleQuoteEmail(
  to: string,
  companyName: string,
  logoUrl?: string | null
) {
  const displayName = companyName?.trim() || "Your Company";
  const logoHtml = logoUrl?.trim()
    ? `<img src="${logoUrl}" alt="${displayName}" style="max-height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px;">`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <!-- Sample banner -->
    <div style="background:#fef3c7;border-bottom:2px solid #f59e0b;padding:12px 24px;text-align:center;">
      <p style="margin:0;color:#92400e;font-size:13px;font-weight:700;letter-spacing:0.05em;">
        ⚠️ THIS IS A SAMPLE — showing you what your customers will receive
      </p>
    </div>
    <!-- Header -->
    <div style="background:#7c3aed;padding:24px 32px;">
      ${logoHtml}
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">${displayName}</h1>
      <p style="color:#ddd6fe;margin:4px 0 0;font-size:13px;">Quote / Invoice</p>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;margin:0 0 8px;">Hi <strong>Sample Client</strong>,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">
        Thank you for choosing <strong>${displayName}</strong>! Here's your quote for the following work:
      </p>
      <!-- Line items -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:13px;color:#6b7280;font-weight:600;">Description</th>
            <th style="text-align:right;padding:10px 12px;font-size:13px;color:#6b7280;font-weight:600;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">Interior Painting — Living Room</td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;text-align:right;">$2,400.00</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:12px;font-weight:700;color:#111827;font-size:15px;">Total</td>
            <td style="padding:12px;font-weight:700;color:#059669;font-size:15px;text-align:right;">$2,400.00</td>
          </tr>
        </tfoot>
      </table>
      <!-- CTA -->
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;padding:20px;text-align:center;">
        <p style="color:#5b21b6;margin:0 0 12px;font-size:14px;">Your customer would see a Pay Now button here:</p>
        <span style="display:inline-block;background:#7c3aed;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;">
          Pay Now — $2,400.00
        </span>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        Sent via <strong>PaintersMax</strong> — <a href="https://paintersmax.app" style="color:#9ca3af;">paintersmax.app</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to,
    subject: `Sample: Your PaintersMax Quote is Ready — ${displayName}`,
    html,
    replyTo: "support@paintersmax.app",
  });
}

// ─── Demo data generation ─────────────────────────────────────────────────────
async function generateDemoData(userId: number) {
  const db = await getDb();
  if (!db) return;

  const profile = await getPainterProfile(userId) as Record<string, unknown> | null;
  if (!profile) return;

  const user = await getUserById(userId);
  const companyName = (profile.company_name as string) || "Your Company";
  const logoUrl = (profile.logo_url as string) || null;

  // City fallback chain: serviceCities → address city segment → "Your Area"
  const serviceCities = profile.service_cities as Array<{ city: string; state: string }> | null;
  const addressCity = (profile.address as string | null)?.split(",")?.[0]?.trim() || null;
  const city = serviceCities?.[0]?.city?.trim() || addressCity || "Your Area";
  const state = serviceCities?.[0]?.state?.trim() || "";
  const cityLine = state ? `${city}, ${state}` : city;

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // ── Insert 3 demo leads ──────────────────────────────────────────────────────
  const lead1Row = await db.execute(sql`
    INSERT INTO leads (
      "tenantId", "firstName", "lastName", "projectType", "projectAddress",
      "projectDescription", stage, source, "estimatedValue",
      "isDemo", "demoExpiresAt", "createdBy", "createdAt", "updatedAt"
    ) VALUES (
      1, 'Maria', 'Garcia',
      'Interior Painting',
      ${`123 Oak Street, ${cityLine}`},
      'Demo Lead — not a real customer',
      'lead', 'demo', 2800,
      true, ${expiresAt.toISOString()},
      ${userId}, now(), now()
    ) RETURNING id
  `);
  const lead1Id = ((lead1Row as unknown as { rows: { id: number }[] }).rows)?.[0]?.id;

  await db.execute(sql`
    INSERT INTO leads (
      "tenantId", "firstName", "lastName", "projectType", "projectAddress",
      "projectDescription", stage, source, "estimatedValue",
      "lastContactedAt", "isDemo", "demoExpiresAt", "createdBy", "createdAt", "updatedAt"
    ) VALUES (
      1, 'James', 'Wilson',
      'Exterior Painting',
      ${`456 Elm Drive, ${cityLine}`},
      'Demo Lead — not a real customer',
      'contacted', 'demo', 4500,
      now(), true, ${expiresAt.toISOString()},
      ${userId}, now(), now()
    )
  `);

  await db.execute(sql`
    INSERT INTO leads (
      "tenantId", "firstName", "lastName", "projectType", "projectAddress",
      "projectDescription", stage, source, "estimatedValue",
      "isDemo", "demoExpiresAt", "createdBy", "createdAt", "updatedAt"
    ) VALUES (
      1, 'Sarah', 'Chen',
      'Cabinet Refinishing',
      ${`789 Maple Court, ${cityLine}`},
      'Demo Lead — not a real customer',
      'quoted', 'demo', 1200,
      true, ${expiresAt.toISOString()},
      ${userId}, now(), now()
    )
  `);

  // ── Insert 1 demo invoice (linked to lead 1) ─────────────────────────────────
  if (lead1Id) {
    await db.execute(sql`
      INSERT INTO invoices (
        "tenantId", "leadId", "invoiceNumber", "lineItems",
        subtotal, tax, total, status,
        "dueDate", "paidAt", notes,
        "isDemo", "demoExpiresAt", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        1, ${lead1Id}, 'DEMO-001',
        ${JSON.stringify([{ description: "Interior Painting — Living Room", quantity: 1, unitPrice: 2400 }])}::jsonb,
        2400, 0, 2400, 'paid',
        now(), now(),
        ${`Demo invoice for ${companyName} — not a real transaction`},
        true, ${expiresAt.toISOString()},
        ${userId}, now(), now()
      )
    `);

    // ── Insert 1 demo appointment (linked to lead 1) ───────────────────────────
    const appointmentDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    appointmentDate.setHours(10, 0, 0, 0);

    await db.execute(sql`
      INSERT INTO appointments (
        "tenantId", "leadId", "jobType", "scheduledDate", "timeSlot",
        status, notes, "smsSent", "emailSent",
        "isDemo", "demoExpiresAt", "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        1, ${lead1Id},
        'Estimate — Johnson Residence (Demo)',
        ${appointmentDate.toISOString()}, '10:00 AM',
        'scheduled',
        'Demo appointment — not a real booking',
        false, false,
        true, ${expiresAt.toISOString()},
        ${userId}, now(), now()
      )
    `);
  }

  // ── Send sample quote email ───────────────────────────────────────────────────
  const emailTo = user?.email ?? (profile.business_email as string);
  if (emailTo) {
    try {
      await sendSampleQuoteEmail(emailTo, companyName, logoUrl);
    } catch (emailErr) {
      console.warn("[Demo] Sample quote email failed (non-fatal):", emailErr);
    }
  }
}

// ─── Route registration ───────────────────────────────────────────────────────
export function registerOnboardingRoutes(app: Express): void {
  /**
   * GET /api/onboarding/status
   * Returns: { completed: boolean, profile: object | null }
   */
  app.get("/api/onboarding/status", async (req: Request, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const profile = await getPainterProfile(user.id);
      const completed = !!(profile && (profile as Record<string, unknown>).onboarding_completed);
      return res.json({ completed, profile: profile ?? null });
    } catch (err) {
      console.error("[Onboarding] status error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/onboarding/save
   * Body: partial painter_profiles fields
   * Returns: { success: true, profile: object }
   */
  app.post("/api/onboarding/save", async (req: Request, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const {
        company_name,
        phone,
        business_email,
        website,
        address,
        years_in_business,
        license_number,
        insurance_carrier,
        service_cities,
        service_radius,
        logo_url,
        tagline,
        chatbot_name,
        chatbot_avatar,
        has_website,
        template_style,
        template_tier,
        signup_step,
      } = req.body as Record<string, unknown>;

      const profile = await upsertPainterProfile(user.id, {
        company_name,
        phone,
        business_email,
        website,
        address,
        years_in_business,
        license_number,
        insurance_carrier,
        service_cities,
        service_radius,
        logo_url,
        tagline,
        chatbot_name,
        chatbot_avatar,
        has_website,
        template_style,
        template_tier,
        signup_step,
      });

      return res.json({ success: true, profile });
    } catch (err) {
      console.error("[Onboarding] save error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/onboarding/upload-logo
   * Body: multipart/form-data with field "logo" (file)
   * Returns: { success: true, url: string }
   */
  app.post("/api/onboarding/upload-logo", async (req: Request, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      // Parse multipart manually using raw body (express already parsed JSON body above,
      // but for file uploads we need multipart — use busboy via raw stream)
      const busboy = (await import("busboy")).default;
      const bb = busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } });

      let uploadedUrl: string | null = null;
      let parseError: string | null = null;

      await new Promise<void>((resolve, reject) => {
        bb.on("file", async (fieldname, file, info) => {
          const { filename, mimeType } = info;
          if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
            parseError = "Only JPEG, PNG, WebP, and GIF images are allowed.";
            file.resume();
            return;
          }
          const chunks: Buffer[] = [];
          file.on("data", (chunk: Buffer) => chunks.push(chunk));
          file.on("end", async () => {
            const buffer = Buffer.concat(chunks);
            uploadedUrl = await uploadToSupabaseStorage(buffer, filename, mimeType);
          });
        });
        bb.on("finish", resolve);
        bb.on("error", reject);
        req.pipe(bb);
      });

      if (parseError) return res.status(400).json({ error: parseError });
      if (!uploadedUrl) return res.status(500).json({ error: "Logo upload failed" });

      return res.json({ success: true, url: uploadedUrl });
    } catch (err) {
      console.error("[Onboarding] upload-logo error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/onboarding/save-later
   * Body: { business_email: string, company_name: string, current_step: number }
   * Sends a reminder email so the user can return to finish onboarding.
   * Returns: { success: true }
   */
  app.post("/api/onboarding/save-later", async (req: Request, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { business_email, company_name, current_step } = req.body as {
        business_email?: string;
        company_name?: string;
        current_step?: number;
      };

      if (business_email) {
        try {
          await sendSaveLaterEmail(
            business_email,
            company_name || "there",
            current_step ?? 2
          );
        } catch (emailErr) {
          console.warn("[Onboarding] Save-later email failed (non-fatal):", emailErr);
        }
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("[Onboarding] save-later error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/onboarding/generate-demo
   * Body: (none — user resolved from JWT)
   * Creates 3 demo leads, 1 demo invoice, 1 demo appointment, sends sample quote email.
   * All records marked is_demo=true with a 30-day expiry for Chunk 5 cleanup.
   * Returns: { success: true }
   */
  app.post("/api/onboarding/generate-demo", async (req: Request, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      await generateDemoData(user.id);
      return res.json({ success: true });
    } catch (err) {
      console.error("[Demo] generate-demo error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/onboarding/complete
   * Body: { business_email: string, company_name: string }
   * Marks onboarding as completed and sends welcome email.
   * Returns: { success: true }
   */
  app.post("/api/onboarding/complete", async (req: Request, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      await markOnboardingComplete(user.id);

      const { business_email, company_name } = req.body as {
        business_email?: string;
        company_name?: string;
      };

      if (business_email) {
        try {
          await sendWelcomeEmail(business_email, company_name || "there");
        } catch (emailErr) {
          console.warn("[Onboarding] Welcome email failed (non-fatal):", emailErr);
        }
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("[Onboarding] complete error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
