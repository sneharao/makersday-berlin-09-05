import { LibraryConfig } from "@backend-application/library/config";
import { LibraryService } from "@backend-application/library/library.service";
import { ChatConfig } from "@backend-application/chat/config";
import { ChatService } from "@backend-application/chat/chat.service";
import type { Library } from "@backend-domain/library/library";
import type { Artifact } from "@backend-domain/library/artifact";
import type { Chat } from "@backend-domain/chat/chat";
import { InMemoryLibraryRepo } from "../shared/in-memory-library-repo";
import { InMemoryChatRepo } from "../shared/in-memory-chat-repo";
import { StubChatResponseGateway } from "../shared/stub-chat-response-gateway";

export const FROZEN_NOW = new Date("2026-05-09T00:00:00.000Z");

export interface BuildChatServiceOptions {
  /** Optional pre-existing libraries (one per user). Auto-created if omitted. */
  libraries?: Library[];
  /** Optional artifacts to seed. Each artifact must reference an existing library. */
  artifacts?: Artifact[];
  /** Optional pre-existing chats. */
  chats?: Chat[];
  /** Override the frozen clock. */
  clock?: () => Date;
  /** Override the chat config. */
  chatConfig?: ChatConfig;
  /** Override the library config. */
  libraryConfig?: LibraryConfig;
}

export interface BuildChatServiceResult {
  chatService: ChatService;
  libraryService: LibraryService;
  chatRepo: InMemoryChatRepo;
  libraryRepo: InMemoryLibraryRepo;
  responseGateway: StubChatResponseGateway;
  clock: () => Date;
}

/**
 * Test factory wiring a real LibraryService against an in-memory library repo
 * (so cross-context behaviour is exercised end-to-end through the public
 * service boundary), plus an in-memory ChatRepo and a stub response gateway.
 *
 * Override only what each test cares about — sane defaults cover the rest.
 */
export function buildChatService(options: BuildChatServiceOptions = {}): BuildChatServiceResult {
  const libraryRepo = new InMemoryLibraryRepo();
  const chatRepo = new InMemoryChatRepo();
  const responseGateway = new StubChatResponseGateway();
  const clock = options.clock ?? (() => FROZEN_NOW);

  if (options.libraries) {
    libraryRepo.seedLibraries(options.libraries);
  }
  if (options.artifacts) {
    libraryRepo.seedArtifacts(options.artifacts);
  }
  if (options.chats) {
    chatRepo.seedChats(options.chats);
  }

  const libraryConfig = options.libraryConfig ?? new LibraryConfig(1, 50 * 1024 * 1024, "My Library");
  const libraryService = new LibraryService(
    libraryRepo,
    libraryConfig,
    clock,
    async () => ({ pageCount: 5 }),
  );

  const chatConfig = options.chatConfig ?? ChatConfig.fromEnv();

  const chatService = new ChatService(chatRepo, libraryService, responseGateway, chatConfig, clock);

  return { chatService, libraryService, chatRepo, libraryRepo, responseGateway, clock };
}
