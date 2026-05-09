import { useEffect, useState } from "react";
import type { ArtifactDto } from "@backend-application/library/library.dto";

export interface IncludeDocumentsModalProps {
  isOpen: boolean;
  artifacts: ArtifactDto[];
  initialSelection: string[];
  onClose: () => void;
  onConfirm: (artifactIds: string[]) => void;
}

export function IncludeDocumentsModal({
  isOpen,
  artifacts,
  initialSelection,
  onClose,
  onConfirm,
}: IncludeDocumentsModalProps): React.JSX.Element | null {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelection));

  useEffect(() => {
    if (isOpen) setSelected(new Set(initialSelection));
  }, [isOpen, initialSelection]);

  if (!isOpen) return null;

  const toggle = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = (): void => {
    onConfirm(Array.from(selected));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-inverse-surface/40 flex items-center justify-center z-50 p-gutter"
      role="dialog"
      aria-modal="true"
      aria-labelledby="include-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-3xl shadow-md w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center px-md py-sm border-b border-outline-variant">
          <h2 id="include-modal-title" className="text-title-sm font-title-sm font-semibold text-on-surface m-0">
            Include documents in citations
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-xs text-on-surface-variant hover:bg-surface-container-low rounded-full"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-sm flex flex-col gap-xs">
          {artifacts.length === 0 ? (
            <p className="text-body-sm font-body-sm text-on-surface-variant p-sm m-0">
              Your library is empty. Upload a PDF on the Library page first.
            </p>
          ) : (
            artifacts.map((artifact) => {
              const isChecked = selected.has(artifact.id);
              return (
                <label
                  key={artifact.id}
                  className="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-low cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(artifact.id)}
                    className="h-5 w-5 accent-primary"
                  />
                  <span className="material-symbols-outlined text-on-surface-variant">description</span>
                  <span className="text-body-sm font-body-sm text-on-surface flex-1 truncate">{artifact.title}</span>
                </label>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-sm px-md py-sm border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            className="text-body-sm font-body-sm rounded-lg py-xs px-sm text-on-surface-variant hover:bg-surface-container-low"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="bg-primary text-on-primary text-body-sm font-body-sm rounded-lg py-xs px-md hover:opacity-90"
          >
            {selected.size === 0 ? "Use all documents" : `Apply (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
