import { z } from "zod";

export const libraryNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

export const librarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: libraryNameSchema,
  description: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Library = z.infer<typeof librarySchema>;
