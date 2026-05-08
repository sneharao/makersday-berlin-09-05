import { z } from "zod";
import { readFromEnv } from "@backend-platform/shared/env/env-utils";

export class MongoClientConfig {
  constructor(
    readonly connectionString: string,
    readonly database: string,
  ) {}

  static fromEnv(): MongoClientConfig {
    const env = readFromEnv(
      z.object({
        MONGODB_URI: z.string().min(1),
        MONGO_DATABASE: z.string().min(1),
      }),
    );
    return new MongoClientConfig(env.MONGODB_URI, env.MONGO_DATABASE);
  }
}
