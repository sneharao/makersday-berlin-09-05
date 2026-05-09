import { useState } from "react";
import type { ArtifactDto } from "@backend-application/library/library.dto";

export interface DocumentCardProps {
  artifact: ArtifactDto;
  onOpen: (artifactId: string) => void;
  onDelete: (artifactId: string) => void;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function DocumentCard({ artifact, onOpen, onDelete }: DocumentCardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const uploadedDate = artifact.uploadedAt instanceof Date ? artifact.uploadedAt : new Date(artifact.uploadedAt);

  return (
    <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-sm flex flex-col gap-sm hover:border-primary/30 transition-colors group relative overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(artifact.id)}
        className="aspect-[3/4] w-full rounded-lg bg-surface-container overflow-hidden relative border border-outline-variant/20 cursor-pointer text-left"
        aria-label={`Open ${artifact.title}`}
      >
        <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
          <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">picture_as_pdf</span>
        </div>
        <div className="absolute top-sm left-sm bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-[10px] font-label-caps font-bold">
          PDF
        </div>
      </button>

      <div className="flex flex-col flex-1">
        <h4 className="text-body-md font-body-md font-semibold text-primary line-clamp-2 mb-xs group-hover:text-secondary transition-colors m-0">
          {artifact.title}
        </h4>
        <p className="text-body-sm font-body-sm text-on-surface-variant m-0">
          {artifact.uploadStatus === "ready"
            ? `Uploaded ${DATE_FORMATTER.format(uploadedDate)}`
            : `Status: ${artifact.uploadStatus}`}
        </p>
      </div>

      <div className="absolute top-sm right-sm">
        <button
          type="button"
          className="p-xs text-on-surface-variant hover:bg-surface-container-high rounded-full bg-surface-container-lowest/80 backdrop-blur-sm"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          aria-label="Document actions"
          aria-expanded={menuOpen}
        >
          <span className="material-symbols-outlined text-[20px]">more_vert</span>
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 mt-1 w-40 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-md overflow-hidden z-20"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-sm py-xs text-body-sm font-body-sm text-error hover:bg-error-container/30"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen(false);
                onDelete(artifact.id);
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
