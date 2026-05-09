---
name: gr-002 library pdf upload
overview: "Implement GR-002 (Library PDF upload + browse) in full alignment with the harness `library` bounded context: `Library` aggregate (auto-created Default library per user) with `Artifact` internal entity persisted across two collections, GridFS for binaries via a thin platform wrapper, and a 1:1 `/library` view of the design."
todos:
  - id: domain
    content: "Author domain layer: library.ts, artifact.ts (with SourceFile + state-machine .superRefine), library.repo.ts port"
    status: completed
  - id: application
    content: "Author application layer: LibraryService, library.dto.ts, errors.ts, config.ts; cover ACs 4, 5, 7, 8, 9 with in-memory repo + injected pdf parser"
    status: completed
  - id: platform-gridfs
    content: Add gridfs-bucket.ts wrapper in platform/infrastructure/mongo/ with header rationale
    status: completed
  - id: infra-repo
    content: Add Typegoose models (library-mongo.model.ts, artifact-mongo.model.ts) and library-mongo.repo.ts adapter; storageUri uses gridfs://<id> scheme; integration test for AC 8 + AC 10
    status: completed
  - id: controller
    content: Add LibraryController with busboy streaming, magic-byte sniff (8-byte buffer), error mapping (400/409/413/415); integration test mocking the service
    status: completed
  - id: composition
    content: Wire LibraryConfig into run-config, instantiate repo + service in application.instances, export libraryController in controller.instances
    status: completed
  - id: routes
    content: Add api.library.artifacts.upload.ts, api.library.artifacts.ts (GET list), api.library.artifacts.$artifactId.ts (GET stream + DELETE), and api.library.artifacts._sdk.ts; rewrite routes/pages/library.tsx loader
    status: completed
  - id: ui
    content: "Build UI components in ui.client/components/domain/library/: LibraryView, Sidebar, TopAppBar, UploadDropzone (drag state + spinner), DocumentGrid + DocumentCard, hooks (use-upload-artifact, use-document-toasts)"
    status: completed
  - id: ticket-update
    content: Update jira-tickets/todo/gr_002_library_pdf_upload.md to align with the harness domain model (camelCase, two collections, library/artifact terminology)
    status: completed
  - id: harness-doc
    content: Add a one-line note in harness/knowledge/domain/library/data-model.md documenting the v1 single-default-library behaviour and the gridfs:// URI scheme
    status: completed
  - id: checks
    content: Run npm run typecheck and npm run test; fix all errors; manual smoke against the design
    status: completed
  - id: exec-plan-and-pr
    content: Save plan.md + conversation-summaries.md under harness/exec-plans/001-gr_002-library-pdf-upload/; create branch, commit, push, open draft PR labelled plan
    status: in_progress
isProject: false
---

## GR-002 — Library PDF Upload & Browse

> Workflow stage: `harness/dev-workflow/001_plan.md`. Plan output destination: `harness/exec-plans/001-gr_002-library-pdf-upload/{plan.md, conversation-summaries.md}`.

### 1. Decisions resolved during planning

- **Domain shape — Option A.** Implement the full harness `library` aggregate. A user has many libraries in the model, but for GR-002 we **auto-provision a single "Default library"** per user (created lazily on first sign-in or first upload). `/library` shows that single library's artifacts. The `(libraryId, sha256Hash)` uniqueness rule satisfies the ticket's "duplicate within user" requirement because the user only has one library today. *Multi-library UX is a future ticket.*
- **Storage — Option B.** Direct GridFS via a small `gridfs-bucket.ts` wrapper in `platform/infrastructure/mongo/`, used by `LibraryMongoRepo`. We do not introduce a `pdf-storage.gateway.ts` port today; if/when storage choice changes, that is the upgrade path. This is a deliberate, documented divergence from the harness manifesto's "external capabilities behind a port" guidance and will be called out in the ADR-style note inside `conversation-summaries.md`.
- **Naming.** Follow the harness, not the ticket: `userId`, `libraryId`, `sourceFile.sha256Hash` (camelCase), not `user_id`/`sha256`. The ticket itself will be updated to match.
- **Status state machine.** Synchronous in-request: `uploading` → after stream completes `processing` → after `pdf-parse` extracts `pageCount` → `ready`. On any failure: `failed`. No worker, no queue. Simple and adequate for MVP.
- **Refresh strategy.** Server is the source of truth. The upload `action` returns the freshly inserted `ArtifactDto`; the page uses React Router's `useFetcher` so the `loader` revalidates and the new card appears at the top without a manual refresh.

