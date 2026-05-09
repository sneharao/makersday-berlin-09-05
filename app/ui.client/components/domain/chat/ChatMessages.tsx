import { useEffect, useRef } from "react";
import type { ChatMessageClientDto } from "~/routes/api/api.chat.chats._sdk";
import { ChatBubble } from "./ChatBubble";
import type { PendingUserMessage } from "./hooks/use-send-message";

export interface ChatMessagesProps {
  messages: ChatMessageClientDto[];
  pendingUserMessage: PendingUserMessage | null;
  isAwaitingAssistant: boolean;
  artifactTitleById: Map<string, string>;
  onCitationClick: (artifactId: string) => void;
}

export function ChatMessages({
  messages,
  pendingUserMessage,
  isAwaitingAssistant,
  artifactTitleById,
  onCitationClick,
}: ChatMessagesProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pendingUserMessage, isAwaitingAssistant]);

  return (
    <div className="flex-1 overflow-y-auto p-gutter flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col gap-lg pb-xl">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            artifactTitleById={artifactTitleById}
            onCitationClick={onCitationClick}
          />
        ))}

        {pendingUserMessage ? (
          <div className="flex w-full justify-end">
            <div className="bg-primary/80 text-on-primary rounded-3xl rounded-tr-sm p-6 max-w-[85%] shadow-sm opacity-90">
              <p className="text-body-md font-body-md whitespace-pre-wrap m-0">{pendingUserMessage.text}</p>
            </div>
          </div>
        ) : null}

        {isAwaitingAssistant ? (
          <div className="flex w-full justify-start" role="status" aria-live="polite">
            <div className="bg-surface-container-lowest rounded-3xl rounded-tl-sm p-6 max-w-[85%] shadow-sm border border-outline-variant flex items-center gap-sm">
              <span className="material-symbols-outlined animate-spin text-on-surface-variant">progress_activity</span>
              <span className="text-body-sm font-body-sm text-on-surface-variant">Scholastic AI is thinking…</span>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
