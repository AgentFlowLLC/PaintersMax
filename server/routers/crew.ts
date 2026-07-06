/**
 * server/routers/crew.ts — tRPC procedures for crew member management
 *
 * Procedures:
 *   crew.list          — list all crew members (optionally filtered by status)
 *   crew.get           — get a single crew member by ID
 *   crew.create        — create a new crew member
 *   crew.update        — update name, phone, email, role, or status
 *   crew.deactivate    — set status to 'inactive'
 *   crew.reactivate    — set status to 'active'
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  listCrewMembers,
  getCrewMember,
  createCrewMember,
  updateCrewMember,
  deactivateCrewMember,
  reactivateCrewMember,
} from "../services/crew";

const crewMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  role: z.string().max(100).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const crewRouter = router({
  /** List all crew members, optionally filtered by status */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "inactive", "all"]).default("all"),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return listCrewMembers(input?.status ?? "all", tenantId);
    }),

  /** Get a single crew member by ID */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return getCrewMember(input.id, tenantId);
    }),

  /** Create a new crew member */
  create: protectedProcedure
    .input(crewMemberSchema)
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return createCrewMember({
        name: input.name,
        phone: input.phone ?? null,
        email: input.email || null,
        role: input.role ?? null,
        status: input.status,
        tenantId,
      });
    }),

  /** Update an existing crew member */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: crewMemberSchema.partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const update: Record<string, unknown> = {};
      if (input.data.name !== undefined) update.name = input.data.name;
      if (input.data.phone !== undefined) update.phone = input.data.phone ?? null;
      if (input.data.email !== undefined) update.email = input.data.email || null;
      if (input.data.role !== undefined) update.role = input.data.role ?? null;
      if (input.data.status !== undefined) update.status = input.data.status;
      return updateCrewMember(input.id, update as any, tenantId);
    }),

  /** Deactivate a crew member */
  deactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return deactivateCrewMember(input.id, tenantId);
    }),

  /** Reactivate a crew member */
  reactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return reactivateCrewMember(input.id, tenantId);
    }),
});
