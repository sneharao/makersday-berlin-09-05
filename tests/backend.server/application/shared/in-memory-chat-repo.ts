import {
  chatMessageSchema,
  type ChatMessage,
} from "@backend-domain/chat/chat-message";
import { chatSchema, type Chat } from "@backend-domain/chat/chat";
import type {
  AppendMessageInput,
  ChatRepo,
  ListChatsFilter,
} from "@backend-domain/chat/chat.repo";

/**
 * In-memory `ChatRepo` for unit tests. Mirrors the Mongo adapter's invariants:
 * - `(chatId, sequence)` strict monotonic-no-gaps allocation
 * - tenancy enforcement: message methods first verify the parent chat
 *   belongs to the requesting user; if not, behave as if the chat does not
 *   exist (return null / throw).
 */
export class InMemoryChatRepo implements ChatRepo {
  private readonly chats = new Map<string, Chat>();
  private readonly messages = new Map<string, ChatMessage[]>();

  seedChats(chats: Chat[]): void {
    for (const chat of chats) {
      this.chats.set(chat.id, chat);
    }
  }

  /** Inspection helper for assertions. */
  messagesFor(chatId: string): ChatMessage[] {
    return [...(this.messages.get(chatId) ?? [])];
  }

  /** Inspection helper for assertions. */
  allChats(): Chat[] {
    return Array.from(this.chats.values());
  }

  async getById(userId: string, chatId: string): Promise<Chat | null> {
    const chat = this.chats.get(chatId);
    if (!chat || chat.userId !== userId) return null;
    return chat;
  }

  async listForUser(userId: string, filter: ListChatsFilter = {}): Promise<Chat[]> {
    return Array.from(this.chats.values())
      .filter((chat) => chat.userId === userId)
      .filter((chat) => (filter.isActive === undefined ? true : chat.isActive === filter.isActive))
      .filter((chat) => (filter.libraryId === undefined ? true : chat.libraryId === filter.libraryId))
      .sort((a, b) => {
        const aTs = a.lastMessageAt?.getTime() ?? a.createdAt.getTime();
        const bTs = b.lastMessageAt?.getTime() ?? b.createdAt.getTime();
        return bTs - aTs;
      });
  }

  async save(chat: Chat): Promise<Chat> {
    const validated = chatSchema.parse(chat);
    this.chats.set(validated.id, validated);
    if (!this.messages.has(validated.id)) {
      this.messages.set(validated.id, []);
    }
    return validated;
  }

  async appendMessage(
    userId: string,
    chatId: string,
    input: AppendMessageInput,
  ): Promise<ChatMessage> {
    const chat = await this.getById(userId, chatId);
    if (!chat) {
      throw new Error(`Chat ${chatId} not found for user ${userId}`);
    }

    const existing = this.messages.get(chatId) ?? [];
    const nextSequence = existing.length === 0 ? 1 : existing[existing.length - 1]!.sequence + 1;

    const message: ChatMessage = chatMessageSchema.parse({
      id: input.messageId,
      chatId,
      sequence: nextSequence,
      role: input.role,
      body: input.body,
      citations: input.citations,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    });

    this.messages.set(chatId, [...existing, message]);

    const updatedChat: Chat = {
      ...chat,
      lastMessageAt: message.createdAt,
      updatedAt: message.createdAt,
    };
    this.chats.set(chatId, updatedChat);

    return message;
  }

  async listMessagesForChat(userId: string, chatId: string): Promise<ChatMessage[]> {
    const chat = await this.getById(userId, chatId);
    if (!chat) return [];
    return [...(this.messages.get(chatId) ?? [])].sort((a, b) => a.sequence - b.sequence);
  }
}
