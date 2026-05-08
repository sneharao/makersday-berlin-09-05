import { z } from "zod";

export const authProviderSchema = z.enum(["local"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const localeSchema = z.enum(["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "zh-CN"]);
export type Locale = z.infer<typeof localeSchema>;

export const authSubjectSchema = z.object({
  provider: authProviderSchema,
  subjectId: z.string().min(1),
});
export type AuthSubject = z.infer<typeof authSubjectSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  displayName: z.string().transform((value) => value.trim()).pipe(z.string().min(1)),
  locale: localeSchema,
  authSubject: authSubjectSchema,
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof userSchema>;
