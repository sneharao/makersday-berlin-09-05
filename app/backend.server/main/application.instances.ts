import { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";
import { UserMongoRepo } from "@backend-infrastructure/repositories/user/user-mongo.repo";
import { LoginService } from "@backend-application/authentication/login.service";
import type { AppConfig } from "./run-config";

export interface ApplicationInstances {
  mongoClient: MongoDBClient;
  userRepository: UserMongoRepo;
  loginService: LoginService;
}

export function buildApplicationInstances(config: AppConfig): ApplicationInstances {
  const mongoClient = new MongoDBClient(config.mongo.connectionString, config.mongo.database);
  const userRepository = new UserMongoRepo(mongoClient);

  const loginService = new LoginService(config.auth, userRepository, () => new Date());

  return { mongoClient, userRepository, loginService };
}
