import { z } from "zod";

const artifactKindSchema = z.enum(["pdf", "research", "article", "dataset", "book"]);
const uploadStatusSchema = z.enum(["uploading", "processing", "ready", "failed", "removed"]);

const dateLikeSchema = z.union([z.string(), z.coerce.date()]).transform((value) =>
  value instanceof Date ? value : new Date(value),
);

const artifactSchema = z.object({
  id: z.string(),
  libraryId: z.string(),
  title: z.string(),
  kind: artifactKindSchema,
  uploadStatus: uploadStatusSchema,
  byteSize: z.number(),
  mimeType: z.string(),
  pageCount: z.number().optional(),
  uploadedAt: dateLikeSchema,
  processedAt: dateLikeSchema.optional(),
});

const artifactListSchema = z.object({ artifacts: z.array(artifactSchema) });
const artifactSingleSchema = z.object({ artifact: artifactSchema });
const errorSchema = z.object({ error: z.string(), code: z.string() });
const okSchema = z.object({ ok: z.literal(true) });

export type ArtifactClientDto = z.infer<typeof artifactSchema>;

export interface UploadArtifactSuccess {
  ok: true;
  artifact: ArtifactClientDto;
}

export interface UploadArtifactFailure {
  ok: false;
  reason:
    | "file-too-small"
    | "file-too-large"
    | "invalid-pdf"
    | "duplicate"
    | "pdf-parse-failed"
    | "unauthenticated"
    | "unexpected";
  message: string;
}

export type UploadArtifactResult = UploadArtifactSuccess | UploadArtifactFailure;

const ERROR_CODE_REASONS: Record<string, UploadArtifactFailure["reason"]> = {
  FILE_TOO_SMALL: "file-too-small",
  FILE_TOO_LARGE: "file-too-large",
  INVALID_PDF: "invalid-pdf",
  DUPLICATE_ARTIFACT: "duplicate",
  PDF_PARSE_FAILED: "pdf-parse-failed",
};

export async function callUploadArtifactApi(file: File): Promise<UploadArtifactResult> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/library/artifacts/upload", {
      method: "POST",
      body: formData,
    });
  } catch {
    return { ok: false, reason: "unexpected", message: "Network error" };
  }

  if (response.status === 401 || response.status === 302) {
    return { ok: false, reason: "unauthenticated", message: "Not signed in" };
  }

  const json: unknown = await response.json().catch(() => ({}));

  if (response.status === 201) {
    const parsed = artifactSingleSchema.safeParse(json);
    if (parsed.success) return { ok: true, artifact: parsed.data.artifact };
    return { ok: false, reason: "unexpected", message: "Malformed upload response" };
  }

  const errorParsed = errorSchema.safeParse(json);
  if (errorParsed.success) {
    const reason = ERROR_CODE_REASONS[errorParsed.data.code] ?? "unexpected";
    return { ok: false, reason, message: errorParsed.data.error };
  }
  return { ok: false, reason: "unexpected", message: `Upload failed (${response.status})` };
}

export async function callListArtifactsApi(): Promise<ArtifactClientDto[] | null> {
  try {
    const response = await fetch("/api/library/artifacts", { method: "GET" });
    if (response.status !== 200) return null;
    const json: unknown = await response.json().catch(() => null);
    const parsed = artifactListSchema.safeParse(json);
    return parsed.success ? parsed.data.artifacts : null;
  } catch {
    return null;
  }
}

export async function callDeleteArtifactApi(artifactId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/library/artifacts/${encodeURIComponent(artifactId)}`, {
      method: "DELETE",
    });
    if (response.status !== 200) return false;
    const json: unknown = await response.json().catch(() => ({}));
    const parsed = okSchema.safeParse(json);
    return parsed.success;
  } catch {
    return false;
  }
}

export function getArtifactDownloadUrl(artifactId: string): string {
  return `/api/library/artifacts/${encodeURIComponent(artifactId)}`;
}
