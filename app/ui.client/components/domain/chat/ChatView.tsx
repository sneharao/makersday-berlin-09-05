import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { AuthenticatedUserDto } from "@backend-application/authentication/auth.dto";
import type { ArtifactDto, LibraryDto } from "@backend-application/library/library.dto";
import type {
  ChatDto,
  ChatMessageDto,
} from "@backend-application/chat/chat.dto";
import { Sidebar } from "@components/layout/AppShell/Sidebar";
import { TopAppBar } from "@components/layout/AppShell/TopAppBar";
import { callLogoutApi } from "~/routes/api/api.auth._sdk";
import type { ChatMessageClientDto } from "~/routes/api/api.chat.chats._sdk";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import {
  SourceDocumentsPanel,
  type SourceDocumentsPanelHandle,
} from "./SourceDocumentsPanel";
import { IncludeDocumentsModal } from "./IncludeDocumentsModal";
import { useSendMessage } from "./hooks/use-send-message";

export interface ChatViewProps {
  user: AuthenticatedUserDto;
  chat: ChatDto;
  initialMessages: ChatMessageDto[];
  library: LibraryDto;
  artifacts: ArtifactDto[];
}

function toClientMessage(message: ChatMessageDto): ChatMessageClientDto {
  return {
    id: message.id,
    chatId: message.chatId,
    sequence: message.sequence,
    role: message.role,
    body: message.body,
    citations: message.citations,
    createdAt: new Date(message.createdAt),
  };
}

export function ChatView({
  user,
  chat,
  initialMessages,
  artifacts,
}: ChatViewProps): React.JSX.Element {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessageClientDto[]>(() =>
    initialMessages.map(toClientMessage),
  );
  const [activeArtifactIds, setActiveArtifactIds] = useState<string[]>([]);
  const [highlightedArtifactId, setHighlightedArtifactId] = useState<string | null>(null);
  const [isIncludeModalOpen, setIsIncludeModalOpen] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const panelRef = useRef<SourceDocumentsPanelHandle | null>(null);

  const { isSending, pendingUserMessage, sendMessage } = useSendMessage();

  const handleSignOut = useCallback(async (): Promise<void> => {
    await callLogoutApi();
    navigate("/login");
  }, [navigate]);

  const artifactTitleById = useMemo(() => {
    return new Map(artifacts.map((a) => [a.id, a.title]));
  }, [artifacts]);

  const referencedArtifactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const message of messages) {
      for (const citation of message.citations) {
        ids.add(citation.artifactId);
      }
    }
    return ids;
  }, [messages]);

  const handleSubmit = useCallback(
    async (text: string): Promise<void> => {
      setSendError(null);
      const result = await sendMessage({
        chatId: chat.id,
        text,
        activeArtifactIds,
      });
      if (!result.ok) {
        setSendError(result.message);
        return;
      }
      setMessages((current) => [
        ...current,
        { ...result.userMessage, createdAt: new Date(result.userMessage.createdAt) },
        {
          ...result.assistantMessage,
          createdAt: new Date(result.assistantMessage.createdAt),
        },
      ]);
      const lastCitation = result.assistantMessage.citations[0];
      if (lastCitation) {
        setHighlightedArtifactId(lastCitation.artifactId);
        panelRef.current?.scrollToArtifact(lastCitation.artifactId);
      }
    },
    [activeArtifactIds, chat.id, sendMessage],
  );

  const handleCitationClick = useCallback((artifactId: string): void => {
    setHighlightedArtifactId(artifactId);
    panelRef.current?.scrollToArtifact(artifactId);
  }, []);

  const handleApplySelection = useCallback((ids: string[]): void => {
    setActiveArtifactIds(ids);
  }, []);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex">
      <Sidebar currentChatId={chat.id} />
      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        <TopAppBar user={user} onSignOut={handleSignOut} />
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-surface-bright">
          <section className="flex-1 flex flex-col bg-surface-bright min-w-0 relative z-0">
            <ChatMessages
              messages={messages}
              pendingUserMessage={pendingUserMessage}
              isAwaitingAssistant={isSending && !!pendingUserMessage}
              artifactTitleById={artifactTitleById}
              onCitationClick={handleCitationClick}
            />
            {sendError ? (
              <div
                className="mx-auto w-full max-w-3xl mb-sm px-gutter"
                role="alert"
              >
                <div className="rounded-lg bg-error-container text-on-error-container border border-error/30 px-sm py-xs text-body-sm font-body-sm">
                  {sendError}
                </div>
              </div>
            ) : null}
            <ChatComposer isSending={isSending} onSubmit={handleSubmit} />
          </section>
          <SourceDocumentsPanel
            ref={panelRef}
            artifacts={artifacts}
            referencedArtifactIds={referencedArtifactIds}
            activeArtifactIds={activeArtifactIds}
            highlightedArtifactId={highlightedArtifactId}
            onIncludeMoreClick={() => setIsIncludeModalOpen(true)}
          />
        </main>
      </div>

      <IncludeDocumentsModal
        isOpen={isIncludeModalOpen}
        artifacts={artifacts}
        initialSelection={activeArtifactIds}
        onClose={() => setIsIncludeModalOpen(false)}
        onConfirm={handleApplySelection}
      />
    </div>
  );
}
