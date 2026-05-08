import { redirect } from "react-router";
import type { LoginService } from "@backend-application/authentication/login.service";
import type { SessionContext } from "@backend-application/authentication/session-context";
import {
  toAuthenticatedUserDto,
  type AuthenticatedUserDto,
  type MeDto,
} from "@backend-application/authentication/auth.dto";
import {
  serializeClearCookie,
  serializeSessionCookie,
} from "@backend-platform/infrastructure/route-utils/session-cookie";

export interface CookieOptions {
  isProduction: boolean;
  ttlSeconds: number;
}

export interface LoginActionResult {
  user: AuthenticatedUserDto;
  setCookie: string;
}

export interface LogoutActionResult {
  setCookie: string;
}

const LOGIN_REDIRECT_PATH = "/login";

export class LoginController {
  constructor(
    private readonly loginService: LoginService,
    private readonly cookieOptions: CookieOptions,
  ) {}

  public async getSessionContext(request: Request): Promise<SessionContext | null> {
    return this.loginService.getSessionContext(request);
  }

  public async enforceAuth(request: Request): Promise<SessionContext> {
    const ctx = await this.loginService.getSessionContext(request);
    if (!ctx) {
      throw redirect(LOGIN_REDIRECT_PATH);
    }
    return ctx;
  }

  public async handleUsernamePasswordLogin(request: Request): Promise<LoginActionResult> {
    const result = await this.loginService.handleUsernamePasswordLogin(request);
    const setCookie = serializeSessionCookie(result.sessionToken, this.cookieOptions);
    return { user: result.user, setCookie };
  }

  public async getMe(request: Request): Promise<MeDto | null> {
    const ctx = await this.loginService.getSessionContext(request);
    if (!ctx) return null;
    return {
      user: toAuthenticatedUserDto(ctx.user),
      sessionStartedAt: ctx.sessionStartedAt,
    };
  }

  public async logout(): Promise<LogoutActionResult> {
    await this.loginService.logout();
    return { setCookie: serializeClearCookie({ isProduction: this.cookieOptions.isProduction }) };
  }
}
