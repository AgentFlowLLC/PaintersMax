import { z } from "zod";
import { paidProcedure, router } from "../_core/trpc";
import {
  createCommunicationLogEntry,
  getCommunicationLog,
  getLeadById,
  getAttachmentsByLeadId,
  createAttachment,
  deleteAttachment,
} from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

export const communicationsRouter = router({
  list: paidProcedure
    .input(
      z
        .object({
          leadId: z.number().optional(),
          type: z
            .enum(["email", "call", "note", "sms", "system"])
            .optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const logs = await getCommunicationLog({ ...input, tenantId });
      // Enrich with lead info
      const leadIds = Array.from(new Set(logs.map((l) => l.leadId)));
      const leadMap: Record<number, { firstName: string; lastName: string }> = {};
      for (const id of leadIds) {
        const lead = await getLeadById(id);
        if (lead) leadMap[id] = { firstName: lead.firstName, lastName: lead.lastName };
      }
      return logs.map((l) => ({
        ...l,
        leadName: leadMap[l.leadId]
          ? `${leadMap[l.leadId].firstName} ${leadMap[l.leadId].lastName}`
          : "Unknown",
      }));
    }),

  create: paidProcedure
    .input(
      z.object({
        leadId: z.number(),
        type: z.enum(["email", "call", "note", "sms"]),
        direction: z.enum(["inbound", "outbound", "internal"]).optional(),
        subject: z.string().optional(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      await createCommunicationLogEntry({
        ...input,
        tenantId,
        sentBy: ctx.user.id,
        sentAt: new Date(),
      });
      return { success: true };
    }),
});

export const attachmentsRouter = router({
  list: paidProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return getAttachmentsByLeadId(input.leadId, tenantId);
    }),

  upload: paidProcedure
    .input(
      z.object({
        leadId: z.number(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number().optional(),
        base64Data: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const suffix = nanoid(8);
      const fileKey = `crm/leads/${input.leadId}/${suffix}-${input.fileName}`;
      const buffer = Buffer.from(input.base64Data, "base64");
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      await createAttachment({
        leadId: input.leadId,
        fileName: input.fileName,
        fileKey,
        fileUrl: url,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedBy: ctx.user.id,
        tenantId,
      });

      return { success: true, url };
    }),

  delete: paidProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      await deleteAttachment(input.id, tenantId);
      return { success: true };
    }),
});
