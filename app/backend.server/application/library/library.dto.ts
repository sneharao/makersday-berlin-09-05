import type { Readable } from "node:stream";
import type { Artifact, ArtifactKind, UploadStatus } from "@backend-domain/library/artifact";
import type { Library } from "@backend-domain/library/library";

export interface LibraryDto {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactDto {
  id: string;
  libraryId: string;
  title: string;
  kind: ArtifactKind;
  uploadStatus: UploadStatus;
  byteSize: number;
  mimeType: string;
  pageCount?: number;
  uploadedAt: Date;
  processedAt?: Date;
}

export interface UploadArtifactRequest {
  userId: string;
  fileName: string;
  file: Buffer;
}

export interface ArtifactBinaryDto {
  stream: Readable;
  byteSize: number;
  mimeType: string;
  fileName: string;
}

export function toLibraryDto(library: Library): LibraryDto {
  return {
    id: library.id,
    name: library.name,
    description: library.description,
    createdAt: library.createdAt,
    updatedAt: library.updatedAt,
  };
}

export function toArtifactDto(artifact: Artifact): ArtifactDto {
  return {
    id: artifact.id,
    libraryId: artifact.libraryId,
    title: artifact.title,
    kind: artifact.kind,
    uploadStatus: artifact.uploadStatus,
    byteSize: artifact.sourceFile.byteSize,
    mimeType: artifact.sourceFile.mimeType,
    pageCount: artifact.pageCount,
    uploadedAt: artifact.uploadedAt,
    processedAt: artifact.processedAt,
  };
}
