import { z } from "zod";
import { router, paidProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

const SYSTEM_PROMPT =
  "You are an expert business assistant for a professional painting company. " +
  "Help the owner with: writing customer follow-up messages and SMS scripts, " +
  "drafting professional estimate emails, pricing advice for different job types, " +
  "responding to negative reviews professionally, writing job completion thank-you messages, " +
  "creating social media captions about completed projects, and general business advice for " +
  "growing a painting company. Keep all responses practical, professional, and focused on the painting industry.";

export const aiRouter = router({
  chat: paidProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...input.messages,
        ],
      });

      const rawContent = result.choices?.[0]?.message?.content;
      const content =
        typeof rawContent === "string"
          ? rawContent
          : Array.isArray(rawContent)
          ? rawContent
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("")
          : "Sorry, I could not generate a response.";

      return { content };
    }),
});
