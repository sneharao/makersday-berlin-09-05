import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import busboy from "busboy";

const FIELD_NAME = "file";

export class MultipartParseError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MultipartParseError";
  }
}

export class FileExceedsLimitError extends MultipartParseError {
  constructor(maxByteSize: number) {
    super(413, `File exceeds the ${Math.floor(maxByteSize / (1024 * 1024))} MB limit`);
    this.name = "FileExceedsLimitError";
  }
}

export interface ParsedUpload {
  fileName: string;
  buffer: Buffer;
}

/**
 * Streams a single-file multipart/form-data request through busboy so we
 * never buffer the request body twice. Stops at `maxByteSize` and rejects
 * the request with a 413 before the application service is invoked.
 */
export async function parseSingleFileUpload(
  request: Request,
  maxByteSize: number,
): Promise<ParsedUpload> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxByteSize + 1024 * 64) {
    throw new FileExceedsLimitError(maxByteSize);
  }

  if (!request.body) {
    throw new MultipartParseError(400, "Missing request body");
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const bb = busboy({
    headers,
    limits: {
      files: 1,
      fileSize: maxByteSize + 1,
      fields: 0,
    },
  });

  const bodyStream = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);

  return new Promise<ParsedUpload>((resolve, reject) => {
    let resolved = false;
    let captured: ParsedUpload | null = null;

    const fail = (err: Error): void => {
      if (resolved) return;
      resolved = true;
      bodyStream.unpipe(bb);
      bb.removeAllListeners();
      reject(err);
    };

    bb.on("file", (fieldName, fileStream, info) => {
      if (fieldName !== FIELD_NAME) {
        fileStream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      let limitHit = false;
      fileStream.on("data", (chunk: Buffer) => {
        total += chunk.length;
        chunks.push(chunk);
      });
      fileStream.on("limit", () => {
        limitHit = true;
        fail(new FileExceedsLimitError(maxByteSize));
      });
      fileStream.on("end", () => {
        if (limitHit) return;
        if (total > maxByteSize) {
          fail(new FileExceedsLimitError(maxByteSize));
          return;
        }
        captured = {
          fileName: info.filename ?? "upload.pdf",
          buffer: Buffer.concat(chunks, total),
        };
      });
      fileStream.on("error", fail);
    });

    bb.on("error", (err) => fail(err instanceof Error ? err : new Error(String(err))));
    bb.on("filesLimit", () => fail(new MultipartParseError(400, "Only one file is allowed")));
    bb.on("close", () => {
      if (resolved) return;
      resolved = true;
      if (!captured) {
        reject(new MultipartParseError(400, `Missing required field: ${FIELD_NAME}`));
        return;
      }
      resolve(captured);
    });

    bodyStream.on("error", fail);
    bodyStream.pipe(bb);
  });
}
