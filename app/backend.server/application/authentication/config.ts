import { z } from "zod";
import { readFromEnv } from "@backend-platform/shared/env/env-utils";

export type AuthEnvironment = "development" | "staging" | "production";

const DEFAULT_DEMO_EMAIL = "demo@scholastic.ai";
const DEFAULT_DEMO_PASSWORD = "scholastic-demo";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export class AuthConfig {
  constructor(
    readonly isLocal: boolean,
    readonly isProduction: boolean,
    readonly demoEmail: string,
    readonly demoPassword: string,
    readonly sessionCookieSecret: string,
    readonly sessionTtlSeconds: number,
  ) {}

  static fromEnv(deployedEnv: AuthEnvironment): AuthConfig {
    const env = readFromEnv(
      z.object({
        DEMO_LOGIN_EMAIL: z.string().email().default(DEFAULT_DEMO_EMAIL),
        DEMO_LOGIN_PASSWORD: z.string().min(8).default(DEFAULT_DEMO_PASSWORD),
        SESSION_COOKIE_SECRET: z.string().min(32),
        SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(DEFAULT_SESSION_TTL_SECONDS),
      }),
    );

    const isProduction = deployedEnv === "production";

    if (isProduction && env.DEMO_LOGIN_PASSWORD === DEFAULT_DEMO_PASSWORD) {
      throw new Error("DEMO_LOGIN_PASSWORD must be set explicitly in production");
    }

    return new AuthConfig(
      deployedEnv !== "production" && deployedEnv !== "staging",
      isProduction,
      env.DEMO_LOGIN_EMAIL.trim().toLowerCase(),
      env.DEMO_LOGIN_PASSWORD,
      env.SESSION_COOKIE_SECRET,
      env.SESSION_TTL_SECONDS,
    );
  }
}
