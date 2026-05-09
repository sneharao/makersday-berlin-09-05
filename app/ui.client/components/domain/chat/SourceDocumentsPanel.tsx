import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ArtifactDto } from "@backend-application/library/library.dto";

export interface SourceDocumentsPanelProps {
  artifacts: ArtifactDto[];
  /** Subset of artifact ids that have been referenced (cited) in this chat. */
  referencedArtifactIds: Set<string>;
  /** Subset of artifact ids the user has explicitly activated for citation. Empty = all. */
  activeArtifactIds: string[];
  /** Most recently focused artifact (e.g. last cited or last clicked chip). */
  highlightedArtifactId: string | null;
  onIncludeMoreClick: () => void;
}

export interface SourceDocumentsPanelHandle {
  scrollToArtifact: (artifactId: string) => void;
}

export const SourceDocumentsPanel = forwardRef<SourceDocumentsPanelHandle, SourceDocumentsPanelProps>(
  function SourceDocumentsPanel(
    {
      artifacts,
      referencedArtifactIds,
      activeArtifactIds,
      highlightedArtifactId,
      onIncludeMoreClick,
    },
    ref,
  ) {
    const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const activeSet = new Set(activeArtifactIds);
    const restrictionMode = activeArtifactIds.length > 0;

    useImperativeHandle(
      ref,
      () => ({
        scrollToArtifact(artifactId: string): void {
          const node = cardRefs.current.get(artifactId);
          node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        },
      }),
      [],
    );

    if (artifacts.length === 0) {
      return (
        <aside className="w-[320px] border-l border-outline-variant bg-surface-bright hidden lg:flex flex-col shrink-0">
          <div className="h-16 flex items-center px-md border-b border-outline-variant shrink-0">
            <h2 className="text-title-sm font-title-sm font-semibold text-on-surface m-0">Source Documents</h2>
          </div>
          <div className="flex-1 p-md text-body-sm font-body-sm text-on-surface-variant">
            <p className="m-0">Your library is empty.</p>
            <a
              href="/library"
              className="inline-flex items-center gap-xs mt-sm text-primary font-semibold hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">menu_book</span>
              Go to Library
            </a>
          </div>
        </aside>
      );
    }

    return (
      <aside className="w-[320px] border-l border-outline-variant bg-surface-bright hidden lg:flex flex-col shrink-0">
        <div className="h-16 flex items-center px-md border-b border-outline-variant shrink-0 justify-between">
          <h2 className="text-title-sm font-title-sm font-semibold text-on-surface m-0">Source Documents</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-sm flex flex-col gap-sm">
          {artifacts.map((artifact) => {
            const isReferenced = referencedArtifactIds.has(artifact.id);
            const isHighlighted = highlightedArtifactId === artifact.id;
            const isInActiveSet = !restrictionMode || activeSet.has(artifact.id);

            const baseClass =
              "flex items-start gap-sm p-sm rounded-xl border transition-all";
            const stateClass = isHighlighted
              ? "bg-secondary-container/40 border-secondary shadow-sm"
              : isReferenced
              ? "bg-surface-container-lowest border-outline-variant shadow-sm"
              : "bg-transparent border-transparent hover:bg-surface-container-lowest hover:border-outline-variant";

            const subtleText = isInActiveSet ? "text-on-surface-variant" : "text-outline";

            return (
              <div
                key={artifact.id}
                ref={(node) => {
                  cardRefs.current.set(artifact.id, node);
                }}
                className={`${baseClass} ${stateClass}`}
              >
                <span className={`material-symbols-outlined shrink-0 ${isReferenced ? "text-secondary" : subtleText}`}>
                  description
                </span>
                <div className="flex flex-col overflow-hidden">
                  <p
                    className={`text-body-sm font-body-sm font-semibold truncate m-0 ${
                      isReferenced ? "text-on-surface" : subtleText
                    }`}
                  >
                    {artifact.title}
                  </p>
                  <p className={`text-label-caps font-label-caps mt-xs m-0 uppercase ${subtleText}`}>
                    {isReferenced ? "Active Document" : isInActiveSet ? "In Library" : "Excluded"}
                  </p>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onIncludeMoreClick}
            className="flex items-center gap-sm p-sm rounded-xl text-primary hover:bg-surface-container-lowest hover:shadow-sm transition-all mt-sm border border-transparent hover:border-outline-variant"
          >
            <span className="material-symbols-outlined">add_circle</span>
            <span className="text-body-sm font-body-sm font-semibold">Include more documents</span>
          </button>
        </div>
      </aside>
    );
  },
);
