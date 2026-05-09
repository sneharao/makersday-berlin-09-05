import { useCallback } from "react";
import { useNavigate, useRevalidator } from "react-router";
import type { AuthenticatedUserDto } from "@backend-application/authentication/auth.dto";
import type { ArtifactDto, LibraryDto } from "@backend-application/library/library.dto";
import {
  callDeleteArtifactApi,
  getArtifactDownloadUrl,
} from "~/routes/api/api.library.artifacts._sdk";
import { callLogoutApi } from "~/routes/api/api.auth._sdk";
import { Sidebar } from "./Sidebar";
import { TopAppBar } from "./TopAppBar";
import { UploadDropzone } from "./UploadDropzone";
import { DocumentGrid } from "./DocumentGrid";
import { useUploadArtifact } from "./hooks/use-upload-artifact";
import { useDocumentToasts, type Toast } from "./hooks/use-document-toasts";

export interface LibraryViewProps {
  user: AuthenticatedUserDto;
  library: LibraryDto;
  artifacts: ArtifactDto[];
}

export function LibraryView({ user, library, artifacts }: LibraryViewProps): React.JSX.Element {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { isUploading, uploadFile } = useUploadArtifact();
  const { toasts, pushToast, dismissToast } = useDocumentToasts();

  const handleSignOut = useCallback(async (): Promise<void> => {
    await callLogoutApi();
    navigate("/login");
  }, [navigate]);

  const handleFileSelected = useCallback(
    async (file: File): Promise<void> => {
      const result = await uploadFile(file);
      if (result.ok) {
        pushToast({ tone: "success", message: `Added “${result.artifact.title}” to your library.` });
        return;
      }
      pushToast({ tone: "error", message: result.message });
    },
    [pushToast, uploadFile],
  );

  const handleOpen = useCallback((artifactId: string): void => {
    window.open(getArtifactDownloadUrl(artifactId), "_blank", "noopener,noreferrer");
  }, []);

  const handleDelete = useCallback(
    async (artifactId: string): Promise<void> => {
      const ok = await callDeleteArtifactApi(artifactId);
      if (ok) {
        pushToast({ tone: "info", message: "Document removed." });
        revalidator.revalidate();
      } else {
        pushToast({ tone: "error", message: "Could not delete the document." });
      }
    },
    [pushToast, revalidator],
  );

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex">
      <Sidebar />
      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        <TopAppBar user={user} onSignOut={handleSignOut} />
        <main className="flex-1 p-gutter max-w-container-max mx-auto w-full flex flex-col gap-lg">
          <UploadDropzone isUploading={isUploading} onFileSelected={handleFileSelected} />

          <section>
            <div className="flex justify-between items-end mb-md">
              <h3 className="text-headline-md font-headline-md text-primary m-0">Recent Documents</h3>
              <span className="text-label-caps font-label-caps text-on-surface-variant">
                {library.name}
              </span>
            </div>
            <DocumentGrid artifacts={artifacts} onOpen={handleOpen} onDelete={handleDelete} />
          </section>
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}): React.JSX.Element | null {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-md right-md flex flex-col gap-xs z-50"
      role="region"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className={[
            "flex items-start gap-sm p-sm rounded-lg shadow-md border max-w-sm",
            toast.tone === "error"
              ? "bg-error-container text-on-error-container border-error/30"
              : toast.tone === "success"
              ? "bg-secondary-container text-on-secondary-container border-secondary/30"
              : "bg-surface-container-high text-on-surface border-outline-variant",
          ].join(" ")}
        >
          <span className="text-body-sm font-body-sm flex-1 m-0">{toast.message}</span>
          <button
            type="button"
            className="text-body-sm font-body-sm opacity-70 hover:opacity-100"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}
