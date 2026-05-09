import { describe, expect, it } from "vitest";
import {
  ChatNotFoundError,
  MessageBodyEmptyError,
  MessageBodyTooLongError,
} from "@backend-application/chat/errors";
import type { Library } from "@backend-domain/library/library";
import type { Artifact } from "@backend-domain/library/artifact";
import { artifactSchema } from "@backend-domain/library/artifact";
import { librarySchema } from "@backend-domain/library/library";
import { buildChatService, FROZEN_NOW } from "./build-chat-service";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const LIB_A = "00000000-0000-4000-8000-00000000aaa1";
const LIB_B = "00000000-0000-4000-8000-00000000aaa2";
const ARTIFACT_1 = "00000000-0000-4000-8000-00000000bbb1";
const ARTIFACT_2 = "00000000-0000-4000-8000-00000000bbb2";

function library(id: string, userId: string, name: string): Library {
  return librarySchema.parse({
    id,
    userId,
    name,
    isActive: true,
    createdAt: FROZEN_NOW,
    updatedAt: FROZEN_NOW,
  });
}

function readyArtifact(
  id: string,
  libraryId: string,
  title: string,
  pageCount: number,
  hashSeed: string,
): Artifact {
  const sha = hashSeed.padEnd(64, "0").slice(0, 64);
  return artifactSchema.parse({
    id,
    libraryId,
    title,
    kind: "pdf",
    uploadStatus: "ready",
    sourceFile: {
      storageUri: `memory://${id}`,
      byteSize: 1024,
      mimeType: "application/pdf",
      sha256Hash: sha,
    },
    pageCount,
    uploadedAt: FROZEN_NOW,
    processedAt: FROZEN_NOW,
    createdAt: FROZEN_NOW,
    updatedAt: FROZEN_NOW,
  });
}

describe("ChatService.createChat (AC#2 — new session on entry)", () => {
  it("creates a chat bound to the user's existing default library and persists a system greeting at sequence 1", async () => {
    const { chatService, chatRepo } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
      artifacts: [readyArtifact(ARTIFACT_1, LIB_A, "Digital Things", 50, "deadbeef")],
    });

    const result = await chatService.createChat(USER_A);

    expect(result.chat.userId).toBe(USER_A);
    expect(result.chat.libraryId).toBe(LIB_A);
    expect(result.chat.title).toBe("New chat");
    expect(result.chat.isActive).toBe(true);

    expect(result.messages).toHaveLength(1);
    const greeting = result.messages[0]!;
    expect(greeting.role).toBe("system");
    expect(greeting.sequence).toBe(1);
    expect(greeting.body.text).toContain("My Library");
    expect(greeting.body.text).toContain("Digital Things");
    expect(greeting.citations).toEqual([]);

    const persisted = chatRepo.messagesFor(result.chat.id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.id).toBe(greeting.id);
  });

  it("auto-provisions a default library when the user does not yet have one", async () => {
    const { chatService, libraryRepo } = buildChatService();

    const result = await chatService.createChat(USER_A);

    const libraries = await libraryRepo.listLibrariesForUser(USER_A);
    expect(libraries).toHaveLength(1);
    expect(libraries[0]!.id).toBe(result.chat.libraryId);
  });

  it("returns the empty-library greeting when the library has no artifacts (AC#6)", async () => {
    const { chatService } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
    });

    const result = await chatService.createChat(USER_A);

    const greeting = result.messages[0]!;
    expect(greeting.role).toBe("system");
    expect(greeting.body.text).toContain("does not contain any documents");
    expect(greeting.body.text).toContain("Library");
  });
});

