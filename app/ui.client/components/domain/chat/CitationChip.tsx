import type { CitationClientDto } from "~/routes/api/api.chat.chats._sdk";

export interface CitationChipProps {
  citation: CitationClientDto;
  artifactTitle: string;
  onClick: (artifactId: string) => void;
}

export function CitationChip({ citation, artifactTitle, onClick }: CitationChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick(citation.artifactId)}
      className="inline-flex items-center gap-xs px-sm py-xs bg-secondary-container/50 text-on-secondary-container text-label-caps font-label-caps rounded-full border border-outline-variant uppercase cursor-pointer hover:bg-secondary-container transition-colors"
      title={citation.excerpt ?? `Page ${citation.pageNumber}`}
    >
      <span className="material-symbols-outlined text-[14px]">find_in_page</span>
      <span>
        {artifactTitle} - Pg {citation.pageNumber}
      </span>
    </button>
  );
}
