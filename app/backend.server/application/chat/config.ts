import { z } from "zod";
import { readFromEnv } from "@backend-platform/shared/env/env-utils";

const DEFAULT_CHAT_TITLE = "New chat";
const DEFAULT_MESSAGE_MAX_BODY_CHARS = 4000;

/**
 * The system priming message rendered at the top of every fresh chat.
 *
 * Persisted as a `system` ChatMessage at chat creation (sequence 1) so the
 * History view (GR-004) can resume it without special-casing. The greeting
 * is intentionally a snapshot at write-time — if the template changes later,
 * existing chats keep the original text (faithful audit, not a bug).
 *
 * Placeholders:
 *   {libraryName}        — always substituted.
 *   {firstArtifactTitle} — substituted when the library has at least one
 *                          ready artifact; otherwise the surrounding clause
 *                          is dropped via the empty-library variant.
 */
const DEFAULT_SYSTEM_GREETING_WITH_DOC =
  'I have loaded the documents from your "{libraryName}" library. We are currently referencing "{firstArtifactTitle}". What would you like to explore?';

const DEFAULT_SYSTEM_GREETING_WITHOUT_DOC =
  'I have loaded your "{libraryName}" library, but it does not contain any documents yet. Head to the Library page to upload a PDF, then return here to chat with it.';

export class ChatConfig {
  constructor(
    readonly defaultChatTitle: string,
    readonly messageMaxBodyChars: number,
    readonly systemGreetingWithDocument: string,
    readonly systemGreetingWithoutDocument: string,
  ) {}

  static fromEnv(): ChatConfig {
    const env = readFromEnv(
      z.object({
        CHAT_DEFAULT_TITLE: z.string().min(1).default(DEFAULT_CHAT_TITLE),
        CHAT_MESSAGE_MAX_CHARS: z.coerce
          .number()
          .int()
          .positive()
          .default(DEFAULT_MESSAGE_MAX_BODY_CHARS),
      }),
    );
    return new ChatConfig(
      env.CHAT_DEFAULT_TITLE,
      env.CHAT_MESSAGE_MAX_CHARS,
      DEFAULT_SYSTEM_GREETING_WITH_DOC,
      DEFAULT_SYSTEM_GREETING_WITHOUT_DOC,
    );
  }
}
