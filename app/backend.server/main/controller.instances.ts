import { LoginController } from "@backend-infrastructure/api/login-controller";
import { HealthController } from "@backend-infrastructure/api/health-controller";
import { LibraryController } from "@backend-infrastructure/api/library/library.controller";
import { ChatController } from "@backend-infrastructure/api/chat/chat.controller";
import { AppConfig } from "./run-config";
import { buildApplicationInstances } from "./application.instances";

const config = AppConfig.fromEnv();
const app = buildApplicationInstances(config);

export const loginController = new LoginController(app.loginService, {
  isProduction: config.auth.isProduction,
  ttlSeconds: config.auth.sessionTtlSeconds,
});

export const healthController = new HealthController(app.mongoClient, config.appVersion, config.environment);

export const libraryController = new LibraryController(app.libraryService, loginController, config.library);

export const chatController = new ChatController(app.chatService, loginController);
