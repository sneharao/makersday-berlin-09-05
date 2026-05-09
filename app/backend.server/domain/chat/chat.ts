import { z } from "zod";

export const chatTitleSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

export const chatSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  libraryId: z.string().uuid(),
  title: chatTitleSchema,
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastMessageAt: z.date().optional(),
});

export type Chat = z.infer<typeof chatSchema>;
