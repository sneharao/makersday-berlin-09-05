import { z } from "zod";

export const artifactKindSchema = z.enum(["pdf", "research", "article", "dataset", "book"]);
export type ArtifactKind = z.infer<typeof artifactKindSchema>;

export const uploadStatusSchema = z.enum(["uploading", "processing", "ready", "failed", "removed"]);
export type UploadStatus = z.infer<typeof uploadStatusSchema>;

export const sourceFileSchema = z.object({
  storageUri: z.string().min(1),
  byteSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  sha256Hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "sha256Hash must be 64 lowercase hex characters"),
});
export type SourceFile = z.infer<typeof sourceFileSchema>;

export const artifactTitleSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

export const artifactSchema = z
  .object({
    id: z.string().uuid(),
    libraryId: z.string().uuid(),
    title: artifactTitleSchema,
    kind: artifactKindSchema,
    uploadStatus: uploadStatusSchema,
    sourceFile: sourceFileSchema,
    pageCount: z.number().int().min(1).optional(),
    uploadedAt: z.date(),
    processedAt: z.date().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .superRefine((value, ctx) => {
    const isReady = value.uploadStatus === "ready";
    if (isReady && value.pageCount === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["pageCount"],
        message: "pageCount is required when uploadStatus is 'ready'",
      });
    }
    if (!isReady && value.pageCount !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["pageCount"],
        message: "pageCount may only be set when uploadStatus is 'ready'",
      });
    }
    if (isReady && value.processedAt === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["processedAt"],
        message: "processedAt is required when uploadStatus is 'ready'",
      });
    }
    if (!isReady && value.processedAt !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["processedAt"],
        message: "processedAt may only be set when uploadStatus is 'ready'",
      });
    }
  });

export type Artifact = z.infer<typeof artifactSchema>;
