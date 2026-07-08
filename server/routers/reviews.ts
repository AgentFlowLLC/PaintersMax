/**
 * reviews router — Google Review request procedures
 *
 * Procedures:
 *   reviews.send        — protected: manually send a review request SMS for a lead
 *   reviews.status      — protected: check if google_review_link is configured
 */

import { z } from "zod";
import { paidProcedure, router } from "../_core/trpc";
import { sendReviewRequest } from "../services/reviews";
import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";

export const reviewsRouter = router({
  /**
   * Manually send a Google Review request SMS for a specific lead.
   * Returns success/failure details.
   */
  send: paidProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await sendReviewRequest(input.leadId, ctx.user.id);
      return result;
    }),

  /**
   * Check whether the Google Review link is configured in app_settings.
   * Used by the frontend to show a warning if the link is missing.
   */
  status: paidProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { configured: false, link: null, autoReviewEnabled: false };

    const rows = await db
      .select({
        googleReviewLink: appSettings.googleReviewLink,
        autoReviewEnabled: appSettings.autoReviewEnabled,
      })
      .from(appSettings)
      .limit(1);

    const settings = rows[0];
    return {
      configured: !!settings?.googleReviewLink,
      link: settings?.googleReviewLink ?? null,
      autoReviewEnabled: settings?.autoReviewEnabled ?? false,
    };
  }),
});
