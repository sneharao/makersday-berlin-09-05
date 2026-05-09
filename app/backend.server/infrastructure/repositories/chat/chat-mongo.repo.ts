import { getModelForClass } from "@typegoose/typegoose";
import type { Model } from "mongoose";
import { Repository } from "@backend-platform/infrastructure/mongo/repository";
import type { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";
import { chatSchema, type Chat } from "@backend-domain/chat/chat";
import { chatMessageSchema, type ChatMessage } from "@backend-domain/chat/chat-message";
import type {
  AppendMessageInput,
  ChatRepo,
  ListChatsFilter,
} from "@backend-domain/chat/chat.repo";
import { ChatMongoModel, type ChatMongoDocument } from "./chat-mongo.model";
import {
  ChatMessageMongoModel,
  type ChatMessageMongoDocument,
} from "./chat-message-mongo.model";

const MAX_SEQUENCE_RETRIES = 5;

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { code?: number };
  return candidate.code === 11000;
}

export class ChatMongoRepo
  extends Repository<ChatMongoDocument, Chat>
  implements ChatRepo
{
  private readonly messageModel: Model<ChatMessageMongoDocument>;

  constructor(mongoClient: MongoDBClient) {
    super({
      entityClass: ChatMongoModel,
      mongoClient,
      modelName: "chats",
      zodSchema: chatSchema,
    });
    this.messageModel = getModelForClass(ChatMessageMongoModel, {
      options: { customName: "chat_messages" },
    }) as unknown as Model<ChatMessageMongoDocument>;
  }

  public async getById(userId: string, chatId: string): Promise<Chat | null> {
    await this.mongoClient.ensureConnection();
    const doc = await this.model.findOne({ id: chatId, userId }).exec();
    return doc ? this.documentToEntity(doc) : null;
  }

  public async listForUser(userId: string, filter: ListChatsFilter = {}): Promise<Chat[]> {
    await this.mongoClient.ensureConnection();
    const query: Record<string, unknown> = { userId };
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.libraryId !== undefined) query.libraryId = filter.libraryId;
    const docs = await this.model
      .find(query)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .exec();
    return docs.map((doc) => this.documentToEntity(doc));
  }

  public async save(chat: Chat): Promise<Chat> {
    await this.mongoClient.ensureConnection();
    const validated = chatSchema.parse(chat);
    const upserted = await this.model
      .findOneAndUpdate(
        { id: validated.id },
        { $set: validated },
        { new: true, upsert: true, returnDocument: "after" },
      )
      .exec();
    return this.documentToEntity(upserted);
  }

  /**
   * Sequence allocation per `harness/knowledge/domain/chat/data-model.md`:
   *
   * 1. Resolve the parent chat under the requesting tenant.
   * 2. Read the highest existing sequence for `chatId`.
   * 3. Insert with `sequence = max + 1`.
   * 4. The `(chatId, sequence)` unique index is the safety net: on
   *    `code: 11000` (race), retry from step 2.
   * 5. Update the parent chat's `lastMessageAt` and `updatedAt`.
   */
  public async appendMessage(
    userId: string,
    chatId: string,
    input: AppendMessageInput,
  ): Promise<ChatMessage> {
    await this.mongoClient.ensureConnection();

    const chat = await this.getById(userId, chatId);
    if (!chat) {
      throw new Error(`Chat ${chatId} not found for user ${userId}`);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt += 1) {
      const last = await this.messageModel
        .findOne({ chatId })
        .sort({ sequence: -1 })
        .select({ sequence: 1 })
        .exec();
      const nextSequence = (last?.sequence ?? 0) + 1;

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

      try {
        await this.messageModel.create(message);
        await this.model
          .updateOne(
            { id: chatId, userId },
            { $set: { lastMessageAt: message.createdAt, updatedAt: message.createdAt } },
          )
          .exec();
        return message;
      } catch (err) {
        lastError = err;
        if (!isDuplicateKeyError(err)) throw err;
        // Race on (chatId, sequence) — recompute and retry.
      }
    }
    throw lastError ?? new Error("Failed to allocate chat message sequence");
  }

  public async listMessagesForChat(userId: string, chatId: string): Promise<ChatMessage[]> {
    const chat = await this.getById(userId, chatId);
    if (!chat) return [];
    const docs = await this.messageModel.find({ chatId }).sort({ sequence: 1 }).exec();
    return docs.map((doc) => this.parseMessageDoc(doc));
  }

  private parseMessageDoc(doc: ChatMessageMongoDocument): ChatMessage {
    const raw = doc.toObject({ versionKey: false });
    const { _id: _ignored, ...rest } = raw as Record<string, unknown> & { _id: unknown };
    const result = chatMessageSchema.safeParse(rest);
    if (result.success) return result.data;
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`[chat_messages] Database data failed Zod validation:\n${details}`);
  }
}
