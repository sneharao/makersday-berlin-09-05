import type { Chat } from "@backend-domain/chat/chat";
import type { ChatMessage, MessageBody } from "@backend-domain/chat/chat-message";
import type { ArtifactDto } from "@backend-application/library/library.dto";

/**
 * Draft of a citation produced by the response gateway. Excludes `libraryId`
 * because the application service stamps it from the parent chat (the gateway
 * does not need to know about chat-level invariants).
 */
export interface CitationDraft {
  artifactId: string;
  pageNumber: number;
  excerpt?: string;
}

export interface GenerateReplyInput {
  chat: Chat;
  /** Ordered transcript so far (does not include the just-appended user prompt). */
  transcript: ChatMessage[];
  /** The user prompt being replied to. */
  userPrompt: string;
  /**
   * Artifacts the gateway may cite. Either the user-selected subset or the
   * full library; the application service has already filtered to the user's
   * active subset (when one was supplied) before invoking the gateway.
   */
  candidateArtifacts: ArtifactDto[];
}

export interface GenerateReplyResult {
  body: MessageBody;
  citations: CitationDraft[];
}

/**
 * Application-layer port: produce an assistant reply for a chat.
 *
 * Today's only adapter is `infrastructure/gateways/chat/canned-chat-response.adapter.ts`
 * (a deterministic templated bank). Swapping to a real LLM/RAG pipeline is a
 * single dependency change in `main/application.instances.ts`. Per
 * `harness/knowledge/repo-architecture/dependency-rules.md` "swap test",
 * placing this behind a port keeps the application ring free of any
 * collaboration-library coupling.
 */
export interface ChatResponseGateway {
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult>;
}
