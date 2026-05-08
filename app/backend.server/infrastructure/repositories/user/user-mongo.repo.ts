import { Repository } from "@backend-platform/infrastructure/mongo/repository";
import type { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";
import { userSchema, type AuthProvider, type User } from "@backend-domain/user/user";
import type { UserRepo } from "@backend-domain/user/user.repo";
import { UserMongoModel, type UserMongoDocument } from "./user-mongo.model";

export class UserMongoRepo extends Repository<UserMongoDocument, User> implements UserRepo {
  constructor(mongoClient: MongoDBClient) {
    super({
      entityClass: UserMongoModel,
      mongoClient,
      modelName: "users",
      zodSchema: userSchema,
    });
  }

  public async getById(userId: string): Promise<User | null> {
    const doc = await this._findOne({ id: userId });
    return doc ? this.documentToEntity(doc) : null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const doc = await this._findOne({ email: email.trim().toLowerCase() });
    return doc ? this.documentToEntity(doc) : null;
  }

  public async findByAuthSubject(provider: AuthProvider, subjectId: string): Promise<User | null> {
    const doc = await this._findOne({ "authSubject.provider": provider, "authSubject.subjectId": subjectId });
    return doc ? this.documentToEntity(doc) : null;
  }

  public async save(user: User): Promise<User> {
    const validated = this.validateEntityForWrite(user);
    const updated = await this._updateOne({ id: user.id }, { $set: validated });
    if (updated) {
      return this.documentToEntity(updated);
    }
    const inserted = await this._insert(validated);
    return this.documentToEntity(inserted);
  }

  public async deactivate(userId: string): Promise<void> {
    await this._updateOne({ id: userId }, { $set: { isActive: false, updatedAt: new Date() } });
  }
}
