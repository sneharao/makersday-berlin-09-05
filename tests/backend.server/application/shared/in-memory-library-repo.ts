import { Readable } from "node:stream";
import type { Artifact } from "@backend-domain/library/artifact";
import type { Library } from "@backend-domain/library/library";
import type {
  ArtifactBinaryReadHandle,
  ArtifactStatusUpdate,
  LibraryRepo,
  PersistArtifactInput,
} from "@backend-domain/library/library.repo";
import { artifactSchema } from "@backend-domain/library/artifact";
import { librarySchema } from "@backend-domain/library/library";

export class InMemoryLibraryRepo implements LibraryRepo {
  private readonly libraries = new Map<string, Library>();
  private readonly artifacts = new Map<string, Artifact>();
  private readonly binaries = new Map<string, Buffer>();

  seedLibraries(libraries: Library[]): void {
    for (const library of libraries) {
      this.libraries.set(library.id, library);
    }
  }

  seedArtifacts(artifacts: Artifact[], binaries: Record<string, Buffer> = {}): void {
    for (const artifact of artifacts) {
      this.artifacts.set(artifact.id, artifact);
    }
    for (const [artifactId, buffer] of Object.entries(binaries)) {
      this.binaries.set(artifactId, buffer);
    }
  }

  listLibraries(): Library[] {
    return Array.from(this.libraries.values());
  }

  listAllArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  binaryFor(artifactId: string): Buffer | undefined {
    return this.binaries.get(artifactId);
  }

  async listLibrariesForUser(userId: string): Promise<Library[]> {
    return Array.from(this.libraries.values()).filter((library) => library.userId === userId);
  }

  async saveLibrary(library: Library): Promise<Library> {
    const validated = librarySchema.parse(library);
    for (const existing of this.libraries.values()) {
      if (existing.id === validated.id) continue;
      if (
        existing.userId === validated.userId &&
        existing.name.trim().toLowerCase() === validated.name.trim().toLowerCase()
      ) {
        const error = new Error("E11000 duplicate key error: (userId, nameLower)");
        (error as { code?: number }).code = 11000;
        throw error;
      }
    }
    this.libraries.set(validated.id, validated);
    return validated;
  }

  async addArtifactToLibrary(userId: string, input: PersistArtifactInput): Promise<Artifact> {
    const library = this.libraries.get(input.libraryId);
    if (!library || library.userId !== userId) {
      throw new Error("Parent library not found for user");
    }
    for (const existing of this.artifacts.values()) {
      if (
        existing.libraryId === input.libraryId &&
        existing.sourceFile.sha256Hash === input.sha256Hash &&
        existing.uploadStatus !== "removed"
      ) {
        const error = new Error("E11000 duplicate key error: (libraryId, sourceFile.sha256Hash)");
        (error as { code?: number }).code = 11000;
        throw error;
      }
    }
    const now = new Date();
    const artifact: Artifact = artifactSchema.parse({
      id: input.artifactId,
      libraryId: input.libraryId,
      title: input.title,
      kind: input.kind,
      uploadStatus: input.uploadStatus,
      sourceFile: {
        storageUri: `memory://${input.artifactId}`,
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        sha256Hash: input.sha256Hash,
      },
      uploadedAt: input.uploadedAt,
      createdAt: now,
      updatedAt: now,
    });
    this.artifacts.set(artifact.id, artifact);
    this.binaries.set(artifact.id, Buffer.from(input.binary));
    return artifact;
  }

  async listArtifactsForLibrary(userId: string, libraryId: string): Promise<Artifact[]> {
    const library = this.libraries.get(libraryId);
    if (!library || library.userId !== userId) return [];
    return Array.from(this.artifacts.values())
      .filter((artifact) => artifact.libraryId === libraryId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async getArtifactById(
    userId: string,
    libraryId: string,
    artifactId: string,
  ): Promise<Artifact | null> {
    const library = this.libraries.get(libraryId);
    if (!library || library.userId !== userId) return null;
    const artifact = this.artifacts.get(artifactId);
    if (!artifact || artifact.libraryId !== libraryId) return null;
    return artifact;
  }

  async findArtifactByHash(
    userId: string,
    libraryId: string,
    sha256Hash: string,
  ): Promise<Artifact | null> {
    const library = this.libraries.get(libraryId);
    if (!library || library.userId !== userId) return null;
    for (const artifact of this.artifacts.values()) {
      if (
        artifact.libraryId === libraryId &&
        artifact.sourceFile.sha256Hash === sha256Hash &&
        artifact.uploadStatus !== "removed"
      ) {
        return artifact;
      }
    }
    return null;
  }

  async updateArtifactStatus(
    userId: string,
    libraryId: string,
    artifactId: string,
    update: ArtifactStatusUpdate,
  ): Promise<Artifact> {
    const existing = await this.getArtifactById(userId, libraryId, artifactId);
    if (!existing) {
      throw new Error(`Artifact ${artifactId} not found for user ${userId}`);
    }
    const next: Artifact = artifactSchema.parse({
      ...existing,
      uploadStatus: update.uploadStatus,
      pageCount: update.pageCount,
      processedAt: update.processedAt,
      updatedAt: update.updatedAt,
    });
    this.artifacts.set(next.id, next);
    return next;
  }

  async removeArtifact(userId: string, libraryId: string, artifactId: string): Promise<void> {
    const library = this.libraries.get(libraryId);
    if (!library || library.userId !== userId) return;
    const existing = this.artifacts.get(artifactId);
    if (!existing || existing.libraryId !== libraryId) return;
    this.artifacts.delete(artifactId);
    this.binaries.delete(artifactId);
  }

  async openArtifactBinary(
    userId: string,
    libraryId: string,
    artifactId: string,
  ): Promise<ArtifactBinaryReadHandle | null> {
    const artifact = await this.getArtifactById(userId, libraryId, artifactId);
    if (!artifact) return null;
    const buffer = this.binaries.get(artifactId);
    if (!buffer) return null;
    return {
      stream: Readable.from(buffer),
      mimeType: artifact.sourceFile.mimeType,
      byteSize: artifact.sourceFile.byteSize,
    };
  }
}
