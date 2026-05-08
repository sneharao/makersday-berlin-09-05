# Library — Ubiquitous Language

Terms scoped to the `library` bounded context. Use these terms exactly as defined here in code, comments, commit messages, and conversation when working in this context. Do not import these meanings into other contexts.

For terms that span all contexts (`Library`, `libraryId`, `Artifact`, `artifactId`), see [shared-language.md](../shared-language.md). The cross-context entries there state only what other contexts need; this file is the authoritative, full definition for everything inside `library`.

## Collection

### Library

A named collection of source documents owned by exactly one `User`. An aggregate root in this context. A user may have many libraries (e.g. one per research topic, one per project). A library belongs to exactly one user (immutable once set). Libraries are deactivated, never hard-deleted, because chats in the `chat` context reference them historically.

### LibraryName

A field on `Library` (a single required `LibraryName` value object). The human-readable name shown in the sidebar and on library cards. Trimmed on write; non-empty after trim. Unique within a user — a single user may not own two libraries with the same name (case-insensitive comparison after trim).

## Documents

### Artifact

A single uploaded source document inside a `Library` — a PDF, an article, a dataset, a book. **Internal entity** of the `Library` aggregate, not an aggregate root. Loaded, mutated, and queried only through its parent library. Cross-context references (e.g. citations on chat messages) carry the pair `(libraryId, artifactId)` because the artifact is reached only through its parent. An artifact belongs to exactly one library for its entire lifetime — to "copy" an artifact into another library, the user re-uploads the file there.

### ArtifactTitle

A field on `Artifact` (a single required `ArtifactTitle` value object). The human-readable title shown on library cards and in chat source-document panels. Defaults at upload time to the source filename without extension; user-editable thereafter. Trimmed on write; non-empty after trim. No uniqueness constraint.

### ArtifactKind

A field on `Artifact` (a single required `ArtifactKind` value object). The category of the document. **Closed enum, exactly one value, required.** Drives the category chip on library cards (the small "RESEARCH" / "ARTICLE" / "DATASET" / "BOOK" pill in the library design). Values:

- `pdf` — a generic uploaded PDF whose category has not been further classified. The default when no other classification applies.
- `research` — a research paper.
- `article` — a journal article, blog post, or magazine piece.
- `dataset` — a structured dataset (e.g. a CSV report, a tabular release).
- `book` — a book or book-length monograph.

The active list mirrors the chip categories shown in the library design. Code that switches on `ArtifactKind` must handle every value — there is no `default` fallback.

### UploadStatus

A field on `Artifact` (a single required `UploadStatus` value object). Where the artifact is in its upload/processing pipeline. **Closed enum, exactly one value, required.** Values:

- `uploading` — bytes are still being received from the user's browser.
- `processing` — bytes are received; the platform is extracting text, splitting into pages, and indexing for retrieval.
- `ready` — processing complete; the artifact is available for chats. `pageCount` and `processedAt` are present in this state and only this state.
- `failed` — upload or processing failed. Terminal — to retry, the user uploads a fresh artifact.
- `removed` — the user removed the artifact from the library. Terminal — the record persists so existing citations on chat messages still resolve, but the artifact is no longer listed in the library UI.

Allowed transitions: `uploading → processing → ready`; `uploading → failed`; `processing → failed`; `ready → removed`. Every other transition is forbidden.

### SourceFile

A field on `Artifact` (a single required `SourceFile` value object). The stored binary backing the artifact. Four fields, all set at upload time and immutable for the artifact's lifetime:

- `storageUri` — opaque URI pointing to the stored binary in the platform's blob store. Treated as opaque in the domain — the storage backend is a platform concern, not a domain one.
- `byteSize` — integer size in bytes; positive.
- `mimeType` — IANA media type string. Validated as syntactically well-formed; the active accepted set is gated at the application layer (v1: PDF only — `application/pdf`).
- `sha256Hash` — lower-cased hex SHA-256 of the file contents. Used to enforce within-library upload de-duplication: the same exact file cannot be uploaded twice into the same library. Cross-library duplicates are allowed.

### `pageCount`

A field on `Artifact` (integer). The number of pages extracted during processing. Required and ≥ 1 when `uploadStatus` is `ready`; absent in every other state. Used by the `chat` context to validate `Citation.pageNumber` against the cited artifact's page range.

### `uploadedAt`

A field on `Artifact` (timestamp). The moment the upload was initiated.

### `processedAt`

A field on `Artifact` (timestamp). The moment `uploadStatus` became `ready`. Set if and only if `uploadStatus` is `ready`.

## Lifecycle

### `isActive` (on Library)

A field on `Library`. `true` for in-use libraries; `false` for deactivated. Soft-delete flag — libraries are never hard-deleted, because chats in the `chat` context reference them historically by `libraryId`. When a library is deactivated, its artifacts remain readable (and citations to them remain resolvable) but no new artifacts may be uploaded and no new chats may be created against it.

### `libraryId` (on Artifact)

A field on `Artifact`. The id of the parent library this artifact belongs to. Always equal to the parent `Library.id`; carried denormalised on the entity for clarity at the application layer. Immutable once set — the parent library cannot change.
