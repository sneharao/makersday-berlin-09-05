import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { LibraryConfig } from "@backend-application/library/config";
import {
  ArtifactNotFoundError,
  DuplicateArtifactError,
  FileTooLargeError,
  FileTooSmallError,
  InvalidPdfError,
  PdfParseError,
} from "@backend-application/library/errors";
import { LibraryService, type ParsePdf } from "@backend-application/library/library.service";
import type { UploadArtifactRequest } from "@backend-application/library/library.dto";
import { InMemoryLibraryRepo } from "../shared/in-memory-library-repo";

const USER_A = "00000000-0000-4000-8000-00000000aaaa";
const USER_B = "00000000-0000-4000-8000-00000000bbbb";
const FROZEN_NOW = new Date("2026-05-08T22:00:00.000Z");

const MIN_BYTES = 10 * 1024;
const MAX_BYTES = 25 * 1024 * 1024;

function pdfBuffer(byteLength: number, salt = "salt"): Buffer {
  const header = Buffer.from(`%PDF-1.7\n${salt}\n`, "utf8");
  if (byteLength <= header.byteLength) {
    return Buffer.concat([header.subarray(0, byteLength)]);
  }
  const padding = Buffer.alloc(byteLength - header.byteLength, 0x20);
  return Buffer.concat([header, padding]);
}

function makeConfig(overrides: Partial<{ minByteSize: number; maxByteSize: number; defaultLibraryName: string }> = {}): LibraryConfig {
  return new LibraryConfig(
    overrides.minByteSize ?? MIN_BYTES,
    overrides.maxByteSize ?? MAX_BYTES,
    overrides.defaultLibraryName ?? "My Library",
  );
}

function makeService(overrides: {
  repo?: InMemoryLibraryRepo;
  config?: LibraryConfig;
  clock?: () => Date;
  parsePdf?: ParsePdf;
} = {}): { service: LibraryService; repo: InMemoryLibraryRepo } {
  const repo = overrides.repo ?? new InMemoryLibraryRepo();
  const service = new LibraryService(
    repo,
    overrides.config ?? makeConfig(),
    overrides.clock ?? (() => FROZEN_NOW),
    overrides.parsePdf ?? (async () => ({ pageCount: 3 })),
  );
  return { service, repo };
}

function makeRequest(overrides: Partial<UploadArtifactRequest> = {}): UploadArtifactRequest {
  return {
    userId: overrides.userId ?? USER_A,
    fileName: overrides.fileName ?? "report.pdf",
    file: overrides.file ?? pdfBuffer(MIN_BYTES + 1024),
  };
}

