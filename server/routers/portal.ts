/**
 * portal router — public tRPC procedures for the customer-facing portal
 *
 * Procedures:
 *   portal.getData         — public: fetch all portal data by token
 *   portal.generateToken   — protected: generate/retrieve portal token for a lead
 *   portal.addPhoto        — protected: add a before/after/progress photo
 *   portal.removePhoto     — protected: remove a photo by URL
 */

import { z } from "zod";
import { paidProcedure, publicProcedure, router } from "../_core/trpc";
import {
  generatePortalToken,
  buildPortalUrl,
  getPortalData,
  addPortalPhoto,
  removePortalPhoto,
} from "../services/portal";

export const portalRouter = router({
  /**
   * Public — fetch all portal data by token.
   * Called by the CustomerPortal.tsx page without any auth.
   */
  getData: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const data = await getPortalData(input.token);
      if (!data) return null;
      return data;
    }),

  /**
   * Protected — generate or retrieve the portal token for a lead.
   * Returns the full portal URL so the admin can copy/share it.
   */
  generateToken: paidProcedure
    .input(
      z.object({
        leadId: z.number(),
        origin: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const token = await generatePortalToken(input.leadId);
      const url = buildPortalUrl(token, input.origin);
      return { token, url };
    }),

  /**
   * Protected — get the existing portal URL for a lead (read-only, no generation).
   */
  getToken: paidProcedure
    .input(
      z.object({
        leadId: z.number(),
        origin: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { leads } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) return null;

      const rows = await db
        .select({ portalToken: leads.portalToken })
        .from(leads)
        .where(eq(leads.id, input.leadId))
        .limit(1);

      const token = rows[0]?.portalToken;
      if (!token) return null;

      return { token, url: buildPortalUrl(token, input.origin) };
    }),

  /**
   * Protected — add a before/after/progress photo to the portal gallery.
   */
  addPhoto: paidProcedure
    .input(
      z.object({
        leadId: z.number(),
        url: z.string().url("Must be a valid URL"),
        caption: z.string().default(""),
        type: z.enum(["before", "after", "progress"]),
      })
    )
    .mutation(async ({ input }) => {
      return addPortalPhoto(input.leadId, {
        url: input.url,
        caption: input.caption,
        type: input.type,
      });
    }),

  /**
   * Protected — remove a photo from the portal gallery by URL.
   */
  removePhoto: paidProcedure
    .input(
      z.object({
        leadId: z.number(),
        url: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return removePortalPhoto(input.leadId, input.url);
    }),
});
