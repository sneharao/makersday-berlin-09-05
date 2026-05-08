import type { AuthProvider, User } from "./user";

export interface UserRepo {
  getById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByAuthSubject(provider: AuthProvider, subjectId: string): Promise<User | null>;
  save(user: User): Promise<User>;
  deactivate(userId: string): Promise<void>;
}
