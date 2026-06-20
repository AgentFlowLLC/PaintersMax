/**
 * emailPasswordAuth.ts
 *
 * Simple email/password authentication endpoints for Vercel deployment.
 * Replaces Manus OpenID OAuth flow with JWT tokens stored in localStorage.
 *
 * POST /api/auth/login    — validate credentials, return signed JWT
 * POST /api/auth/logout   — stateless; client discards the token
 * POST /api/auth/register — create a new user account and return signed JWT
 */

import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "../db";
import { users, appSettings } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { ENV } from "../_core/env";
import { sendEmail } from "../lib/email";

const TOKEN_EXPIRY_SECONDS = 365 * 24 * 60 * 60; // 1 year

function getJwtSecret(): Uint8Array {
  const secret = ENV.cookieSecret || "fallback-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function signEmailJwt(userId: number, email: string, role: string): Promise<string> {
  return new SignJWT({ userId, email, role, type: "email-password" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyEmailJwt(token: string): Promise<{ userId: number; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
    const { userId, email, role } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || typeof email !== "string" || typeof role !== "string") {
      return null;
    }
    return { userId, email, role };
  } catch {
    return null;
  }
}

export function registerEmailPasswordAuthRoutes(app: Express): void {
  /**
   * POST /api/auth/login
   * Body: { email: string, password: string }
   * Returns: { token: string, user: { id, name, email, role } }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const db = await getDb();
      if (!db) {
        return res.status(503).json({ error: "Database unavailable" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: "Password login not set up for this account" });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Update lastSignedIn
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      const token = await signEmailJwt(user.id, user.email ?? email, user.role);

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/auth/logout
   * Stateless — client is responsible for removing the token from localStorage.
   */
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    return res.json({ success: true });
  });

  /**
   * POST /api/auth/register
   * Body: { email, password, businessName?, ownerName?, phone?, city?, state?, website?, hearAboutUs?, plan? }
   * businessName and ownerName are optional — the new signup flow collects them in Step 2.
   * Returns: { success: true, token, user: { id, email, businessName } }
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const {
        businessName,
        ownerName,
        email,
        password,
        phone,
        city,
        state,
        website,
        plan,
        hearAboutUs,
      } = req.body as {
        businessName?: string;
        ownerName?: string;
        email?: string;
        password?: string;
        phone?: string;
        city?: string;
        state?: string;
        website?: string;
        hearAboutUs?: string;
        plan?: string;
      };

      // ── Validation ────────────────────────────────────────────────────────────
      if (!email?.trim()) return res.status(400).json({ error: "Email is required" });
      if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const normalizedEmail = email.toLowerCase().trim();

      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });

      // ── Duplicate email check ─────────────────────────────────────────────────
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing) return res.status(409).json({ error: "Email already registered" });

      // ── Hash password ─────────────────────────────────────────────────────────
      const passwordHash = await bcrypt.hash(password, 12);
      const openId = `email-${normalizedEmail}-${Date.now()}`;

      // ── Create user with role 'admin' (business owner) ────────────────────────
      const [newUser] = await db
        .insert(users)
        .values({
          openId,
          name: ownerName?.trim() || null,
          email: normalizedEmail,
          passwordHash,
          loginMethod: "email-password",
          role: "admin",
          lastSignedIn: new Date(),
        })
        .returning();

      if (!newUser) return res.status(500).json({ error: "Failed to create account" });

      // ── Seed app_settings with business info (businessName/ownerName optional) ─
      try {
        await db.insert(appSettings).values({
          tenantId: newUser.id,
          businessName: businessName?.trim() || null,
          ownerName: ownerName?.trim() || null,
          companyEmail: normalizedEmail,
          phone: phone?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          website: website?.trim() || null,
          plan: plan?.toLowerCase() || "starter",
        });
      } catch (settingsErr) {
        console.warn("[Register] Failed to seed app_settings:", (settingsErr as Error).message);
      }

      // ── Create painter_profiles stub so signup_step tracking starts at 1 ─────
      try {
        await db.execute(sql`
          INSERT INTO painter_profiles (
            user_id, company_name, phone, business_email, address,
            signup_step, signup_updated_at,
            onboarding_completed, service_cities, created_at, updated_at
          ) VALUES (
            ${newUser.id}, '', '', '', '',
            1, now(),
            false, '[]'::jsonb, now(), now()
          )
        `);
      } catch (profileErr) {
        console.warn("[Register] Failed to create painter_profiles stub:", (profileErr as Error).message);
      }

      const displayName = businessName?.trim() || normalizedEmail;
      console.log(
        `[Register] New account: ${displayName} (${normalizedEmail})` +
        (phone ? ` | Phone: ${phone}` : "") +
        (city && state ? ` | ${city}, ${state}` : "") +
        (plan ? ` | Plan: ${plan}` : "") +
        (hearAboutUs ? ` | Source: ${hearAboutUs}` : "")
      );

      // ── Send welcome email ────────────────────────────────────────────────────
      try {
        await sendEmail({
          to: normalizedEmail,
          subject: "Welcome to PaintersMax — Let's Get Started!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #1d4ed8; font-size: 28px; margin: 0;">Welcome to PaintersMax! 🎉</h1>
              </div>
              <p style="font-size: 16px; color: #374151;">Hi there,</p>
              <p style="font-size: 16px; color: #374151;">
                Your PaintersMax account is created. Continue setting up your business profile to unlock your full dashboard.
              </p>
              <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">Account details</p>
                <p style="margin: 4px 0 0; font-size: 15px; color: #111827;"><strong>Email:</strong> ${normalizedEmail}</p>
              </div>
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://paintersmax.app/login"
                   style="background: #1d4ed8; color: white; text-decoration: none; padding: 14px 32px;
                          border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                  Go to My Dashboard →
                </a>
              </div>
              <p style="font-size: 14px; color: #9ca3af; text-align: center;">
                paintersmax.app &bull; Powered by Agent Flow LLC
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn("[Register] Welcome email failed:", (emailErr as Error).message);
      }

      // ── Return JWT + user ─────────────────────────────────────────────────────
      const token = await signEmailJwt(newUser.id, normalizedEmail, newUser.role);

      return res.status(201).json({
        success: true,
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          businessName: businessName?.trim() || null,
        },
      });
    } catch (err) {
      console.error("[Auth] Register error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
