import {
  ArtifactNotFoundError,
  DuplicateArtifactError,
  FileTooLargeError,
  FileTooSmallError,
  InvalidPdfError,
  PdfParseError,
} from "@backend-application/library/errors";
import type { LibraryService } from "@backend-application/library/library.service";
import type { ArtifactDto, LibraryDto } from "@backend-application/library/library.dto";
import type { LoginController } from "@backend-infrastructure/api/login-controller";
import type { LibraryConfig } from "@backend-application/library/config";
import {
  FileExceedsLimitError,
  MultipartParseError,
  parseSingleFileUpload,
} from "./multipart";

export interface LibraryInitialState {
  library: LibraryDto;
  artifacts: ArtifactDto[];
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}

export interface ControllerResponse<T> {
  status: number;
  body: T | ApiErrorResponse;
}

export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly loginController: LoginController,
    private readonly config: LibraryConfig,
  ) {}

  public async getInitialState(request: Request): Promise<LibraryInitialState> {
    const ctx = await this.loginController.enforceAuth(request);
    const library = await this.libraryService.ensureDefaultLibrary(ctx.userId);
    const artifacts = await this.libraryService.listArtifacts(ctx.userId);
    return { library, artifacts };
  }

  public async listArtifacts(
    request: Request,
  ): Promise<ControllerResponse<{ artifacts: ArtifactDto[] }>> {
    const ctx = await this.loginController.enforceAuth(request);
    const artifacts = await this.libraryService.listArtifacts(ctx.userId);
    return { status: 200, body: { artifacts } };
  }

  public async uploadArtifact(
    request: Request,
  ): Promise<ControllerResponse<{ artifact: ArtifactDto }>> {
    const ctx = await this.loginController.enforceAuth(request);
    let parsed;
    try {
      parsed = await parseSingleFileUpload(request, this.config.maxByteSize);
    } catch (err) {
      if (err instanceof FileExceedsLimitError) {
        return errorResponse(413, "FILE_TOO_LARGE", err.message);
      }
      if (err instanceof MultipartParseError) {
        return errorResponse(err.status, "MULTIPART_INVALID", err.message);
      }
      return errorResponse(400, "MULTIPART_INVALID", "Could not parse upload");
    }

    try {
      const artifact = await this.libraryService.uploadArtifact({
        userId: ctx.userId,
        fileName: parsed.fileName,
        file: parsed.buffer,
      });
      return { status: 201, body: { artifact } };
    } catch (err) {
      return mapServiceError(err);
    }
  }

  public async streamArtifactBinary(request: Request, artifactId: string): Promise<Response> {
    const ctx = await this.loginController.enforceAuth(request);
    try {
      const binary = await this.libraryService.getArtifactBinary(ctx.userId, artifactId);
      const webStream = streamToWeb(binary.stream);
      const dispositionFilename = encodeURIComponent(binary.fileName);
      return new Response(webStream, {
        status: 200,
        headers: {
          "Content-Type": binary.mimeType,
          "Content-Length": String(binary.byteSize),
          "Content-Disposition": `inline; filename="${dispositionFilename}"`,
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      });
    } catch (err) {
      if (err instanceof ArtifactNotFoundError) {
        return new Response(JSON.stringify({ error: err.message, code: "NOT_FOUND" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }
  }

  public async deleteArtifact(
    request: Request,
    artifactId: string,
  ): Promise<ControllerResponse<{ ok: true }>> {
    const ctx = await this.loginController.enforceAuth(request);
    try {
      await this.libraryService.removeArtifact(ctx.userId, artifactId);
      return { status: 200, body: { ok: true } };
    } catch (err) {
      if (err instanceof ArtifactNotFoundError) {
        return errorResponse(404, "NOT_FOUND", err.message);
      }
      throw err;
    }
  }

}

function errorResponse(
  status: number,
  code: string,
  message: string,
): ControllerResponse<never> {
  return { status, body: { error: message, code } };
}

function mapServiceError(err: unknown): ControllerResponse<never> {
  if (err instanceof FileTooSmallError) {
    return errorResponse(400, "FILE_TOO_SMALL", err.message);
  }
  if (err instanceof FileTooLargeError) {
    return errorResponse(413, "FILE_TOO_LARGE", err.message);
  }
  if (err instanceof InvalidPdfError) {
    return errorResponse(415, "INVALID_PDF", err.message);
  }
  if (err instanceof DuplicateArtifactError) {
    return errorResponse(409, "DUPLICATE_ARTIFACT", err.message);
  }
  if (err instanceof PdfParseError) {
    return errorResponse(422, "PDF_PARSE_FAILED", err.message);
  }
  throw err;
}

function streamToWeb(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      const maybeDestroy = (nodeStream as unknown as { destroy?: () => void }).destroy;
      if (typeof maybeDestroy === "function") {
        maybeDestroy.call(nodeStream);
      }
    },
  });
}
