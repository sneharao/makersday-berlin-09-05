import { useCallback, useState } from "react";
import {
  callAppendMessageApi,
  type AppendMessageResult,
  type ChatMessageClientDto,
} from "~/routes/api/api.chat.chats._sdk";

export interface PendingUserMessage {
  /** Local placeholder id (not the server id). */
  localId: string;
  text: string;
}

export interface UseSendMessageApi {
  isSending: boolean;
  pendingUserMessage: PendingUserMessage | null;
  sendMessage: (input: {
    chatId: string;
    text: string;
    activeArtifactIds: string[];
  }) => Promise<AppendMessageResult>;
}

/**
 * Wraps the send loop:
 *   - Shows the user's bubble optimistically (`pendingUserMessage`).
 *   - Awaits the server response.
 *   - Adds a small artificial delay before resolving so the assistant bubble
 *     feels like it streamed in (~400 ms — matches the ticket's spec).
 *
 * The component owns the canonical `messages` list — this hook only surfaces
 * the in-flight state. On success, the component splices the persisted
 * `userMessage` and `assistantMessage` into the list and clears the pending
 * placeholder.
 */
const ASSISTANT_REVEAL_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useSendMessage(): UseSendMessageApi {
  const [isSending, setIsSending] = useState<boolean>(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<PendingUserMessage | null>(null);

  const sendMessage = useCallback(
    async (input: {
      chatId: string;
      text: string;
      activeArtifactIds: string[];
    }): Promise<AppendMessageResult> => {
      const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setIsSending(true);
      setPendingUserMessage({ localId, text: input.text });

      try {
        const result = await callAppendMessageApi(input.chatId, {
          text: input.text,
          activeArtifactIds: input.activeArtifactIds,
        });
        if (result.ok) {
          await delay(ASSISTANT_REVEAL_DELAY_MS);
        }
        return result;
      } finally {
        setIsSending(false);
        setPendingUserMessage(null);
      }
    },
    [],
  );

  return { isSending, pendingUserMessage, sendMessage };
}

export type { ChatMessageClientDto };
