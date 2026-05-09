import type { Readable } from "node:stream";
import type { Artifact, ArtifactKind, UploadStatus } from "./artifact";
import type { Library } from "./library";

export interface PersistArtifactInput {
  artifactId: string;
  libraryId: string;
  title: string;
  kind: ArtifactKind;
  uploadStatus: UploadStatus;
  byteSize: number;
  mimeType: string;
  sha256Hash: string;
  uploadedAt: Date;
  binary: Buffer;
}

export interface ArtifactStatusUpdate {
  uploadStatus: UploadStatus;
  pageCount?: number;
  processedAt?: Date;
  updatedAt: Date;
}

export interface ArtifactBinaryReadHandle {
  stream: Readable;
  mimeType: string;
  byteSize: number;
}

/**
 * The single port for the `library` aggregate. `Artifact` is an internal
 * entity of `Library`, so all artifact-level methods are tenant-scoped via
 * the parent library's `userId` (per `harness/knowledge/domain/library/data-model.md`).
 */
export interface LibraryRepo {
  // Library-level
  listLibrariesForUser(userId: string): Promise<Library[]>;
  saveLibrary(library: Library): Promise<Library>;

  // Artifact-level — every method takes `userId` and verifies the parent
  // library belongs to the requesting tenant before touching `artifacts`.
  addArtifactToLibrary(userId: string, input: PersistArtifactInput): Promise<Artifact>;
  listArtifactsForLibrary(userId: string, libraryId: string): Promise<Artifact[]>;
  getArtifactById(userId: string, libraryId: string, artifactId: string): Promise<Artifact | null>;
  findArtifactByHash(
    userId: string,
    libraryId: string,
    sha256Hash: string,
  ): Promise<Artifact | null>;
  updateArtifactStatus(
    userId: string,
    libraryId: string,
    artifactId: string,
    update: ArtifactStatusUpdate,
  ): Promise<Artifact>;
  removeArtifact(userId: string, libraryId: string, artifactId: string): Promise<void>;
  openArtifactBinary(
    userId: string,
    libraryId: string,
    artifactId: string,
  ): Promise<ArtifactBinaryReadHandle | null>;
}
