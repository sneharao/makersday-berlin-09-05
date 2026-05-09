import type { ChatMessageClientDto } from "~/routes/api/api.chat.chats._sdk";
import { CitationChip } from "./CitationChip";
import { SafeMarkdown } from "./SafeMarkdown";

export interface ChatBubbleProps {
  message: ChatMessageClientDto;
  /** Map of artifactId -> title for rendering citation chips. */
  artifactTitleById: Map<string, string>;
  onCitationClick: (artifactId: string) => void;
}

export function ChatBubble({ message, artifactTitleById, onCitationClick }: ChatBubbleProps): React.JSX.Element {
  if (message.role === "user") {
    return (
      <div className="flex w-full justify-end">
        <div className="bg-primary text-on-primary rounded-3xl rounded-tr-sm p-6 max-w-[85%] shadow-sm">
          <p className="text-body-md font-body-md whitespace-pre-wrap m-0">{message.body.text}</p>
        </div>
      </div>
    );
  }

  // assistant + system both render left-aligned in a soft surface bubble.
  return (
    <div className="flex w-full justify-start">
      <div className="bg-surface-container-lowest rounded-3xl rounded-tl-sm p-6 max-w-[85%] shadow-sm border border-outline-variant flex flex-col gap-sm">
        <SafeMarkdown text={message.body.text} />
        {message.role === "assistant" && message.citations.length > 0 ? (
          <div className="mt-sm flex flex-wrap gap-sm">
            {message.citations.map((citation) => (
              <CitationChip
                key={`${citation.artifactId}-${citation.pageNumber}`}
                citation={citation}
                artifactTitle={artifactTitleById.get(citation.artifactId) ?? "Document"}
                onClick={onCitationClick}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
