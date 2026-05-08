import { Readable } from "node:stream";
import { getModelForClass } from "@typegoose/typegoose";
import type { Model } from "mongoose";
import { Repository } from "@backend-platform/infrastructure/mongo/repository";
import type { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";
import type { GridFsBucket } from "@backend-platform/infrastructure/mongo/gridfs-bucket";
import { artifactSchema, type Artifact } from "@backend-domain/library/artifact";
import { librarySchema, type Library } from "@backend-domain/library/library";
import type {
  ArtifactBinaryReadHandle,
  ArtifactStatusUpdate,
  LibraryRepo,
  PersistArtifactInput,
} from "@backend-domain/library/library.repo";
import { LibraryMongoModel, type LibraryMongoDocument } from "./library-mongo.model";
import { ArtifactMongoModel, type ArtifactMongoDocument } from "./artifact-mongo.model";

const STORAGE_URI_PREFIX = "gridfs://";

function buildStorageUri(fileId: string): string {
  return `${STORAGE_URI_PREFIX}${fileId}`;
}

function parseStorageUri(storageUri: string): string | null {
  if (!storageUri.startsWith(STORAGE_URI_PREFIX)) return null;
  const fileId = storageUri.slice(STORAGE_URI_PREFIX.length);
  return fileId.length > 0 ? fileId : null;
}

export class LibraryMongoRepo
  extends Repository<LibraryMongoDocument, Library>
  implements LibraryRepo
{
  private readonly artifactModel: Model<ArtifactMongoDocument>;

  constructor(
    mongoClient: MongoDBClient,
    private readonly gridFsBucket: GridFsBucket,
  ) {
    super({
      entityClass: LibraryMongoModel,
      mongoClient,
      modelName: "libraries",
      zodSchema: librarySchema,
    });
    this.artifactModel = getModelForClass(ArtifactMongoModel, {
      options: { customName: "artifacts" },
    }) as unknown as Model<ArtifactMongoDocument>;
  }

  public async listLibrariesForUser(userId: string): Promise<Library[]> {
    await this.mongoClient.ensureConnection();
    const docs = await this.model.find({ userId }).sort({ createdAt: 1 }).exec();
    return docs.map((doc) => this.documentToEntity(doc));
  }

  public async saveLibrary(library: Library): Promise<Library> {
    await this.mongoClient.ensureConnection();
    const validated = librarySchema.parse(library);
    const nameLower = validated.name.trim().toLowerCase();
    const upserted = await this.model
      .findOneAndUpdate(
        { id: validated.id },
        { $set: { ...validated, nameLower } },
        { new: true, upsert: true, returnDocument: "after" },
      )
      .exec();
    return this.documentToEntity(upserted);
  }

  public async addArtifactToLibrary(
    userId: string,
    input: PersistArtifactInput,
  ): Promise<Artifact> {
    await this.assertLibraryOwnedByUser(userId, input.libraryId);

    const upload = await this.gridFsBucket.uploadBuffer(
      `${input.artifactId}.pdf`,
      input.binary,
      input.mimeType,
    );

    const now = new Date();
    const artifact: Artifact = artifactSchema.parse({
      id: input.artifactId,
      libraryId: input.libraryId,
      title: input.title,
      kind: input.kind,
      uploadStatus: input.uploadStatus,
      sourceFile: {
        storageUri: buildStorageUri(upload.fileId),
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        sha256Hash: input.sha256Hash,
      },
      uploadedAt: input.uploadedAt,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await this.artifactModel.create(artifact);
    } catch (error) {
      await this.gridFsBucket.delete(upload.fileId).catch(() => undefined);
      throw error;
    }

    return artifact;
  }

  public async listArtifactsForLibrary(
    userId: string,
    libraryId: string,
  ): Promise<Artifact[]> {
    const owned = await this.isLibraryOwnedByUser(userId, libraryId);
    if (!owned) return [];
    const docs = await this.artifactModel
      .find({ libraryId, uploadStatus: { $ne: "removed" } })
      .sort({ uploadedAt: -1 })
      .exec();
    return docs.map((doc) => this.parseArtifactDoc(doc));
  }

  public async getArtifactById(
    userId: string,
    libraryId: string,
    artifactId: string,
  ): Promise<Artifact | null> {
    const owned = await this.isLibraryOwnedByUser(userId, libraryId);
    if (!owned) return null;
    const doc = await this.artifactModel.findOne({ id: artifactId, libraryId }).exec();
    return doc ? this.parseArtifactDoc(doc) : null;
  }

  public async findArtifactByHash(
    userId: string,
    libraryId: string,
    sha256Hash: string,
  ): Promise<Artifact | null> {
    const owned = await this.isLibraryOwnedByUser(userId, libraryId);
    if (!owned) return null;
    const doc = await this.artifactModel
      .findOne({
        libraryId,
        "sourceFile.sha256Hash": sha256Hash,
        uploadStatus: { $ne: "removed" },
      })
      .exec();
    return doc ? this.parseArtifactDoc(doc) : null;
  }

  public async updateArtifactStatus(
    userId: string,
    libraryId: string,
    artifactId: string,
    update: ArtifactStatusUpdate,
  ): Promise<Artifact> {
    await this.assertLibraryOwnedByUser(userId, libraryId);
    const set: Record<string, unknown> = {
      uploadStatus: update.uploadStatus,
      updatedAt: update.updatedAt,
    };
    const unset: Record<string, unknown> = {};
    if (update.pageCount !== undefined) set.pageCount = update.pageCount;
    else unset.pageCount = "";
    if (update.processedAt !== undefined) set.processedAt = update.processedAt;
    else unset.processedAt = "";

    const updated = await this.artifactModel
      .findOneAndUpdate(
        { id: artifactId, libraryId },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
        { returnDocument: "after" },
      )
      .exec();
    if (!updated) {
      throw new Error(`Artifact ${artifactId} not found in library ${libraryId}`);
    }
    return this.parseArtifactDoc(updated);
  }

  public async removeArtifact(
    userId: string,
    libraryId: string,
    artifactId: string,
  ): Promise<void> {
    const owned = await this.isLibraryOwnedByUser(userId, libraryId);
    if (!owned) return;
    const existing = await this.artifactModel
      .findOne({ id: artifactId, libraryId })
      .exec();
    if (!existing) return;
    const fileId = parseStorageUri(existing.sourceFile.storageUri);
    if (fileId) {
      await this.gridFsBucket.delete(fileId).catch(() => undefined);
    }
    await this.artifactModel.deleteOne({ id: artifactId, libraryId }).exec();
  }

  public async openArtifactBinary(
    userId: string,
    libraryId: string,
    artifactId: string,
  ): Promise<ArtifactBinaryReadHandle | null> {
    const artifact = await this.getArtifactById(userId, libraryId, artifactId);
    if (!artifact) return null;
    const fileId = parseStorageUri(artifact.sourceFile.storageUri);
    if (!fileId) return null;
    const stream = await this.gridFsBucket.openDownloadStream(fileId);
    return {
      stream: stream as unknown as Readable,
      mimeType: artifact.sourceFile.mimeType,
      byteSize: artifact.sourceFile.byteSize,
    };
  }

  private async assertLibraryOwnedByUser(userId: string, libraryId: string): Promise<void> {
    const owned = await this.isLibraryOwnedByUser(userId, libraryId);
    if (!owned) {
      throw new Error(`Library ${libraryId} does not belong to user ${userId}`);
    }
  }

  private async isLibraryOwnedByUser(userId: string, libraryId: string): Promise<boolean> {
    await this.mongoClient.ensureConnection();
    const exists = await this.model.exists({ id: libraryId, userId });
    return exists !== null;
  }

  private parseArtifactDoc(doc: ArtifactMongoDocument): Artifact {
    const raw = doc.toObject({ versionKey: false });
    const { _id: _ignored, ...rest } = raw as Record<string, unknown> & { _id: unknown };
    const result = artifactSchema.safeParse(rest);
    if (result.success) return result.data;
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`[artifacts] Database data failed Zod validation:\n${details}`);
  }
}