### 2. New files (creation)

#### Domain (`app/backend.server/domain/library/`)
- `library.ts` — `Library` entity + Zod schema. Fields: `id`, `userId`, `name`, `description?`, `isActive`, `createdAt`, `updatedAt`. `LibraryName` enforced inline as `z.string().trim().min(1)`.
- `artifact.ts` — `Artifact` entity + Zod schema + nested `SourceFile` schema and `ArtifactKind`/`UploadStatus` enums. Cross-field invariants via `.superRefine`: `pageCount` and `processedAt` present iff `uploadStatus === "ready"`.
- `library.repo.ts` — `LibraryRepo` port. Library-level: `getDefaultForUser(userId)`, `ensureDefaultForUser(userId)`. Artifact-level (all `userId`-scoped via parent library): `addArtifactToLibrary`, `getArtifactById`, `listArtifactsForLibrary`, `findArtifactByHash`, `updateArtifactStatus`, `removeArtifact`. **No method names betray Mongo.** Methods that read or persist binary content take/return Node `Readable` streams supplied by the application layer (e.g. `openArtifactBinary(userId, libraryId, artifactId): Promise<Readable>`).

#### Application (`app/backend.server/application/library/`)
- `library.service.ts` — `LibraryService` orchestrating use cases:
  - `ensureDefaultLibrary(userId)` — idempotent, returns the Default library.
  - `uploadArtifact({ userId, fileName, byteSize, mimeType, stream })` — orchestrates streaming into the repo, hash compute, dedupe lookup, page-count extraction, status transitions, returns `ArtifactDto`. Throws application errors (below) for validation failures.
  - `listArtifacts(userId)` — newest-first within Default library.
  - `streamArtifactBinary(userId, artifactId): { mimeType, byteSize, stream }`.
  - `removeArtifact(userId, artifactId)`.
- `library.dto.ts` — `ArtifactDto`, `LibraryDto`, `UploadArtifactRequest` (the application-level use-case shape, *not* the wire shape), and pure mappers `toArtifactDto`, `toLibraryDto`.
- `errors.ts` — `InvalidPdfError`, `FileTooSmallError`, `FileTooLargeError`, `DuplicateArtifactError`, `ArtifactNotFoundError`, `PdfParseError`. Plain classes with stable codes for the controller to translate.
- `config.ts` — `LibraryConfig`: `minByteSize` (default 10 240), `maxByteSize` (default 26 214 400), `defaultLibraryName` ("My Library"). `fromEnv` reads `LIBRARY_MAX_UPLOAD_BYTES` (optional override) via `readFromEnv`.

#### Infrastructure / API (`app/backend.server/infrastructure/api/library/`)
- `library.controller.ts` — `LibraryController`. Methods:
  - `getInitialState(request)` — fetches the user's Default library + artifact list for the page loader.
  - `uploadArtifact(request)` — parses multipart (busboy stream), enforces the 25 MB hard cap before reading bytes (`Content-Length` check → 413 if exceeded), pipes the file part to `LibraryService.uploadArtifact`, maps application errors to JSON responses with status codes.
  - `listArtifacts(request)`, `streamArtifactBinary(request, artifactId)`, `deleteArtifact(request, artifactId)`.
- `request-schemas.ts` / `response-schemas.ts` — zod schemas for non-multipart endpoints + the response shape (`ArtifactResponse`, `ListArtifactsResponse`, `ErrorResponse`).

#### Infrastructure / Repositories (`app/backend.server/infrastructure/repositories/library/`)
- `library-mongo.model.ts` — Typegoose model `LibraryMongoModel implements Library`. `nameLower` shadow field with compound unique index on `(userId, nameLower)` per `harness/knowledge/domain/library/data-model.md`.
- `artifact-mongo.model.ts` — Typegoose model `ArtifactMongoModel implements Artifact`, embedded `SourceFileMongo` subdoc, indexes per the data-model: `id` unique, `libraryId`, `(libraryId, sourceFile.sha256Hash)` unique, `(libraryId, uploadStatus, kind)`.
- `library-mongo.repo.ts` — `LibraryMongoRepo extends Repository<LibraryMongoDocument, Library> implements LibraryRepo`. Owns both collections; the only place that knows `artifacts` exists. Uses the new `gridFsBucket` for binary I/O. Tenancy enforced by always loading the parent library by `(userId, libraryId)` first.

