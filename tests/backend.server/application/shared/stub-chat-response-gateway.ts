import type {
  ChatResponseGateway,
  GenerateReplyInput,
  GenerateReplyResult,
} from "@backend-application/chat/chat-response.gateway";

/**
 * Test stub for `ChatResponseGateway`. Records every input it sees and
 * returns the next queued reply (or a default body if the queue is empty).
 *
 * Keeps the application unit tests free of any canned-engine logic — the
 * canned adapter has its own dedicated unit tests in the infrastructure
 * test tree.
 */
export class StubChatResponseGateway implements ChatResponseGateway {
  public readonly recordedInputs: GenerateReplyInput[] = [];
  private readonly queued: GenerateReplyResult[] = [];
  private readonly defaultReply: GenerateReplyResult = {
    body: { format: "markdown", text: "stubbed reply" },
    citations: [],
  };

  enqueueReply(reply: GenerateReplyResult): void {
    this.queued.push(reply);
  }

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
    this.recordedInputs.push(input);
    return this.queued.shift() ?? this.defaultReply;
  }
}
