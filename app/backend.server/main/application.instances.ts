import { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";
import { GridFsBucket } from "@backend-platform/infrastructure/mongo/gridfs-bucket";
import { UserMongoRepo } from "@backend-infrastructure/repositories/user/user-mongo.repo";
import { LibraryMongoRepo } from "@backend-infrastructure/repositories/library/library-mongo.repo";
import { LoginService } from "@backend-application/authentication/login.service";
import { LibraryService } from "@backend-application/library/library.service";
import { parsePdfWithPdfParse } from "@backend-infrastructure/gateways/library/pdf-parse.adapter";
import type { AppConfig } from "./run-config";

export interface ApplicationInstances {
  mongoClient: MongoDBClient;
  userRepository: UserMongoRepo;
  libraryRepository: LibraryMongoRepo;
  loginService: LoginService;
  libraryService: LibraryService;
}

export function buildApplicationInstances(config: AppConfig): ApplicationInstances {
  const mongoClient = new MongoDBClient(config.mongo.connectionString, config.mongo.database);
  const userRepository = new UserMongoRepo(mongoClient);
  const gridFsBucket = new GridFsBucket(mongoClient, "artifacts");
  const libraryRepository = new LibraryMongoRepo(mongoClient, gridFsBucket);

  const loginService = new LoginService(config.auth, userRepository, () => new Date());
  const libraryService = new LibraryService(
    libraryRepository,
    config.library,
    () => new Date(),
    parsePdfWithPdfParse,
  );

  return { mongoClient, userRepository, libraryRepository, loginService, libraryService };
}
