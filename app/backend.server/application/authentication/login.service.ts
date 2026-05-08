import { randomUUID, timingSafeEqual } from "node:crypto";
import type { User } from "@backend-domain/user/user";
import type { UserRepo } from "@backend-domain/user/user.repo";
import {
  readSessionCookie,
  signSessionToken,
  verifySessionToken,
} from "@backend-platform/infrastructure/route-utils/session-cookie";
import type { SessionContext } from "./session-context";
import type { AuthConfig } from "./config";
import {
  loginRequestSchema,
  toAuthenticatedUserDto,
  type LoginResultDto,
} from "./auth.dto";
import { InvalidCredentialsError } from "./errors";

const DEMO_DISPLAY_NAME = "Scholastic Demo";
const DEMO_LOCALE = "en-US" as const;
const DEMO_AUTH_PROVIDER = "local" as const;
const DEMO_AUTH_SUBJECT_ID = "demo";

function constantTimeStringEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  const length = Math.max(bufferA.length, bufferB.length, 1);
  const paddedA = Buffer.alloc(length);
  const paddedB = Buffer.alloc(length);
  bufferA.copy(paddedA);
  bufferB.copy(paddedB);
  const equalContent = timingSafeEqual(paddedA, paddedB);
  return equalContent && bufferA.length === bufferB.length;
}

export class LoginService {
  constructor(
    private readonly authConfig: AuthConfig,
    private readonly userRepo: UserRepo,
    private readonly clock: () => Date,
  ) {}

  public async handleUsernamePasswordLogin(request: Request): Promise<LoginResultDto> {
    const rawBody: unknown = await request.json();
    const parsed = loginRequestSchema.parse(rawBody);

    const emailMatch = constantTimeStringEquals(parsed.email, this.authConfig.demoEmail);
    const passwordMatch = constantTimeStringEquals(parsed.password, this.authConfig.demoPassword);

    if (!emailMatch || !passwordMatch) {
      throw new InvalidCredentialsError();
    }

    const user = await this.provisionOrLoadDemoUser();

    const issuedAt = this.clock().getTime();
    const expiresAtMs = issuedAt + this.authConfig.sessionTtlSeconds * 1000;
    const sessionToken = signSessionToken(
      { userId: user.id, email: user.email, issuedAt, expiresAt: expiresAtMs },
      this.authConfig.sessionCookieSecret,
    );

    return {
      user: toAuthenticatedUserDto(user),
      sessionToken,
      expiresAt: new Date(expiresAtMs),
    };
  }

  public async getSessionContext(request: Request): Promise<SessionContext | null> {
    const token = readSessionCookie(request);
    if (!token) return null;

    const payload = verifySessionToken(token, this.authConfig.sessionCookieSecret);
    if (!payload) return null;

    const user = await this.userRepo.getById(payload.userId);
    if (!user || !user.isActive) return null;

    return {
      user,
      userId: user.id,
      email: user.email,
      sessionStartedAt: new Date(payload.issuedAt),
    };
  }

  public async logout(): Promise<void> {
    return;
  }

  public isLocal(): boolean {
    return this.authConfig.isLocal;
  }

  private async provisionOrLoadDemoUser(): Promise<User> {
    const existing = await this.userRepo.findByEmail(this.authConfig.demoEmail);
    if (existing) return existing;

    const now = this.clock();
    const demoUser: User = {
      id: randomUUID(),
      email: this.authConfig.demoEmail,
      displayName: DEMO_DISPLAY_NAME,
      locale: DEMO_LOCALE,
      authSubject: { provider: DEMO_AUTH_PROVIDER, subjectId: DEMO_AUTH_SUBJECT_ID },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    return this.userRepo.save(demoUser);
  }
}
