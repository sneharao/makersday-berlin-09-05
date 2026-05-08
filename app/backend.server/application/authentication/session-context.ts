import type { User } from "@backend-domain/user/user";

export interface SessionContext {
  user: User;
  userId: string;
  email: string;
  sessionStartedAt: Date;
}
