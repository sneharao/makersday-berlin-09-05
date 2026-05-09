import { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";
import { GridFsBucket } from "@backend-platform/infrastructure/mongo/gridfs-bucket";
import { UserMongoRepo } from "@backend-infrastructure/repositories/user/user-mongo.repo";
import { LibraryMongoRepo } from "@backend-infrastructure/repositories/library/library-mongo.repo";
import { ChatMongoRepo } from "@backend-infrastructure/repositories/chat/chat-mongo.repo";
import { LoginService } from "@backend-application/authentication/login.service";
import { LibraryService } from "@backend-application/library/library.service";
import { ChatService } from "@backend-application/chat/chat.service";
import { parsePdfWithPdfParse } from "@backend-infrastructure/gateways/library/pdf-parse.adapter";
import { CannedChatResponseAdapter } from "@backend-infrastructure/gateways/chat/canned-chat-response.adapter";
import type { AppConfig } from "./run-config";

export interface ApplicationInstances {
  mongoClient: MongoDBClient;
  userRepository: UserMongoRepo;
  libraryRepository: LibraryMongoRepo;
  chatRepository: ChatMongoRepo;
  loginService: LoginService;
  libraryService: LibraryService;
  chatService: ChatService;
}

export function buildApplicationInstances(config: AppConfig): ApplicationInstances {
  const mongoClient = new MongoDBClient(config.mongo.connectionString, config.mongo.database);
  const userRepository = new UserMongoRepo(mongoClient);
  const gridFsBucket = new GridFsBucket(mongoClient, "artifacts");
  const libraryRepository = new LibraryMongoRepo(mongoClient, gridFsBucket);
  const chatRepository = new ChatMongoRepo(mongoClient);

  const loginService = new LoginService(config.auth, userRepository, () => new Date());
  const libraryService = new LibraryService(
    libraryRepository,
    config.library,
    () => new Date(),
    parsePdfWithPdfParse,
  );
  const chatResponseGateway = new CannedChatResponseAdapter();
  const chatService = new ChatService(
    chatRepository,
    libraryService,
    chatResponseGateway,
    config.chat,
    () => new Date(),
  );

  return {
    mongoClient,
    userRepository,
    libraryRepository,
    chatRepository,
    loginService,
    libraryService,
    chatService,
  };
}
