import type { Document, QueryFilter, Model, QueryOptions, UpdateQuery, Types } from "mongoose";
import { getModelForClass } from "@typegoose/typegoose";
import type { z } from "zod";
import type { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";

export interface RepositoryArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Typegoose API requires AnyParamConstructor<any>
  entityClass: new (...args: any[]) => unknown;
  mongoClient: MongoDBClient;
  modelName: string;
  zodSchema: z.ZodSchema;
  versionKey?: boolean;
}

export abstract class Repository<T extends Document, EntityType> {
  protected readonly model: Model<T>;
  protected readonly mongoClient: MongoDBClient;
  private readonly zodSchema: z.ZodSchema;
  private readonly versionKey: boolean;

  protected constructor({ entityClass, mongoClient, modelName, zodSchema, versionKey = false }: RepositoryArgs) {
    this.mongoClient = mongoClient;
    this.zodSchema = zodSchema;
    this.versionKey = versionKey;
    this.model = getModelForClass(entityClass, { options: { customName: modelName } }) as unknown as Model<T>;
  }

  protected async _findById(id: string | Types.ObjectId): Promise<T | null> {
    await this.mongoClient.ensureConnection();
    return this.model.findOne({ id: id } as QueryFilter<T>).exec();
  }

  protected async _findOne(filter: QueryFilter<T>): Promise<T | null> {
    await this.mongoClient.ensureConnection();
    return this.model.findOne(filter).exec();
  }

  protected async _find(filter: QueryFilter<T> = {}, options?: QueryOptions): Promise<T[]> {
    await this.mongoClient.ensureConnection();
    return this.model.find(filter, null, options).exec();
  }

  protected async _insert(data: Partial<EntityType>): Promise<T> {
    await this.mongoClient.ensureConnection();
    const validated = this.validateEntityForWrite(data);
    const entity = new this.model(validated);
    return entity.save();
  }

  protected async _updateOne(filter: QueryFilter<T>, data: UpdateQuery<T>): Promise<T | null> {
    await this.mongoClient.ensureConnection();
    return this.model.findOneAndUpdate(filter, data, { returnDocument: "after" }).exec();
  }

  protected async _deleteOne(filter: QueryFilter<T>): Promise<T | null> {
    await this.mongoClient.ensureConnection();
    return this.model.findOneAndDelete(filter).exec();
  }

  public async count(filter: QueryFilter<T> = {}): Promise<number> {
    await this.mongoClient.ensureConnection();
    return this.model.countDocuments(filter).exec();
  }

  protected validateEntityForWrite(data: Partial<EntityType>): EntityType {
    const result = this.zodSchema.safeParse(data);
    if (result.success) {
      return result.data as EntityType;
    }
    const details = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`[${this.model.modelName}] Insert data failed Zod validation:\n${details}`);
  }

  protected documentToEntity(doc: T): EntityType {
    const { _id: _ignored, ...entityData } = doc.toObject({ versionKey: this.versionKey }) as Record<string, unknown> & {
      _id: unknown;
    };
    const parseResult = this.zodSchema.safeParse(entityData);
    if (parseResult.success) {
      return parseResult.data as EntityType;
    }
    const details = parseResult.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`[${this.model.modelName}] Database data failed Zod validation:\n${details}`);
  }
}