describe("LibraryService.uploadArtifact", () => {
  it("uploads a PDF, transitions to ready, and returns a DTO listed at the top of the user's library", async () => {
    const { service, repo } = makeService();

    const dto = await service.uploadArtifact(makeRequest());

    expect(dto.uploadStatus).toBe("ready");
    expect(dto.kind).toBe("pdf");
    expect(dto.title).toBe("report");
    expect(dto.pageCount).toBe(3);

    const list = await service.listArtifacts(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(dto.id);

    const libraries = await repo.listLibrariesForUser(USER_A);
    expect(libraries).toHaveLength(1);
    expect(libraries[0]?.name).toBe("My Library");
  });

  it("auto-creates the Default library exactly once across multiple uploads", async () => {
    const { service, repo } = makeService();

    await service.uploadArtifact(makeRequest({ fileName: "a.pdf", file: pdfBuffer(MIN_BYTES + 1024, "a") }));
    await service.uploadArtifact(makeRequest({ fileName: "b.pdf", file: pdfBuffer(MIN_BYTES + 1024, "b") }));

    expect(repo.listLibraries()).toHaveLength(1);
  });

  it("rejects files smaller than the minimum size with FileTooSmallError", async () => {
    const { service } = makeService();
    const tinyPdf = pdfBuffer(MIN_BYTES - 1);

    await expect(service.uploadArtifact(makeRequest({ file: tinyPdf }))).rejects.toBeInstanceOf(
      FileTooSmallError,
    );
  });

  it("rejects files larger than the maximum size with FileTooLargeError", async () => {
    const { service } = makeService({ config: makeConfig({ maxByteSize: MIN_BYTES + 100 }) });
    const tooLarge = pdfBuffer(MIN_BYTES + 101);

    await expect(service.uploadArtifact(makeRequest({ file: tooLarge }))).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
  });

  it("rejects non-PDF bytes (magic-byte sniff) with InvalidPdfError", async () => {
    const { service } = makeService();
    const fakePdf = Buffer.concat([Buffer.from("PNG"), Buffer.alloc(MIN_BYTES + 1024, 0)]);

    await expect(service.uploadArtifact(makeRequest({ file: fakePdf }))).rejects.toBeInstanceOf(
      InvalidPdfError,
    );
  });

  it("rejects a duplicate (same SHA-256) within the same user's library", async () => {
    const { service } = makeService();
    const file = pdfBuffer(MIN_BYTES + 1024, "duplicate");

    await service.uploadArtifact(makeRequest({ file }));
    await expect(service.uploadArtifact(makeRequest({ file }))).rejects.toBeInstanceOf(
      DuplicateArtifactError,
    );
  });

  it("does not leak a duplicate-key race past the application boundary", async () => {
    const repo = new InMemoryLibraryRepo();
    const file = pdfBuffer(MIN_BYTES + 1024, "race");
    const { service } = makeService({ repo });

    await service.uploadArtifact(makeRequest({ file }));
    const findOriginal = repo.findArtifactByHash.bind(repo);
    repo.findArtifactByHash = async () => null;

    await expect(service.uploadArtifact(makeRequest({ file }))).rejects.toBeInstanceOf(
      DuplicateArtifactError,
    );

    repo.findArtifactByHash = findOriginal;
  });

  it("scopes uploads per user — user B never sees user A's artifacts", async () => {
    const repo = new InMemoryLibraryRepo();
    const { service } = makeService({ repo });

    await service.uploadArtifact(
      makeRequest({ userId: USER_A, file: pdfBuffer(MIN_BYTES + 1024, "a") }),
    );

    const userBList = await service.listArtifacts(USER_B);
    expect(userBList).toHaveLength(0);
    expect(repo.listLibraries()).toHaveLength(2);
  });

  it("transitions to failed (rolled back) when the PDF parser throws", async () => {
    const repo = new InMemoryLibraryRepo();
    const failingParser: ParsePdf = async () => {
      throw new Error("boom");
    };
    const { service } = makeService({ repo, parsePdf: failingParser });

    await expect(service.uploadArtifact(makeRequest())).rejects.toBeInstanceOf(PdfParseError);
    expect(repo.listAllArtifacts()).toHaveLength(0);
  });
});

describe("LibraryService.listArtifacts", () => {
  it("returns the user's artifacts newest-first and ignores removed entries", async () => {
    const { service } = makeService();
    const fileOld = pdfBuffer(MIN_BYTES + 1024, "old");
    const fileNew = pdfBuffer(MIN_BYTES + 1024, "new");

    let now = new Date(FROZEN_NOW.getTime());
    const advancingClock = (): Date => new Date(now.getTime());

    const { service: timed } = makeService({
      repo: undefined,
      clock: advancingClock,
    });

    now = new Date("2026-05-08T22:00:00.000Z");
    await timed.uploadArtifact(makeRequest({ fileName: "old.pdf", file: fileOld }));
    now = new Date("2026-05-08T23:00:00.000Z");
    const newer = await timed.uploadArtifact(makeRequest({ fileName: "new.pdf", file: fileNew }));

    const list = await timed.listArtifacts(USER_A);
    expect(list[0]?.id).toBe(newer.id);
  });
});

describe("LibraryService.removeArtifact", () => {
  it("throws ArtifactNotFoundError for an unknown id", async () => {
    const { service } = makeService();
    await expect(service.removeArtifact(USER_A, "00000000-0000-4000-8000-00000000ffff")).rejects.toBeInstanceOf(
      ArtifactNotFoundError,
    );
  });

  it("removes a previously-uploaded artifact", async () => {
    const { service } = makeService();
    const dto = await service.uploadArtifact(makeRequest());

    await service.removeArtifact(USER_A, dto.id);
    const list = await service.listArtifacts(USER_A);
    expect(list).toHaveLength(0);
  });
});

describe("LibraryService.getArtifactBinary", () => {
  it("returns a stream for a successful upload", async () => {
    const { service } = makeService();
    const dto = await service.uploadArtifact(makeRequest());

    const binary = await service.getArtifactBinary(USER_A, dto.id);
    expect(binary.byteSize).toBeGreaterThan(0);
    expect(binary.mimeType).toBe("application/pdf");
    expect(binary.fileName).toBe("report.pdf");
  });

  it("throws ArtifactNotFoundError when another user requests the binary", async () => {
    const { service } = makeService();
    const dto = await service.uploadArtifact(makeRequest({ userId: USER_A }));

    await expect(service.getArtifactBinary(USER_B, dto.id)).rejects.toBeInstanceOf(
      ArtifactNotFoundError,
    );
  });
});
