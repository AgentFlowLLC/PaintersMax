import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { ENV } from "../_core/env";

// ─── Default branding fallback ────────────────────────────────────────────────
const DEFAULT_BRANDING = {
  businessName: "PaintersMax",
  logoUrl: null as string | null,
  primaryColor: "#1e3a5f",
  secondaryColor: "#3b82f6",
};

export const settingsRouter = router({
  // ─── Public: get branding only (used by DashboardLayout before auth) ─────────
  getBranding: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { ...DEFAULT_BRANDING, googleAnalyticsId: null as string | null };
    // For public branding, use tenant 1 (default)
    const rows = await db.select().from(appSettings).where(eq(appSettings.tenantId, 1)).limit(1);
    const s = rows[0];
    if (!s) return { ...DEFAULT_BRANDING, googleAnalyticsId: null as string | null };
    return {
      businessName: s.businessName ?? DEFAULT_BRANDING.businessName,
      logoUrl: s.logoUrl ?? null,
      primaryColor: s.primaryColor ?? DEFAULT_BRANDING.primaryColor,
      secondaryColor: s.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
      googleAnalyticsId: s.googleAnalyticsId ?? null,
    };
  }),

  // ─── Protected: get full settings ────────────────────────────────────────────
  get: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.id;
    const db = await getDb();
    const empty = {
      companyName: null, companyEmail: null, reviewLink: null,
      stripeEnabled: false, calendarEnabled: false,
      googleReviewLink: null, autoReviewEnabled: false,
      businessName: null, logoUrl: null, primaryColor: null, secondaryColor: null,
      // Stripe keys — return masked versions only
      stripePublishableKey: null as string | null,
      stripeSecretKeySet: false,
      // Analytics
      googleAnalyticsId: null as string | null,
      // Social Media
      socialMediaEnabled: true,
      facebookUrl: null as string | null, facebookEnabled: true,
      instagramUrl: null as string | null, instagramEnabled: true,
      whatsappNumber: null as string | null, whatsappEnabled: true,
      twitterUrl: null as string | null, twitterEnabled: true,
      youtubeUrl: null as string | null, youtubeEnabled: true,
      tiktokUrl: null as string | null, tiktokEnabled: true,
      linkedinUrl: null as string | null, linkedinEnabled: true,
    };
    if (!db) return empty;
    const rows = await db.select().from(appSettings).where(eq(appSettings.tenantId, tenantId)).limit(1);
    const s = rows[0];
    if (!s) return empty;

    // Determine effective secret key (DB first, then ENV fallback)
    const effectiveSecretKey = s.stripeSecretKey ?? ENV.stripeSecretKey ?? null;

    return {
      companyName: s.companyName,
      companyEmail: s.companyEmail,
      reviewLink: s.reviewLink,
      stripeEnabled: !!effectiveSecretKey,
      calendarEnabled: !!s.googleCalendarId,
      googleReviewLink: s.googleReviewLink ?? null,
      autoReviewEnabled: s.autoReviewEnabled ?? false,
      businessName: s.businessName ?? null,
      logoUrl: s.logoUrl ?? null,
      primaryColor: s.primaryColor ?? null,
      secondaryColor: s.secondaryColor ?? null,
      // Return publishable key (not secret) for display
      stripePublishableKey: s.stripePublishableKey ?? null,
      // Only tell the frontend whether a secret key is configured, never expose the value
      stripeSecretKeySet: !!effectiveSecretKey,
      // Analytics
      googleAnalyticsId: s.googleAnalyticsId ?? null,
      // Social Media
      socialMediaEnabled: s.socialMediaEnabled ?? true,
      facebookUrl: s.facebookUrl ?? null, facebookEnabled: s.facebookEnabled ?? true,
      instagramUrl: s.instagramUrl ?? null, instagramEnabled: s.instagramEnabled ?? true,
      whatsappNumber: s.whatsappNumber ?? null, whatsappEnabled: s.whatsappEnabled ?? true,
      twitterUrl: s.twitterUrl ?? null, twitterEnabled: s.twitterEnabled ?? true,
      youtubeUrl: s.youtubeUrl ?? null, youtubeEnabled: s.youtubeEnabled ?? true,
      tiktokUrl: s.tiktokUrl ?? null, tiktokEnabled: s.tiktokEnabled ?? true,
      linkedinUrl: s.linkedinUrl ?? null, linkedinEnabled: s.linkedinEnabled ?? true,
    };
  }),

  // ─── Protected: update settings ──────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      companyName: z.string().optional(),
      companyEmail: z.string().optional(),
      reviewLink: z.string().optional(),
      stripeSecretKey: z.string().optional(),
      stripePublishableKey: z.string().optional(),
      googleCalendarId: z.string().optional(),
      googleReviewLink: z.string().optional(),
      autoReviewEnabled: z.boolean().optional(),
      // Branding fields
      businessName: z.string().max(200).optional(),
      primaryColor: z.string().max(20).optional(),
      secondaryColor: z.string().max(20).optional(),
      // Analytics
      googleAnalyticsId: z.string().max(50).optional().nullable(),
      // Social Media
      socialMediaEnabled: z.boolean().optional(),
      facebookUrl: z.string().optional().nullable(),
      facebookEnabled: z.boolean().optional(),
      instagramUrl: z.string().optional().nullable(),
      instagramEnabled: z.boolean().optional(),
      whatsappNumber: z.string().max(30).optional().nullable(),
      whatsappEnabled: z.boolean().optional(),
      twitterUrl: z.string().optional().nullable(),
      twitterEnabled: z.boolean().optional(),
      youtubeUrl: z.string().optional().nullable(),
      youtubeEnabled: z.boolean().optional(),
      tiktokUrl: z.string().optional().nullable(),
      tiktokEnabled: z.boolean().optional(),
      linkedinUrl: z.string().optional().nullable(),
      linkedinEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db.select().from(appSettings).where(eq(appSettings.tenantId, tenantId)).limit(1);
      if (rows.length === 0) {
        await db.insert(appSettings).values({
          tenantId,
          companyName: input.companyName || null,
          companyEmail: input.companyEmail || null,
          reviewLink: input.reviewLink || null,
          stripeSecretKey: input.stripeSecretKey || null,
          stripePublishableKey: input.stripePublishableKey || null,
          googleCalendarId: input.googleCalendarId || null,
          businessName: input.businessName || null,
          primaryColor: input.primaryColor || null,
          secondaryColor: input.secondaryColor || null,
          googleAnalyticsId: input.googleAnalyticsId || null,
        });
      } else {
        const updateData: Record<string, unknown> = {};
        if (input.companyName !== undefined) updateData.companyName = input.companyName;
        if (input.companyEmail !== undefined) updateData.companyEmail = input.companyEmail;
        if (input.reviewLink !== undefined) updateData.reviewLink = input.reviewLink;
        if (input.stripeSecretKey !== undefined) updateData.stripeSecretKey = input.stripeSecretKey;
        if (input.stripePublishableKey !== undefined) updateData.stripePublishableKey = input.stripePublishableKey;
        if (input.googleCalendarId !== undefined) updateData.googleCalendarId = input.googleCalendarId;
        if (input.googleReviewLink !== undefined) updateData.googleReviewLink = input.googleReviewLink;
        if (input.autoReviewEnabled !== undefined) updateData.autoReviewEnabled = input.autoReviewEnabled;
        if (input.businessName !== undefined) updateData.businessName = input.businessName;
        if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
        if (input.secondaryColor !== undefined) updateData.secondaryColor = input.secondaryColor;
        // Analytics
        if (input.googleAnalyticsId !== undefined) updateData.googleAnalyticsId = input.googleAnalyticsId || null;
        // Social Media
        if (input.socialMediaEnabled !== undefined) updateData.socialMediaEnabled = input.socialMediaEnabled;
        if (input.facebookUrl !== undefined) updateData.facebookUrl = input.facebookUrl || null;
        if (input.facebookEnabled !== undefined) updateData.facebookEnabled = input.facebookEnabled;
        if (input.instagramUrl !== undefined) updateData.instagramUrl = input.instagramUrl || null;
        if (input.instagramEnabled !== undefined) updateData.instagramEnabled = input.instagramEnabled;
        if (input.whatsappNumber !== undefined) updateData.whatsappNumber = input.whatsappNumber || null;
        if (input.whatsappEnabled !== undefined) updateData.whatsappEnabled = input.whatsappEnabled;
        if (input.twitterUrl !== undefined) updateData.twitterUrl = input.twitterUrl || null;
        if (input.twitterEnabled !== undefined) updateData.twitterEnabled = input.twitterEnabled;
        if (input.youtubeUrl !== undefined) updateData.youtubeUrl = input.youtubeUrl || null;
        if (input.youtubeEnabled !== undefined) updateData.youtubeEnabled = input.youtubeEnabled;
        if (input.tiktokUrl !== undefined) updateData.tiktokUrl = input.tiktokUrl || null;
        if (input.tiktokEnabled !== undefined) updateData.tiktokEnabled = input.tiktokEnabled;
        if (input.linkedinUrl !== undefined) updateData.linkedinUrl = input.linkedinUrl || null;
        if (input.linkedinEnabled !== undefined) updateData.linkedinEnabled = input.linkedinEnabled;
        await db.update(appSettings).set(updateData).where(and(eq(appSettings.id, rows[0].id), eq(appSettings.tenantId, tenantId)));
      }
      return { success: true };
    }),

  // ─── Protected: test Stripe connection ───────────────────────────────────────
  testStripeConnection: protectedProcedure
    .input(z.object({
      secretKey: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Validate key format before making any network call
      const key = input.secretKey.trim();
      if (!key.startsWith("sk_live_") && !key.startsWith("sk_test_")) {
        return {
          success: false,
          error: "Invalid key format. Stripe secret keys start with sk_live_ or sk_test_.",
        };
      }

      try {
        // Make a minimal Stripe API call — list balance (read-only, no side effects)
        const response = await fetch("https://api.stripe.com/v1/balance", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        if (response.ok) {
          const data = await response.json() as { object?: string; available?: unknown[] };
          if (data.object === "balance") {
            return { success: true, message: "Stripe connection verified successfully." };
          }
        }

        // Parse Stripe error response
        const errorData = await response.json() as { error?: { message?: string } };
        return {
          success: false,
          error: errorData?.error?.message ?? `Stripe returned status ${response.status}`,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Network error contacting Stripe API.",
        };
      }
    }),

  // ─── Protected: upload logo to S3 ────────────────────────────────────────────
  uploadLogo: protectedProcedure
    .input(z.object({
      base64Data: z.string(),
      mimeType: z.string().regex(/^image\/(jpeg|png|gif|webp|svg\+xml)$/),
      originalName: z.string().max(300),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Decode base64 to buffer
      const base64 = input.base64Data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");

      const ext = input.mimeType.split("/")[1]?.replace("svg+xml", "svg") ?? "png";
      const fileKey = `branding/logo-${nanoid(12)}.${ext}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Persist to settings row
      const rows = await db.select().from(appSettings).where(eq(appSettings.tenantId, tenantId)).limit(1);
      if (rows.length === 0) {
        await db.insert(appSettings).values({ tenantId, logoUrl: url, logoKey: fileKey });
      } else {
        await db.update(appSettings)
          .set({ logoUrl: url, logoKey: fileKey })
          .where(and(eq(appSettings.id, rows[0].id), eq(appSettings.tenantId, tenantId)));
      }

      return { success: true, logoUrl: url };
    }),

  // ─── Protected: remove logo ───────────────────────────────────────────────────
  removeLogo: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const rows = await db.select().from(appSettings).where(eq(appSettings.tenantId, tenantId)).limit(1);
    if (rows.length > 0) {
      await db.update(appSettings)
        .set({ logoUrl: null, logoKey: null })
        .where(and(eq(appSettings.id, rows[0].id), eq(appSettings.tenantId, tenantId)));
    }
    return { success: true };
  }),
});
