export class FileTooSmallError extends Error {
  constructor(public readonly minByteSize: number) {
    super("File is too small to be a valid PDF");
    this.name = "FileTooSmallError";
  }
}

export class FileTooLargeError extends Error {
  constructor(public readonly maxByteSize: number) {
    super(`File exceeds the ${Math.floor(maxByteSize / (1024 * 1024))} MB limit`);
    this.name = "FileTooLargeError";
  }
}

export class InvalidPdfError extends Error {
  constructor() {
    super("Only PDF files are supported");
    this.name = "InvalidPdfError";
  }
}

export class DuplicateArtifactError extends Error {
  constructor() {
    super("This document is already in your library");
    this.name = "DuplicateArtifactError";
  }
}

export class ArtifactNotFoundError extends Error {
  constructor() {
    super("Artifact not found");
    this.name = "ArtifactNotFoundError";
  }
}

export class PdfParseError extends Error {
  constructor(message = "Could not read PDF") {
    super(message);
    this.name = "PdfParseError";
  }
}
