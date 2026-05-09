/**
 * Thin wrapper around `mongoose.mongo.GridFSBucket` so adapters can stream
 * binary content into and out of MongoDB without each one having to remember
 * how to look up the live driver from a Mongoose connection.
 *
 * Lives in `platform/infrastructure/mongo/` (not `infrastructure/repositories/library/`)
 * because GridFS is a generic Mongo capability, not a library-context concept.
 * The harness's "PDF storage gateway" pattern is *not* used here — see the
 * GR-002 plan, decision §1 (Storage — Option B) for the rationale.
 */
import type { Readable } from "node:stream";
import mongoose from "mongoose";
import type { MongoDBClient } from "./client";

export interface GridFsUploadResult {
  fileId: string;
}

export interface GridFsFileMetadata {
  byteSize: number;
}

export class GridFsBucket {
  constructor(
    private readonly mongoClient: MongoDBClient,
    private readonly bucketName: string,
  ) {}

  public async uploadBuffer(
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<GridFsUploadResult> {
    const bucket = await this.bucket();
    return new Promise<GridFsUploadResult>((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(fileName, {
        metadata: { contentType },
      });
      uploadStream.once("error", reject);
      uploadStream.once("finish", () => {
        resolve({ fileId: uploadStream.id.toString() });
      });
      uploadStream.end(buffer);
    });
  }

  public async openDownloadStream(fileId: string): Promise<Readable> {
    const bucket = await this.bucket();
    const objectId = this.toObjectId(fileId);
    return bucket.openDownloadStream(objectId);
  }

  public async getMetadata(fileId: string): Promise<GridFsFileMetadata | null> {
    const bucket = await this.bucket();
    const objectId = this.toObjectId(fileId);
    const cursor = bucket.find({ _id: objectId }).limit(1);
    const file = await cursor.next();
    if (!file) return null;
    return { byteSize: file.length };
  }

  public async delete(fileId: string): Promise<void> {
    const bucket = await this.bucket();
    const objectId = this.toObjectId(fileId);
    try {
      await bucket.delete(objectId);
    } catch (error) {
      if (this.isNotFound(error)) return;
      throw error;
    }
  }

  private async bucket(): Promise<mongoose.mongo.GridFSBucket> {
    await this.mongoClient.ensureConnection();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("[GridFsBucket] Mongo connection is not ready");
    }
    return new mongoose.mongo.GridFSBucket(db, { bucketName: this.bucketName });
  }

  private toObjectId(fileId: string): mongoose.mongo.ObjectId {
    return new mongoose.mongo.ObjectId(fileId);
  }

  private isNotFound(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const message = (error as { message?: string }).message ?? "";
    return message.includes("not found") || message.includes("FileNotFound");
  }
}
