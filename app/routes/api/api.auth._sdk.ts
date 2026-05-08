import { z } from "zod";

const localeSchema = z.enum(["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "zh-CN"]);

const authenticatedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  locale: localeSchema,
});

const loginSuccessSchema = z.object({
  user: authenticatedUserSchema,
});

const loginInvalidSchema = z.object({ error: z.string() });
const loginFieldErrorsSchema = z.object({
  errors: z.object({
    email: z.array(z.string()).optional(),
    password: z.array(z.string()).optional(),
  }),
});

const logoutSchema = z.object({ ok: z.literal(true) });

const meSchema = z.object({
  user: authenticatedUserSchema,
  sessionStartedAt: z.union([z.string(), z.coerce.date()]).transform((v) => (v instanceof Date ? v : new Date(v))),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type LoginSuccess = z.infer<typeof loginSuccessSchema>;
export type Me = z.infer<typeof meSchema>;

export interface CallLoginResultOk {
  ok: true;
  user: AuthenticatedUser;
}
export interface CallLoginResultInvalid {
  ok: false;
  reason: "invalid-credentials" | "field-errors" | "unexpected";
  fieldErrors?: { email?: string[]; password?: string[] };
  message?: string;
}
export type CallLoginResult = CallLoginResultOk | CallLoginResultInvalid;

export async function callLoginApi(input: { email: string; password: string }): Promise<CallLoginResult> {
  let response: Response;
  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, reason: "unexpected", message: "Network error" };
  }

  const json: unknown = await response.json().catch(() => ({}));

  if (response.status === 200) {
    const parsed = loginSuccessSchema.safeParse(json);
    if (parsed.success) return { ok: true, user: parsed.data.user };
    return { ok: false, reason: "unexpected", message: "Malformed login response" };
  }

  if (response.status === 401) {
    const parsed = loginInvalidSchema.safeParse(json);
    return { ok: false, reason: "invalid-credentials", message: parsed.success ? parsed.data.error : "Invalid email or password" };
  }

  if (response.status === 400) {
    const fieldParsed = loginFieldErrorsSchema.safeParse(json);
    if (fieldParsed.success) {
      return { ok: false, reason: "field-errors", fieldErrors: fieldParsed.data.errors };
    }
    return { ok: false, reason: "unexpected", message: "Bad request" };
  }

  return { ok: false, reason: "unexpected", message: `Unexpected status ${response.status}` };
}

export async function callLogoutApi(): Promise<{ ok: boolean }> {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.status !== 200) return { ok: false };
    const json: unknown = await response.json().catch(() => ({}));
    const parsed = logoutSchema.safeParse(json);
    return { ok: parsed.success };
  } catch {
    return { ok: false };
  }
}

export async function callGetMeApi(): Promise<Me | null> {
  try {
    const response = await fetch("/api/auth/me", { method: "GET" });
    if (response.status !== 200) return null;
    const json: unknown = await response.json().catch(() => null);
    const parsed = meSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
