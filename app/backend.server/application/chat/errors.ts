export class ChatNotFoundError extends Error {
  constructor() {
    super("Chat not found");
    this.name = "ChatNotFoundError";
  }
}

export class MessageBodyEmptyError extends Error {
  constructor() {
    super("Message body cannot be empty");
    this.name = "MessageBodyEmptyError";
  }
}

export class MessageBodyTooLongError extends Error {
  constructor(public readonly maxChars: number) {
    super(`Message body exceeds the ${maxChars} character limit`);
    this.name = "MessageBodyTooLongError";
  }
}

/**
 * Thrown when a citation produced by the response gateway points to a page
 * outside the cited artifact's `[1, pageCount]` range. The application
 * service drops the offending citation rather than failing the whole append
 * (defensive citation validation, not a gating rule).
 */
export class CitationOutOfRangeError extends Error {
  constructor(public readonly artifactId: string, public readonly pageNumber: number) {
    super(`Citation page ${pageNumber} is out of range for artifact ${artifactId}`);
    this.name = "CitationOutOfRangeError";
  }
}
