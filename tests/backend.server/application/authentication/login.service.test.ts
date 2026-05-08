import { describe, expect, it } from "vitest";
import { AuthConfig } from "@backend-application/authentication/config";
import { LoginService } from "@backend-application/authentication/login.service";
import { InvalidCredentialsError } from "@backend-application/authentication/errors";
import { verifySessionToken } from "@backend-platform/infrastructure/route-utils/session-cookie";
import type { User } from "@backend-domain/user/user";
import { InMemoryUserRepo } from "../shared/in-memory-user-repo";

const SECRET = "test-secret-must-be-at-least-32-chars-long";
const DEMO_EMAIL = "demo@scholastic.ai";
const DEMO_PASSWORD = "scholastic-demo";
const TTL_SECONDS = 3600;
const FROZEN_NOW = new Date("2099-01-15T12:00:00.000Z");

function makeAuthConfig(overrides: Partial<{
  isLocal: boolean;
  isProduction: boolean;
  demoEmail: string;
  demoPassword: string;
  sessionCookieSecret: string;
  sessionTtlSeconds: number;
}> = {}): AuthConfig {
  return new AuthConfig(
    overrides.isLocal ?? true,
    overrides.isProduction ?? false,
    overrides.demoEmail ?? DEMO_EMAIL,
    overrides.demoPassword ?? DEMO_PASSWORD,
    overrides.sessionCookieSecret ?? SECRET,
    overrides.sessionTtlSeconds ?? TTL_SECONDS,
  );
}

function makeFixedClock(now: Date = FROZEN_NOW): () => Date {
  return () => now;
}

function makeLoginRequest(body: Record<string, unknown>): Request {
  return new Request("https://example.test/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRequestWithCookie(cookieValue: string): Request {
  return new Request("https://example.test/api/auth/me", {
    headers: { Cookie: `scholasticSession=${cookieValue}` },
  });
}

describe("LoginService.handleUsernamePasswordLogin", () => {
  it("returns a signed token + user DTO and provisions the demo user on first login", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());

    const result = await service.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );

    expect(result.user.email).toBe(DEMO_EMAIL);
    expect(result.user.displayName).toBeTruthy();
    expect(result.expiresAt.getTime()).toBe(FROZEN_NOW.getTime() + TTL_SECONDS * 1000);

    const recovered = verifySessionToken(result.sessionToken, SECRET);
    expect(recovered).not.toBeNull();
    expect(recovered?.userId).toBe(result.user.id);

    expect(userRepo.list()).toHaveLength(1);
    expect(userRepo.list()[0].email).toBe(DEMO_EMAIL);
  });

  it("does not duplicate the demo user across multiple logins", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());

    const first = await service.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );
    const second = await service.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );

    expect(userRepo.list()).toHaveLength(1);
    expect(first.user.id).toBe(second.user.id);
  });

  it("throws InvalidCredentialsError when the password is wrong", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());

    await expect(
      service.handleUsernamePasswordLogin(makeLoginRequest({ email: DEMO_EMAIL, password: "wrong" })),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(userRepo.list()).toHaveLength(0);
  });

  it("throws InvalidCredentialsError when the email is unknown", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());

    await expect(
      service.handleUsernamePasswordLogin(
        makeLoginRequest({ email: "stranger@example.com", password: DEMO_PASSWORD }),
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(userRepo.list()).toHaveLength(0);
  });

  it("throws on malformed bodies (missing fields)", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());

    await expect(
      service.handleUsernamePasswordLogin(makeLoginRequest({ email: DEMO_EMAIL })),
    ).rejects.toBeTruthy();
  });
});

describe("LoginService.getSessionContext", () => {
  it("returns null for a request with no cookie", async () => {
    const service = new LoginService(makeAuthConfig(), new InMemoryUserRepo(), makeFixedClock());
    const request = new Request("https://example.test/api/auth/me");

    expect(await service.getSessionContext(request)).toBeNull();
  });

  it("returns null for a tampered cookie", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());
    const result = await service.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );

    const tampered = result.sessionToken.slice(0, -3) + (result.sessionToken.slice(-3) === "AAA" ? "BBB" : "AAA");
    expect(await service.getSessionContext(makeRequestWithCookie(tampered))).toBeNull();
  });

  it("returns null for a cookie signed with a different secret", async () => {
    const userRepo = new InMemoryUserRepo();
    const sessionService = new LoginService(makeAuthConfig({ sessionCookieSecret: SECRET }), userRepo, makeFixedClock());
    const result = await sessionService.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );

    const verifier = new LoginService(
      makeAuthConfig({ sessionCookieSecret: "rotated-secret-also-32-chars-aaaaa" }),
      userRepo,
      makeFixedClock(),
    );

    expect(await verifier.getSessionContext(makeRequestWithCookie(result.sessionToken))).toBeNull();
  });

  it("returns null when the underlying user is inactive", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());
    const result = await service.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );

    await userRepo.deactivate(result.user.id);

    expect(await service.getSessionContext(makeRequestWithCookie(result.sessionToken))).toBeNull();
  });

  it("returns the resolved SessionContext for a valid token", async () => {
    const userRepo = new InMemoryUserRepo();
    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());
    const result = await service.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );

    const ctx = await service.getSessionContext(makeRequestWithCookie(result.sessionToken));

    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe(result.user.id);
    expect(ctx?.email).toBe(DEMO_EMAIL);
    const issuedAt = (ctx?.sessionStartedAt as Date).getTime();
    expect(issuedAt).toBe(FROZEN_NOW.getTime());
  });
});

describe("LoginService user provisioning details", () => {
  it("does not modify a pre-seeded demo user's id", async () => {
    const userRepo = new InMemoryUserRepo();
    const seeded: User = {
      id: "00000000-0000-4000-8000-000000000001",
      email: DEMO_EMAIL,
      displayName: "Existing Demo",
      locale: "en-US",
      authSubject: { provider: "local", subjectId: "demo" },
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    userRepo.seed([seeded]);

    const service = new LoginService(makeAuthConfig(), userRepo, makeFixedClock());
    const result = await service.handleUsernamePasswordLogin(
      makeLoginRequest({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    );

    expect(result.user.id).toBe(seeded.id);
    expect(userRepo.list()).toHaveLength(1);
  });
});
