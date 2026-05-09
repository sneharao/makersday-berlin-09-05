import { createHash, randomUUID } from "node:crypto";
import type { Artifact } from "@backend-domain/library/artifact";
import type { Library } from "@backend-domain/library/library";
import type { LibraryRepo } from "@backend-domain/library/library.repo";
import type { LibraryConfig } from "./config";
import {
  toArtifactDto,
  toLibraryDto,
  type ArtifactBinaryDto,
  type ArtifactDto,
  type LibraryDto,
  type UploadArtifactRequest,
} from "./library.dto";
import {
  ArtifactNotFoundError,
  DuplicateArtifactError,
  FileTooLargeError,
  FileTooSmallError,
  InvalidPdfError,
  PdfParseError,
} from "./errors";

export interface ParsePdfResult {
  pageCount: number;
}

/**
 * Pluggable PDF parser. Defaulted at the composition root to a thin
 * wrapper around `pdf-parse`. Tests inject a deterministic stub so the
 * application service has no static dependency on `pdf-parse`.
 */
export type ParsePdf = (buffer: Buffer) => Promise<ParsePdfResult>;

const PDF_MIME_TYPE = "application/pdf";

function deriveTitle(fileName: string): string {
  const trimmed = fileName.trim();
  const withoutExtension = trimmed.replace(/\.pdf$/i, "");
  return withoutExtension.length > 0 ? withoutExtension : "Untitled PDF";
}

function isMongoDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { code?: number; name?: string };
  return candidate.code === 11000 || candidate.name === "MongoServerError";
}

export class LibraryService {
  constructor(
    private readonly libraryRepo: LibraryRepo,
    private readonly config: LibraryConfig,
    private readonly clock: () => Date,
    private readonly parsePdf: ParsePdf,
  ) {}

  public async ensureDefaultLibrary(userId: string): Promise<LibraryDto> {
    const library = await this.findOrCreateDefaultLibrary(userId);
    return toLibraryDto(library);
  }

  public async listArtifacts(userId: string): Promise<ArtifactDto[]> {
    const library = await this.findOrCreateDefaultLibrary(userId);
    const artifacts = await this.libraryRepo.listArtifactsForLibrary(userId, library.id);
    return artifacts
      .filter((a) => a.uploadStatus !== "removed")
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .map(toArtifactDto);
  }

  public async uploadArtifact(request: UploadArtifactRequest): Promise<ArtifactDto> {
    this.assertSize(request.file.byteLength);
    this.assertPdfMagicBytes(request.file);

    const library = await this.findOrCreateDefaultLibrary(request.userId);
    const sha256Hash = createHash("sha256").update(request.file).digest("hex");

    const existingDuplicate = await this.libraryRepo.findArtifactByHash(
      request.userId,
      library.id,
      sha256Hash,
    );
    if (existingDuplicate) {
      throw new DuplicateArtifactError();
    }

    const now = this.clock();
    const artifactId = randomUUID();

    let inserted: Artifact;
    try {
      inserted = await this.libraryRepo.addArtifactToLibrary(request.userId, {
        artifactId,
        libraryId: library.id,
        title: deriveTitle(request.fileName),
        kind: "pdf",
        uploadStatus: "processing",
        byteSize: request.file.byteLength,
        mimeType: PDF_MIME_TYPE,
        sha256Hash,
        uploadedAt: now,
        binary: request.file,
      });
    } catch (err) {
      if (isMongoDuplicateKeyError(err)) {
        throw new DuplicateArtifactError();
      }
      throw err;
    }

    try {
      const { pageCount } = await this.parsePdf(request.file);
      if (!Number.isInteger(pageCount) || pageCount < 1) {
        throw new PdfParseError("PDF page count is invalid");
      }
      const processedAt = this.clock();
      const ready = await this.libraryRepo.updateArtifactStatus(
        request.userId,
        library.id,
        inserted.id,
        {
          uploadStatus: "ready",
          pageCount,
          processedAt,
          updatedAt: processedAt,
        },
      );
      return toArtifactDto(ready);
    } catch (err) {
      await this.rollbackFailedArtifact(request.userId, library.id, inserted.id);
      if (err instanceof PdfParseError) throw err;
      throw new PdfParseError();
    }
  }

  public async getArtifactBinary(userId: string, artifactId: string): Promise<ArtifactBinaryDto> {
    const library = await this.findOrCreateDefaultLibrary(userId);
    const artifact = await this.libraryRepo.getArtifactById(userId, library.id, artifactId);
    if (!artifact) {
      throw new ArtifactNotFoundError();
    }
    const handle = await this.libraryRepo.openArtifactBinary(userId, library.id, artifactId);
    if (!handle) {
      throw new ArtifactNotFoundError();
    }
    return {
      stream: handle.stream,
      byteSize: handle.byteSize,
      mimeType: handle.mimeType,
      fileName: `${artifact.title}.pdf`,
    };
  }

  public async removeArtifact(userId: string, artifactId: string): Promise<void> {
    const library = await this.findOrCreateDefaultLibrary(userId);
    const existing = await this.libraryRepo.getArtifactById(userId, library.id, artifactId);
    if (!existing) {
      throw new ArtifactNotFoundError();
    }
    await this.libraryRepo.removeArtifact(userId, library.id, artifactId);
  }

  private async findOrCreateDefaultLibrary(userId: string): Promise<Library> {
    const existing = await this.libraryRepo.listLibrariesForUser(userId);
    const active = existing.find((library) => library.isActive);
    if (active) {
      return active;
    }
    const now = this.clock();
    const library: Library = {
      id: randomUUID(),
      userId,
      name: this.config.defaultLibraryName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      return await this.libraryRepo.saveLibrary(library);
    } catch (err) {
      if (isMongoDuplicateKeyError(err)) {
        const retry = await this.libraryRepo.listLibrariesForUser(userId);
        const concurrent = retry.find((other) => other.isActive);
        if (concurrent) return concurrent;
      }
      throw err;
    }
  }

  private async rollbackFailedArtifact(
    userId: string,
    libraryId: string,
    artifactId: string,
  ): Promise<void> {
    try {
      await this.libraryRepo.removeArtifact(userId, libraryId, artifactId);
    } catch {
      // Best-effort cleanup; the upload pipeline already failed.
    }
  }

  private assertSize(byteLength: number): void {
    if (byteLength < this.config.minByteSize) {
      throw new FileTooSmallError(this.config.minByteSize);
    }
    if (byteLength > this.config.maxByteSize) {
      throw new FileTooLargeError(this.config.maxByteSize);
    }
  }

  /**
   * PDF 1.7 §7.5.2 — every PDF file begins with the 5-byte sequence "%PDF-".
   * We sniff server-side rather than trusting the browser-supplied mime type.
   */
  private assertPdfMagicBytes(buffer: Buffer): void {
    if (buffer.byteLength < 5) {
      throw new InvalidPdfError();
    }
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new InvalidPdfError();
    }
  }
}
