import { createContext, data, redirect } from "react-router";
import type { SessionContext } from "@backend-application/authentication/session-context";
import type { LoginController } from "@backend-infrastructure/api/login-controller";

export const sessionContext = createContext<SessionContext | null>(null);

export const LOGIN_REDIRECT_PATH = "/login";

export interface RequireAuthResult {
  ctx: SessionContext;
}

export async function enforceAuth(
  loginController: LoginController,
  request: Request,
): Promise<SessionContext> {
  const ctx = await loginController.getSessionContext(request);
  if (!ctx) {
    throw redirect(LOGIN_REDIRECT_PATH);
  }
  return ctx;
}

export function unauthenticatedJson(message: string, status: number = 401): ReturnType<typeof data> {
  return data({ error: message }, { status });
}
