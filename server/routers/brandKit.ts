import { paidProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const brandKitRouter = router({
  // ─── Read brand-kit fields for the current tenant ─────────────────────────
  get: paidProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.id;
    const db = await getDb();
    const empty = {
      companyName: null as string | null,
      companyEmail: null as string | null,
      phone: null as string | null,
      website: null as string | null,
      primaryColor: null as string | null,
    };
    if (!db) return empty;
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.tenantId, tenantId))
      .limit(1);
    const s = rows[0];
    if (!s) return empty;
    return {
      companyName: s.companyName ?? null,
      companyEmail: s.companyEmail ?? null,
      phone: s.phone ?? null,
      website: s.website ?? null,
      primaryColor: s.primaryColor ?? null,
    };
  }),

  // ─── Upsert brand-kit fields for the current tenant ───────────────────────
  save: paidProcedure
    .input(
      z.object({
        companyName: z.string().max(200).optional(),
        companyEmail: z.string().max(320).optional(),
        phone: z.string().max(30).optional(),
        website: z.string().max(500).optional(),
        primaryColor: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.tenantId, tenantId))
        .limit(1);

      if (rows.length === 0) {
        await db.insert(appSettings).values({
          tenantId,
          companyName: input.companyName ?? null,
          companyEmail: input.companyEmail ?? null,
          phone: input.phone ?? null,
          website: input.website ?? null,
          primaryColor: input.primaryColor ?? null,
        });
      } else {
        const updateData: Record<string, unknown> = {};
        if (input.companyName !== undefined) updateData.companyName = input.companyName;
        if (input.companyEmail !== undefined) updateData.companyEmail = input.companyEmail;
        if (input.phone !== undefined) updateData.phone = input.phone;
        if (input.website !== undefined) updateData.website = input.website;
        if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
        await db
          .update(appSettings)
          .set(updateData)
          .where(
            and(
              eq(appSettings.id, rows[0].id),
              eq(appSettings.tenantId, tenantId)
            )
          );
      }

      return { success: true };
    }),
});
