import type { Chat } from "./chat";
import type { ChatMessage, MessageBody, MessageRole, Citation } from "./chat-message";

export interface ListChatsFilter {
  isActive?: boolean;
  libraryId?: string;
}

export interface AppendMessageInput {
  messageId: string;
  role: MessageRole;
  body: MessageBody;
  citations: Citation[];
  createdAt: Date;
}

/**
 * The single port for the `chat` aggregate. `ChatMessage` is an internal
 * entity of `Chat`, so all message-level methods are tenant-scoped via
 * the parent chat's `userId` (per `harness/knowledge/domain/chat/data-model.md`).
 */
export interface ChatRepo {
  // Chat-level — direct tenancy on `userId`.
  getById(userId: string, chatId: string): Promise<Chat | null>;
  listForUser(userId: string, filter?: ListChatsFilter): Promise<Chat[]>;
  save(chat: Chat): Promise<Chat>;

  // Message-level — every method takes `userId` and verifies the parent
  // chat belongs to the requesting tenant before touching `chat_messages`.
  appendMessage(
    userId: string,
    chatId: string,
    input: AppendMessageInput,
  ): Promise<ChatMessage>;
  listMessagesForChat(userId: string, chatId: string): Promise<ChatMessage[]>;
}
