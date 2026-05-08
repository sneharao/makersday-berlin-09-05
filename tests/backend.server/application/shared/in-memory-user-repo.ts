import type { AuthProvider, User } from "@backend-domain/user/user";
import type { UserRepo } from "@backend-domain/user/user.repo";

export class InMemoryUserRepo implements UserRepo {
  private readonly users = new Map<string, User>();

  seed(users: User[]): void {
    for (const user of users) this.users.set(user.id, user);
  }

  list(): User[] {
    return Array.from(this.users.values());
  }

  async getById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const target = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === target) return user;
    }
    return null;
  }

  async findByAuthSubject(provider: AuthProvider, subjectId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.authSubject.provider === provider && user.authSubject.subjectId === subjectId) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async deactivate(userId: string): Promise<void> {
    const existing = this.users.get(userId);
    if (existing) {
      this.users.set(userId, { ...existing, isActive: false, updatedAt: new Date() });
    }
  }
}