describe("ChatService.appendUserMessage (AC#3 send + AC#4 citations + AC#7 persistence)", () => {
  it("persists the user message at the next sequence and returns an assistant reply", async () => {
    const { chatService, chatRepo, responseGateway } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
      artifacts: [readyArtifact(ARTIFACT_1, LIB_A, "Digital Things", 50, "deadbeef")],
    });
    const created = await chatService.createChat(USER_A);
    responseGateway.enqueueReply({
      body: { format: "markdown", text: "Here is the canned summary." },
      citations: [{ artifactId: ARTIFACT_1, pageNumber: 1, excerpt: "Excerpt from page 1" }],
    });

    const result = await chatService.appendUserMessage({
      userId: USER_A,
      chatId: created.chat.id,
      text: "Summarise the document",
      activeArtifactIds: [],
    });

    expect(result.userMessage.role).toBe("user");
    expect(result.userMessage.sequence).toBe(2);
    expect(result.userMessage.body.text).toBe("Summarise the document");
    expect(result.userMessage.citations).toEqual([]);

    expect(result.assistantMessage.role).toBe("assistant");
    expect(result.assistantMessage.sequence).toBe(3);
    expect(result.assistantMessage.body.text).toBe("Here is the canned summary.");
    expect(result.assistantMessage.citations).toHaveLength(1);
    expect(result.assistantMessage.citations[0]).toEqual({
      libraryId: LIB_A,
      artifactId: ARTIFACT_1,
      pageNumber: 1,
      excerpt: "Excerpt from page 1",
    });

    const all = chatRepo.messagesFor(created.chat.id);
    expect(all.map((m) => m.role)).toEqual(["system", "user", "assistant"]);
    expect(all.map((m) => m.sequence)).toEqual([1, 2, 3]);
  });

  it("rejects empty message bodies", async () => {
    const { chatService } = buildChatService();
    const created = await chatService.createChat(USER_A);

    await expect(
      chatService.appendUserMessage({
        userId: USER_A,
        chatId: created.chat.id,
        text: "   ",
        activeArtifactIds: [],
      }),
    ).rejects.toBeInstanceOf(MessageBodyEmptyError);
  });

  it("rejects message bodies that exceed the configured max characters", async () => {
    const { chatService } = buildChatService();
    const created = await chatService.createChat(USER_A);

    const huge = "a".repeat(5000);
    await expect(
      chatService.appendUserMessage({
        userId: USER_A,
        chatId: created.chat.id,
        text: huge,
        activeArtifactIds: [],
      }),
    ).rejects.toBeInstanceOf(MessageBodyTooLongError);
  });

  it("passes the user-supplied active subset to the gateway (filters citation candidates)", async () => {
    const { chatService, responseGateway } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
      artifacts: [
        readyArtifact(ARTIFACT_1, LIB_A, "Doc 1", 50, "aaaa"),
        readyArtifact(ARTIFACT_2, LIB_A, "Doc 2", 50, "bbbb"),
      ],
    });
    const created = await chatService.createChat(USER_A);

    await chatService.appendUserMessage({
      userId: USER_A,
      chatId: created.chat.id,
      text: "anything",
      activeArtifactIds: [ARTIFACT_2],
    });

    const lastInput = responseGateway.recordedInputs[responseGateway.recordedInputs.length - 1]!;
    expect(lastInput.candidateArtifacts.map((a) => a.id)).toEqual([ARTIFACT_2]);
  });

  it("drops citations whose pageNumber is out of range (does not throw)", async () => {
    const { chatService, responseGateway } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
      artifacts: [readyArtifact(ARTIFACT_1, LIB_A, "Doc", 10, "cccc")],
    });
    const created = await chatService.createChat(USER_A);
    responseGateway.enqueueReply({
      body: { format: "markdown", text: "Reply with two citations" },
      citations: [
        { artifactId: ARTIFACT_1, pageNumber: 1 },
        { artifactId: ARTIFACT_1, pageNumber: 999 },
      ],
    });

    const result = await chatService.appendUserMessage({
      userId: USER_A,
      chatId: created.chat.id,
      text: "ok",
      activeArtifactIds: [],
    });

    expect(result.assistantMessage.citations).toHaveLength(1);
    expect(result.assistantMessage.citations[0]!.pageNumber).toBe(1);
  });

  it("drops citations whose artifactId does not resolve in the user's library", async () => {
    const { chatService, responseGateway } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
      artifacts: [readyArtifact(ARTIFACT_1, LIB_A, "Doc", 10, "cccc")],
    });
    const created = await chatService.createChat(USER_A);
    responseGateway.enqueueReply({
      body: { format: "markdown", text: "Reply" },
      citations: [{ artifactId: "00000000-0000-4000-8000-00000000ffff", pageNumber: 1 }],
    });

    const result = await chatService.appendUserMessage({
      userId: USER_A,
      chatId: created.chat.id,
      text: "ok",
      activeArtifactIds: [],
    });

    expect(result.assistantMessage.citations).toEqual([]);
  });

  it("invokes the gateway with an empty candidate set when the library is empty (AC#6)", async () => {
    const { chatService, responseGateway } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
    });
    const created = await chatService.createChat(USER_A);

    await chatService.appendUserMessage({
      userId: USER_A,
      chatId: created.chat.id,
      text: "anything",
      activeArtifactIds: [],
    });

    const lastInput = responseGateway.recordedInputs[responseGateway.recordedInputs.length - 1]!;
    expect(lastInput.candidateArtifacts).toEqual([]);
  });
});

describe("ChatService.getChat (AC#7 persistence)", () => {
  it("returns the chat with messages in sequence order", async () => {
    const { chatService, responseGateway } = buildChatService({
      libraries: [library(LIB_A, USER_A, "My Library")],
      artifacts: [readyArtifact(ARTIFACT_1, LIB_A, "Doc", 5, "dddd")],
    });
    const created = await chatService.createChat(USER_A);
    responseGateway.enqueueReply({
      body: { format: "markdown", text: "Reply" },
      citations: [],
    });
    await chatService.appendUserMessage({
      userId: USER_A,
      chatId: created.chat.id,
      text: "Hi",
      activeArtifactIds: [],
    });

    const fetched = await chatService.getChat(USER_A, created.chat.id);

    expect(fetched.chat.id).toBe(created.chat.id);
    expect(fetched.messages.map((m) => m.role)).toEqual(["system", "user", "assistant"]);
    expect(fetched.messages.map((m) => m.sequence)).toEqual([1, 2, 3]);
  });
});

describe("ChatService — authorisation (AC#8)", () => {
  it("user A cannot fetch user B's chat", async () => {
    const { chatService } = buildChatService({
      libraries: [library(LIB_B, USER_B, "My Library")],
    });
    const created = await chatService.createChat(USER_B);

    await expect(chatService.getChat(USER_A, created.chat.id)).rejects.toBeInstanceOf(
      ChatNotFoundError,
    );
  });

  it("user A cannot append a message to user B's chat", async () => {
    const { chatService } = buildChatService({
      libraries: [library(LIB_B, USER_B, "My Library")],
    });
    const created = await chatService.createChat(USER_B);

    await expect(
      chatService.appendUserMessage({
        userId: USER_A,
        chatId: created.chat.id,
        text: "Trying to read your chat",
        activeArtifactIds: [],
      }),
    ).rejects.toBeInstanceOf(ChatNotFoundError);
  });
});
