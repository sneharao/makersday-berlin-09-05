/**
 * Default `ParsePdf` implementation backed by the `pdf-parse` library.
 *
 * GR-002 deliberately does not introduce a `pdf-storage.gateway.ts` port for
 * binary storage (see plan §1, Storage — Option B), but it *does* keep the
 * PDF parser injected into `LibraryService` so the application ring stays
 * free of `pdf-parse` imports. This file is the only place that imports the
 * library; the application service receives a function reference.
 */
import { PDFParse } from "pdf-parse";
import type { ParsePdf, ParsePdfResult } from "@backend-application/library/library.service";
import { PdfParseError } from "@backend-application/library/errors";

export const parsePdfWithPdfParse: ParsePdf = async (buffer: Buffer): Promise<ParsePdfResult> => {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const info = await parser.getInfo();
    if (typeof info.total !== "number" || info.total < 1) {
      throw new PdfParseError("PDF has no pages");
    }
    return { pageCount: info.total };
  } catch (error) {
    if (error instanceof PdfParseError) throw error;
    const message = error instanceof Error ? error.message : "Could not read PDF";
    throw new PdfParseError(message);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};
