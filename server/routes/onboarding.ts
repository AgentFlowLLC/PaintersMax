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
  if (existing) {
    // UPDATE
    await db.execute(sql`
      UPDATE painter_profiles SET
        company_name      = ${(data.company_name as string) ?? null},
        phone             = ${(data.phone as string) ?? null},
        business_email    = ${(data.business_email as string) ?? null},
        website           = ${(data.website as string) ?? null},
        address           = ${(data.address as string) ?? null},
        years_in_business = ${(data.years_in_business as number) ?? null},
        license_number    = ${(data.license_number as string) ?? null},
        insurance_carrier = ${(data.insurance_carrier as string) ?? null},
        service_cities    = ${JSON.stringify(data.service_cities ?? [])}::jsonb,
        service_radius    = ${(data.service_radius as number) ?? null},
        logo_url          = ${(data.logo_url as string) ?? null},
        primary_color     = ${(data.primary_color as string) ?? null},
        secondary_color   = ${(data.secondary_color as string) ?? null},
        tagline           = ${(data.tagline as string) ?? null},
        updated_at        = now()
      WHERE user_id = ${userId}
    `);
  } else {
    // INSERT
    await db.execute(sql`
      INSERT INTO painter_profiles (
        user_id, company_name, phone, business_email, website, address,
        years_in_business, license_number, insurance_carrier,
        service_cities, service_radius, logo_url,
        primary_color, secondary_color, tagline,
        onboarding_completed, created_at, updated_at
      ) VALUES (
        ${userId},
        ${(data.company_name as string) ?? null},
        ${(data.phone as string) ?? null},
        ${(data.business_email as string) ?? null},
        ${(data.website as string) ?? null},
        ${(data.address as string) ?? null},
        ${(data.years_in_business as number) ?? null},
        ${(data.license_number as string) ?? null},
        ${(data.insurance_carrier as string) ?? null},
        ${JSON.stringify(data.service_cities ?? [])}::jsonb,
        ${(data.service_radius as number) ?? null},
        ${(data.logo_url as string) ?? null},
        ${(data.primary_color as string) ?? null},
        ${(data.secondary_color as string) ?? null},
        ${(data.tagline as string) ?? null},
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
        primary_color,
        secondary_color,
        tagline,
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
        primary_color,
        secondary_color,
        tagline,
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
