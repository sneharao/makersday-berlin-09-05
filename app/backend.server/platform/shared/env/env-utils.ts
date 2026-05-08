import type { z } from "zod";

export function readFromEnv<S extends z.ZodRawShape>(schema: z.ZodObject<S>): z.infer<z.ZodObject<S>> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `  ${String(issue.path[0])}: ${issue.message}`).join("\n");
    throw new Error(`Environment validation failed:\n${details}`);
  }
  return result.data;
}
