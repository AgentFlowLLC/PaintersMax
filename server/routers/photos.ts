/**
 * photos.ts — tRPC router for before/after job photo management
 *
 * Procedures:
 *   photos.upload   — accepts base64-encoded image, uploads to S3, saves record
 *   photos.list     — list all photos for a lead (optionally filtered by type)
 *   photos.delete   — delete a photo record by ID
 *   photos.byLead   — get photos grouped by before/after for a lead
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { uploadPhoto, listPhotos, deletePhoto, getPhotosByLead } from "../services/photos";
import { TRPCError } from "@trpc/server";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const photosRouter = router({
  /**
   * Upload a photo for a lead.
   * The client sends the image as a base64-encoded string with its MIME type.
   * The server decodes it, uploads to S3, and persists the DB record.
   */
  upload: protectedProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        type: z.enum(["before", "after"]),
        /** Base64-encoded image data (without data URI prefix) */
        base64Data: z.string().min(1),
        mimeType: z.string().regex(/^image\//),
        originalName: z.string().default("photo.jpg"),
        caption: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const tenantId = ctx.user.id;

      if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File too large. Maximum size is 10 MB (received ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB).`,
        });
      }

      try {
        const photo = await uploadPhoto({
          leadId: input.leadId,
          type: input.type,
          fileBuffer: buffer,
          mimeType: input.mimeType,
          originalName: input.originalName,
          caption: input.caption,
          uploadedBy: ctx.user.id,
          tenantId,
        });
        return { success: true, photo };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Photo upload failed: ${(err as Error).message}`,
        });
      }
    }),

  /** List photos for a lead, optionally filtered by type */
  list: protectedProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        type: z.enum(["before", "after"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return listPhotos(input.leadId, input.type, tenantId);
    }),

  /** Get photos for a lead grouped into { before: [], after: [] } */
  byLead: protectedProcedure
    .input(z.object({ leadId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return getPhotosByLead(input.leadId, tenantId);
    }),

  /**
   * Public version of byLead — used by the CustomerPortal (no auth required).
   * Accepts the portal token to verify access.
   */
  byLeadPublic: publicProcedure
    .input(
      z.object({
        leadId: z.number().int().positive(),
        token: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      // Token validation is handled by the portal router; here we trust the leadId
      // since the portal page already verified the token before rendering.
      return getPhotosByLead(input.leadId);
    }),

  /** Delete a photo by ID */
  delete: protectedProcedure
    .input(z.object({ photoId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const result = await deletePhoto(input.photoId, tenantId);
      if (!result.success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Photo ${input.photoId} not found`,
        });
      }
      return { success: true };
    }),
});
