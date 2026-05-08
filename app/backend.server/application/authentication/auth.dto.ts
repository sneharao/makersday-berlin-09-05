import { z } from "zod";
import type { Locale, User } from "@backend-domain/user/user";

export const loginRequestSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
}

export interface LoginResultDto {
  user: AuthenticatedUserDto;
  sessionToken: string;
  expiresAt: Date;
}

export interface MeDto {
  user: AuthenticatedUserDto;
  sessionStartedAt: Date;
}

export function toAuthenticatedUserDto(user: User): AuthenticatedUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
  };
}