#### Platform infrastructure (`app/backend.server/platform/infrastructure/mongo/`)
- `gridfs-bucket.ts` — thin wrapper around `mongoose.mongo.GridFSBucket` exposing `openUploadStreamWithMetadata(metadata)`, `openDownloadStream(fileId)`, `delete(fileId)`. No domain types. Integration test in `tests/backend.server/infrastructure/`.

#### Composition root (`app/backend.server/main/`)
- `run-config.ts` — extend `AppConfig` with `library: LibraryConfig`.
- `application.instances.ts` — extend to instantiate `LibraryMongoRepo` and `LibraryService(libraryRepo, libraryConfig, () => new Date())`.
- `controller.instances.ts` — export `libraryController = new LibraryController(app.libraryService)`.

#### Routes (`app/routes/`)
- `pages/library.tsx` — replace placeholder with real loader/component. Loader calls `libraryController.getInitialState(request)`, returns `{ user, library, artifacts }`. Component renders `<LibraryView />`. Continues to use `enforceAuth` from route-utils.
- `api/api.library.artifacts.upload.ts` — `action` only, multipart POST → controller.
- `api/api.library.artifacts.ts` — `loader` (list) and `action` (DELETE for the card overflow menu, dispatched via `_action` field on a small JSON body or `?intent=delete` query — final shape settled in the `_sdk`).
- `api/api.library.artifacts.$artifactId.ts` — `loader` streams the original PDF (`Content-Type: application/pdf`, `Content-Disposition: inline`), `action` handles DELETE.
- `api/api.library.artifacts._sdk.ts` — `callUploadArtifactApi(file)`, `callListArtifactsApi`, `callDeleteArtifactApi(id)`, `getArtifactDownloadUrl(id)`. Validates response shapes with Zod.

#### UI (`app/ui.client/components/domain/library/`)
- `LibraryView.tsx` — page composition: `<Sidebar />` + `<TopAppBar />` + main area with `<UploadDropzone />` and `<DocumentGrid />`.
- `Sidebar.tsx` — fixed 280 px nav, Library active, Chat / History as `aria-disabled` placeholders (mirrors GR-001 link-out treatment).
- `TopAppBar.tsx` — 64 px sticky bar; the search input is rendered with `disabled` per ticket scope.
- `UploadDropzone.tsx` — dashed dropzone, `dragenter`/`dragover` toggles a `is-drag-over` style (`border-primary` + `bg-surface-container` per design tokens), Browse button opens hidden `<input type="file" accept="application/pdf">`, single file, in-flight spinner overlay.
- `DocumentGrid.tsx` + `DocumentCard.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter`. Card shows generic PDF icon (Material Symbols `picture_as_pdf`), title, "PDF" tag (always — categories out of scope), upload date, overflow menu with Delete.
- `hooks/use-upload-artifact.ts` — encapsulates `useFetcher`-driven upload with optimistic-pending state, surfaces error toasts.
- `hooks/use-document-toasts.ts` — small toast queue for size/type/dedupe errors; presentational toaster lives in `LibraryView.tsx`.

#### Tests (`tests/backend.server/`)
- `application/library/library.service.test.ts` — vitest, in-memory port, fixed clock. One test per acceptance criterion (see §4).
- `application/shared/in-memory-library-repo.ts` — implements `LibraryRepo` over a `Map`; supports `seed` and inspection helpers (`artifactsFor(libraryId)`).
- `infrastructure/repositories/library/library-mongo.repo.integration.test.ts` — round-trip test against a test database (uses existing `MongoDBClient`, `mongoDB.MONGO_DATABASE` overridden to `scholastic-ai-test`); covers index uniqueness on `(libraryId, sha256Hash)` and GridFS read-back.
- `infrastructure/api/library/library-controller.integration.test.ts` — mocks `LibraryService`, asserts request validation, multipart parsing happy + failure paths, error → status mapping.

### 3. Modifications (existing files)

