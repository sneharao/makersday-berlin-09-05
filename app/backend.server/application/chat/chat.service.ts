import { randomUUID } from "node:crypto";
import type { Chat } from "@backend-domain/chat/chat";
import type {
  ChatMessage,
  Citation,
  MessageBody,
} from "@backend-domain/chat/chat-message";
import type { AppendMessageInput, ChatRepo } from "@backend-domain/chat/chat.repo";
import type { LibraryService } from "@backend-application/library/library.service";
import type { ArtifactDto } from "@backend-application/library/library.dto";
import type { ChatConfig } from "./config";
import {
  ChatNotFoundError,
  MessageBodyEmptyError,
  MessageBodyTooLongError,
} from "./errors";
import {
  toChatDto,
  toMessageDto,
  type AppendUserMessageRequest,
  type AppendUserMessageResult,
  type ChatDto,
  type ChatWithMessagesDto,
} from "./chat.dto";
import type { ChatResponseGateway } from "./chat-response.gateway";

export class ChatService {
  constructor(
    private readonly chatRepo: ChatRepo,
    private readonly libraryService: LibraryService,
    private readonly responseGateway: ChatResponseGateway,
    private readonly config: ChatConfig,
    private readonly clock: () => Date,
  ) {}

  /**
   * Creates a new chat bound to the user's default library and immediately
   * appends a `system` greeting at sequence 1 so the History view (GR-004)
   * resumes the chat with a non-empty transcript.
   *
   * The greeting is a snapshot of `ChatConfig.systemGreeting*` at write-time;
   * if the template later changes, existing chats keep the original text.
   * That is intentional (faithful audit) — do NOT re-derive on read.
   */
  public async createChat(userId: string): Promise<ChatWithMessagesDto> {
    const library = await this.libraryService.ensureDefaultLibrary(userId);
    const artifacts = await this.libraryService.listArtifacts(userId);
    const now = this.clock();

    const chat: Chat = {
      id: randomUUID(),
      userId,
      libraryId: library.id,
      title: this.config.defaultChatTitle,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const savedChat = await this.chatRepo.save(chat);

    const greeting = this.buildSystemGreeting(library.name, artifacts);
    const greetingMessage = await this.chatRepo.appendMessage(userId, savedChat.id, {
      messageId: randomUUID(),
      role: "system",
      body: greeting,
      citations: [],
      createdAt: this.clock(),
    });

    const refreshed = await this.requireChat(userId, savedChat.id);
    return {
      chat: toChatDto(refreshed),
      messages: [toMessageDto(greetingMessage)],
    };
  }

  public async getChat(userId: string, chatId: string): Promise<ChatWithMessagesDto> {
    const chat = await this.requireChat(userId, chatId);
    const messages = await this.chatRepo.listMessagesForChat(userId, chat.id);
    return {
      chat: toChatDto(chat),
      messages: messages.map(toMessageDto),
    };
  }

  public async appendUserMessage(
    request: AppendUserMessageRequest,
  ): Promise<AppendUserMessageResult> {
    const trimmed = request.text.trim();
    if (trimmed.length === 0) {
      throw new MessageBodyEmptyError();
    }
    if (trimmed.length > this.config.messageMaxBodyChars) {
      throw new MessageBodyTooLongError(this.config.messageMaxBodyChars);
    }

    const chat = await this.requireChat(request.userId, request.chatId);

    const userMessage = await this.chatRepo.appendMessage(request.userId, chat.id, {
      messageId: randomUUID(),
      role: "user",
      body: { format: "markdown", text: trimmed },
      citations: [],
      createdAt: this.clock(),
    });

    const candidates = await this.resolveCandidateArtifacts(
      request.userId,
      request.activeArtifactIds,
    );

    const transcript = await this.chatRepo.listMessagesForChat(request.userId, chat.id);
    // Drop the just-appended user message so the gateway sees it as the
    // explicit `userPrompt` only, matching the documented contract.
    const transcriptWithoutLast = transcript.filter((m) => m.id !== userMessage.id);

    const reply = await this.responseGateway.generateReply({
      chat,
      transcript: transcriptWithoutLast,
      userPrompt: trimmed,
      candidateArtifacts: candidates,
    });

    const validatedCitations = await this.validateCitations(
      request.userId,
      chat.libraryId,
      reply.citations,
    );

    const assistantMessage = await this.chatRepo.appendMessage(request.userId, chat.id, {
      messageId: randomUUID(),
      role: "assistant",
      body: reply.body,
      citations: validatedCitations,
      createdAt: this.clock(),
    });

    return {
      userMessage: toMessageDto(userMessage),
      assistantMessage: toMessageDto(assistantMessage),
    };
  }

  public async listChatsForUser(userId: string): Promise<ChatDto[]> {
    const chats = await this.chatRepo.listForUser(userId, { isActive: true });
    return chats.map(toChatDto);
  }

  private async requireChat(userId: string, chatId: string): Promise<Chat> {
    const chat = await this.chatRepo.getById(userId, chatId);
    if (!chat) {
      throw new ChatNotFoundError();
    }
    return chat;
  }

  private async resolveCandidateArtifacts(
    userId: string,
    activeArtifactIds: string[],
  ): Promise<ArtifactDto[]> {
    const all = await this.libraryService.listArtifacts(userId);
    if (activeArtifactIds.length === 0) {
      return all;
    }
    const allowed = new Set(activeArtifactIds);
    return all.filter((artifact) => allowed.has(artifact.id));
  }

  /**
   * Defensive citation validation: drops citations whose `pageNumber` is
   * outside the artifact's `[1, pageCount]` range or whose `artifactId` does
   * not resolve in the user's library. The user always gets a reply; only
   * bad chips are suppressed (logged).
   */
  private async validateCitations(
    userId: string,
    chatLibraryId: string,
    drafts: ReadonlyArray<{ artifactId: string; pageNumber: number; excerpt?: string }>,
  ): Promise<Citation[]> {
    const validated: Citation[] = [];
    for (const draft of drafts) {
      const artifact = await this.libraryService.getArtifactById(userId, draft.artifactId);
      if (!artifact) {
        // Unknown / non-owned artifact — drop silently.
        continue;
      }
      const pageCount = artifact.pageCount ?? 0;
      if (
        draft.pageNumber < 1 ||
        (pageCount > 0 && draft.pageNumber > pageCount)
      ) {
        // Out of range — drop and log; do not throw.
        // eslint-disable-next-line no-console
        console.warn(
          `[ChatService] dropping citation: page ${draft.pageNumber} out of range for artifact ${artifact.id} (pageCount=${pageCount})`,
        );
        continue;
      }
      validated.push({
        libraryId: chatLibraryId,
        artifactId: artifact.id,
        pageNumber: draft.pageNumber,
        excerpt: draft.excerpt,
      });
    }
    return validated;
  }

  private buildSystemGreeting(libraryName: string, artifacts: ArtifactDto[]): MessageBody {
    const ready = artifacts.filter((a) => a.uploadStatus === "ready");
    const template =
      ready.length === 0
        ? this.config.systemGreetingWithoutDocument
        : this.config.systemGreetingWithDocument;
    const text = template
      .replace("{libraryName}", libraryName)
      .replace("{firstArtifactTitle}", ready[0]?.title ?? "");
    return { format: "markdown", text };
  }
}
