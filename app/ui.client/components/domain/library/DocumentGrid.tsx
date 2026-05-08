import type { ArtifactDto } from "@backend-application/library/library.dto";
import { DocumentCard } from "./DocumentCard";

export interface DocumentGridProps {
  artifacts: ArtifactDto[];
  onOpen: (artifactId: string) => void;
  onDelete: (artifactId: string) => void;
}

export function DocumentGrid({ artifacts, onOpen, onDelete }: DocumentGridProps): React.JSX.Element {
  if (artifacts.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-lg border border-dashed border-outline-variant p-xl text-center">
        <p className="text-body-md font-body-md text-on-surface-variant m-0">
          No documents yet. Drop a PDF above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
      {artifacts.map((artifact) => (
        <DocumentCard
          key={artifact.id}
          artifact={artifact}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