- `app/routes/pages/library.tsx` — replace welcome placeholder.
- `app/backend.server/main/{run-config.ts,application.instances.ts,controller.instances.ts}` — wire library context.
- `package.json` — add `busboy` (streaming multipart), `pdf-parse` (page count), `uuid` (already a transitive dep of typegoose; add as direct), and types where applicable. Verify these are computation-style libs allowed in `infrastructure/`.
- `.env.example` — add `LIBRARY_MAX_UPLOAD_BYTES=26214400` (optional override).
- `harness/knowledge/domain/library/data-model.md` — add a small note that v1 auto-provisions a single "My Library" per user (does not change the model, just documents the v1 product behaviour).
- `jira-tickets/todo/gr_002_library_pdf_upload.md` — update wording to match the harness model: rename `documents` collection references to `Library`/`Artifact`/two collections, rename `sha256` → `sourceFile.sha256Hash`, rename snake_case fields to camelCase, replace "MongoDB GridFS via single collection" with "MongoDB GridFS via the `library-mongo.repo.ts` adapter"; preserve the user-visible acceptance criteria untouched. Move ticket to `jira-tickets/in-review/` only at PR time (not during planning).

### 4. Acceptance criteria → tests

| Ticket AC | Test type | Test |
|---|---|---|
| 1. Visual fidelity | Manual / future Playwright | Out of scope for vitest; capture screenshot in PR. |
| 2. Drag & drop | Component (future jsdom test) | Manual for MVP; component is small and tokenised. |
| 3. Browse files button | Manual | n/a |
| 4. Persistence + appears at top | Application unit test | `uploads new artifact and listForUser returns it newest-first`. |
| 5. Validation: too small (<10 KB) | Application unit test | `rejects with FileTooSmallError`; controller test asserts 400 + `"File is too small to be a valid PDF"`. |
| 6. Validation: too large (>25 MB) | Controller integration test | Asserts `Content-Length` > 25 MB returns 413 before the body is read; controller never calls service. |
| 7. Validation: wrong type | Application + controller test | Magic-byte sniff (`%PDF-` header) — service rejects with `InvalidPdfError`; controller maps to 415. |
| 8. Validation: duplicate | Application unit test | Pre-seed an artifact with hash `H`; second upload of the same hash throws `DuplicateArtifactError`; controller maps to 409 with `"This document is already in your library"`. Repository integration test asserts the unique index actually fires. |
| 9. Authorisation | Application unit test | Calls without a `userId` reject; user A cannot see/list user B's artifacts (parent-library lookup returns null). Loader-level `enforceAuth` already covered by GR-001 patterns. |
| 10. GridFS storage + delete cleans up | Repository integration test | Upload writes a GridFS file; `removeArtifact` deletes both the artifact doc and its `gridfs_file_id`. |

### 5. Implementation order (TDD-friendly)

1. Add domain (`library.ts`, `artifact.ts`, `library.repo.ts`) — typecheck only.
2. Add `library.dto.ts`, `errors.ts`, `config.ts` and `library.service.ts` red→green against an in-memory `LibraryRepo`. Cover ACs 4, 5, 7, 8, 9 here.
3. Add `gridfs-bucket.ts`, two Typegoose models, `library-mongo.repo.ts`. Repository integration test covers AC 8 (real index) and AC 10.
4. Add `library.controller.ts` + multipart parsing. Controller integration test covers AC 6 and the error-mapping table.
5. Wire composition root; add `api.library.*` routes and `_sdk`.
6. Replace `routes/pages/library.tsx`; build UI components; wire `useFetcher` upload.
7. Manual smoke against the design (ACs 1–3) + npm run typecheck + npm run test.

### 6. Risks & open assumptions

- **`pdf-parse` correctness on malformed PDFs.** Mitigation: wrap in try/catch; on failure transition artifact to `failed` and surface a "Could not read PDF" toast. Treated as a soft failure — the binary is still in GridFS, the user can re-upload.
- **Memory pressure during page count.** `pdf-parse` reads the full buffer. For a 25 MB cap that's acceptable; we read it back from GridFS as a stream → buffer → parse. If we ever raise the cap we'll need a streaming parser.
- **Multipart parsing transport.** `busboy` is pinned because it's small and does true streaming. React Router 7's `unstable_parseMultipartFormData` is **not** used (it materialises files in memory and locks us into a `File` API).
- **Default library name collision.** `(userId, nameLower)` is unique. If a user later renames their library and a future feature creates another "My Library", it'll fail by design — acceptable for v1; addressed when multi-library UI lands.
- **GridFS leakage on failed uploads.** If page-count or status update throws after the GridFS write, we orphan a file. Mitigation: `LibraryService.uploadArtifact` wraps the post-write steps in a try/catch and calls `gridFsBucket.delete(fileId)` on rollback. Integration test covers this path.

