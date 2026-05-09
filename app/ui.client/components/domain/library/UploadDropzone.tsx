import { useCallback, useRef, useState } from "react";

export interface UploadDropzoneProps {
  isUploading: boolean;
  onFileSelected: (file: File) => void;
}

export function UploadDropzone({ isUploading, onFileSelected }: UploadDropzoneProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const openFilePicker = useCallback((): void => {
    inputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const first = files.item(0);
      if (first) onFileSelected(first);
    },
    [onFileSelected],
  );

  const onDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (isUploading) return;
    setIsDragOver(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    handleFiles(event.dataTransfer.files);
  };

  const dropzoneClasses = [
    "w-full border-2 border-dashed rounded-lg p-xl flex flex-col items-center justify-center text-center transition-colors group relative",
    isUploading ? "cursor-progress" : "cursor-pointer",
    isDragOver
      ? "border-primary bg-surface-container"
      : "border-outline-variant bg-surface-container-low hover:bg-surface-container",
  ].join(" ");

  return (
    <section className="w-full">
      <div
        className={dropzoneClasses}
        onClick={isUploading ? undefined : openFilePicker}
        onKeyDown={(event) => {
          if (isUploading) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-busy={isUploading}
        aria-label="Drop a PDF here or browse files"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          disabled={isUploading}
        />
        <div className="w-16 h-16 rounded-lg bg-surface-container flex items-center justify-center mb-md group-hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-display-lg text-primary">upload_file</span>
        </div>
        <h2 className="text-title-sm font-title-sm text-primary mb-xs m-0">Drag &amp; Drop PDF here</h2>
        <p className="text-body-sm font-body-sm text-on-surface-variant mb-md max-w-md m-0">
          Upload your research papers, books, or documents to begin analysing and chatting with them.
        </p>
        <button
          type="button"
          className="bg-surface-container-lowest border border-outline-variant text-primary py-sm px-lg rounded-lg text-label-caps font-label-caps hover:bg-surface-variant transition-colors disabled:opacity-60"
          disabled={isUploading}
          onClick={(event) => {
            event.stopPropagation();
            openFilePicker();
          }}
        >
          Browse Files
        </button>

        {isUploading ? (
          <div
            className="absolute inset-0 bg-surface-container-low/80 backdrop-blur-sm flex items-center justify-center rounded-lg"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-sm text-primary">
              <span className="material-symbols-outlined text-display-lg animate-spin">progress_activity</span>
              <span className="text-body-sm font-body-sm">Uploading…</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
