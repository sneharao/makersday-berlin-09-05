import { z } from "zod";

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageFormatSchema = z.enum(["markdown"]);
export type MessageFormat = z.infer<typeof messageFormatSchema>;

export const messageBodySchema = z.object({
  format: messageFormatSchema,
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1)),
});
export type MessageBody = z.infer<typeof messageBodySchema>;

export const citationSchema = z.object({
  libraryId: z.string().uuid(),
  artifactId: z.string().uuid(),
  pageNumber: z.number().int().min(1),
  excerpt: z.string().min(1).optional(),
});
export type Citation = z.infer<typeof citationSchema>;

export const chatMessageSchema = z
  .object({
    id: z.string().uuid(),
    chatId: z.string().uuid(),
    sequence: z.number().int().min(1),
    role: messageRoleSchema,
    body: messageBodySchema,
    citations: z.array(citationSchema),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .superRefine((value, ctx) => {
    if (value.role !== "assistant" && value.citations.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["citations"],
        message: "citations may only be set on assistant messages",
      });
    }
  });

export type ChatMessage = z.infer<typeof chatMessageSchema>;