### 7. Self-critique (per `harness/skills/planning/critique-coding-plan.md`)

#### Gaps & blind spots
**Issue:** The plan treats artifact `(libraryId, sha256Hash)` uniqueness only at the index level; under concurrent uploads of the same hash, the index will reject the second insert mid-stream after GridFS has already accepted the bytes.
**Suggestion:** In `LibraryService.uploadArtifact`, do a `findArtifactByHash` *before* opening the GridFS write to short-circuit the common case, and on the rare race where the unique-index insert throws after GridFS write, catch the duplicate-key error and `gridFsBucket.delete(fileId)` for cleanup. Add a dedicated test for the race path using two concurrent calls in the in-memory repo (which simulates by deferring inserts).

#### Robustness
**Issue:** Magic-byte sniffing on the *first chunk only* will misclassify multipart streams whose first chunk is shorter than 5 bytes.
**Suggestion:** Buffer the first 8 bytes from busboy's file stream before piping the rest into GridFS — reject if `header.subarray(0,5).toString() !== "%PDF-"`. Cite RFC 8118 / PDF 1.7 §7.5.2 in the comment.

#### Simplicity
**Issue:** Two API route files (`api.library.artifacts.ts` for list+delete and `api.library.artifacts.$artifactId.ts` for stream+delete) split the delete logic awkwardly.
**Suggestion:** Put list on `api.library.artifacts.ts` (GET only) and put both stream + delete on `api.library.artifacts.$artifactId.ts`. One delete handler total.

#### Testability
**Issue:** The application service ends up with three injected dependencies (`repo`, `config`, `clock`) plus an implicit `pdf-parse` import — not injectable.
**Suggestion:** Pass `parsePdf: (Buffer) => Promise<{ pageCount: number }>` as a fourth constructor arg, defaulted in `application.instances.ts` to a wrapper around `pdf-parse`. Tests inject a deterministic stub. Keeps the service free of `pdf-parse` import (pure-ish application ring).

#### Consistency
**Issue:** `gridfs-bucket.ts` lives in `platform/infrastructure/mongo/` but is consumed by a single context (`library`); this borders on premature platformisation. The harness manifesto says platform code is "reusable backend-generic code… candidate for extraction".
**Suggestion:** Keep it in `platform/infrastructure/mongo/` anyway — GridFS is a pure mongo capability that is genuinely reusable, not library-domain-coupled. Document the rationale in the file's header. (Triage: keep as planned.)

#### Maintainability
**Issue:** The `LibraryService` swells with five use cases. The harness allows one service per context but we should pre-emptively keep methods short.
**Suggestion:** Co-locate small private helpers (`provisionDefaultLibrary`, `transitionToReady`) inside the same file rather than splitting into multiple services prematurely. Re-evaluate after GR-003 lands.

#### Design principles
**Issue:** The plan stores the GridFS file id as `sourceFile.storageUri` ("`gridfs://<id>`"), but `storageUri` is documented as opaque in the domain — embedding the protocol bakes in the storage choice.
**Suggestion:** Treat `gridfs://` as the canonical URI scheme, document it in `harness/knowledge/domain/library/data-model.md` (one-line note), and keep parsing/dispatching of the URI inside `library-mongo.repo.ts` only. The domain still treats it as opaque; the repo is the only thing that knows the scheme.

### 8. Triage decisions

- Accept all critique points (1, 2, 3, 4, 6, 7) and fold them into the plan during execution.
- Reject the platformisation worry (5) — `gridfs-bucket.ts` stays in `platform/infrastructure/mongo/` with a header comment.

### 9. Out of plan / explicitly deferred

- Multi-library UX (sidebar list, per-library detail view, library creation/rename/archive).
- PDF thumbnails / cover extraction.
- Real `ArtifactKind` classification (everything is `pdf` for now).
- Async processing pipeline (workers, queues).
- Search input wiring.
- Multi-file batch upload progress UI.

### 10. Workflow next steps after approval

Per `harness/dev-workflow/001_plan.md` Step 9: branch (`feature/gr-002-library-pdf-upload`), commit `plan.md` + `conversation-summaries.md` to `harness/exec-plans/001-gr_002-library-pdf-upload/`, push, open a **draft** PR labelled `plan` with `marduSwanepoel` as reviewer (per the user-level `create-develop-pr` skill).