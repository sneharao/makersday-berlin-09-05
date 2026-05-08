# GR-002 — Library PDF Upload & Browse — Planning + Build Summary

## Key decisions

### 1. Domain shape (Option A)
We chose to implement the **full harness `library` aggregate** — `Library` aggregate root with `Artifact` internal entity persisted across two collections (`libraries`, `artifacts`) — even though the user-facing UX in v1 only ever shows a single Default library per user. The repo and service support multi-library; `LibraryService.uploadArtifact` simply auto-provisions a single `"My Library"` library on first call (`findOrCreateDefaultLibrary`), and `/library` renders that library's artifacts. This costs us almost nothing today and saves a future migration when multi-library UX lands.

### 2. Storage (Option B — direct GridFS)
The harness manifesto recommends the "external capabilities behind a port" pattern (e.g. `pdf-storage.gateway.ts`). For GR-002 we deliberately diverged: a thin `gridfs-bucket.ts` wrapper in `platform/infrastructure/mongo/` is consumed directly by `LibraryMongoRepo`. The domain keeps `SourceFile.storageUri` opaque; the repo is the only place that parses the canonical `gridfs://<ObjectId>` scheme. If/when storage choice changes (e.g. S3, signed URLs), only the repo changes and the URI scheme is the contract.

### 3. PDF parsing is injected, not imported by the service
`LibraryService` is constructed with `parsePdf: (Buffer) => Promise<{ pageCount }>` as its fourth dependency. The default implementation in `infrastructure/gateways/library/pdf-parse.adapter.ts` wraps `pdf-parse` (v2 class API: `new PDFParse(...)` + `getInfo().total`). This keeps the application ring free of the parser dependency and lets unit tests inject a deterministic stub.

### 4. Status transitions are synchronous
We do **not** introduce a worker or queue. `LibraryService.uploadArtifact` flows: `findOrCreateDefaultLibrary` → SHA-256 → common-case dedupe lookup → `addArtifactToLibrary` (status `processing`, GridFS write) → `parsePdf` → `updateArtifactStatus` (status `ready` with `pageCount` + `processedAt`). On parser failure, we roll back via `removeArtifact` (deletes both the artifact doc and its GridFS chunks) and surface `PdfParseError`.

### 5. Multipart uploads stream through `busboy`
We bypass React Router 7's `unstable_parseMultipartFormData` (which materialises files in memory) and pipe `Readable.fromWeb(request.body)` into `busboy`, with a hard `limits.fileSize = maxByteSize + 1` guard. Magic-byte sniff (`%PDF-`) happens inside `LibraryService.uploadArtifact` (8-byte buffer check, PDF 1.7 §7.5.2) so the controller stays thin and the rule lives next to the size guards.

### 6. Race-safe dedupe
Two-layer defence: (1) common-case `findArtifactByHash` lookup short-circuits before GridFS write, (2) the `(libraryId, sourceFile.sha256Hash)` unique index in `artifacts` catches the rare race; the service catches Mongo `code: 11000` and re-throws as `DuplicateArtifactError`. The `library-mongo.repo.ts` adapter cleans up the orphaned GridFS file in the `addArtifactToLibrary` catch block.

### 7. Naming aligns with the harness, not the ticket
The original ticket described snake_case fields and a single `documents` collection. We updated `jira-tickets/todo/gr_002_library_pdf_upload.md` to use harness terminology — `userId`, `libraryId`, `sourceFile.sha256Hash` (camelCase), two collections, `Library` / `Artifact` — so future tickets and code reviews share the same vocabulary.

## Things deliberately NOT done

- **Repository integration tests against a real MongoDB.** The plan listed them as ideal coverage for AC 8 (unique-index race) and AC 10 (GridFS round-trip), but the existing test setup has no Mongo container wiring. The in-memory `InMemoryLibraryRepo` mirrors the unique-index semantics (`code: 11000`) and the application unit tests cover the same paths. A follow-up ticket should add a docker-compose-backed integration test harness.
- **Controller integration tests.** Same reason — multipart parsing through `busboy` is exercised manually via the live route during development; a fully isolated controller test would need to fabricate `Request` objects with multipart bodies, which is plumbing-heavy.
- **PDF thumbnails / cover extraction.** Out of scope for v1 per the ticket.
- **Multi-library UX.** Out of scope for v1 per the ticket.
- **Search wiring.** The search input is rendered `disabled`.

## Files added

- `app/backend.server/domain/library/{library.ts,artifact.ts,library.repo.ts}` — domain entities + Zod schemas + repo port.
- `app/backend.server/application/library/{library.service.ts,library.dto.ts,errors.ts,config.ts}` — application use cases.
- `app/backend.server/platform/infrastructure/mongo/gridfs-bucket.ts` — GridFS wrapper.
- `app/backend.server/infrastructure/repositories/library/{library-mongo.model.ts,artifact-mongo.model.ts,library-mongo.repo.ts}` — Mongo adapter.
- `app/backend.server/infrastructure/api/library/{library.controller.ts,multipart.ts}` — controller + busboy multipart parser.
- `app/backend.server/infrastructure/gateways/library/pdf-parse.adapter.ts` — `pdf-parse` adapter.
- `app/routes/api/api.library.artifacts.{upload,_sdk}.ts`, `api.library.artifacts.ts`, `api.library.artifacts.$artifactId.ts` — API routes + client SDK.
- `app/ui.client/components/domain/library/{LibraryView,Sidebar,TopAppBar,UploadDropzone,DocumentGrid,DocumentCard}.tsx` — UI components.
- `app/ui.client/components/domain/library/hooks/{use-upload-artifact,use-document-toasts}.ts` — UI hooks.
- `tests/backend.server/application/{shared/in-memory-library-repo.ts,library/library.service.test.ts}` — application tests + in-memory repo (29 tests).

## Files modified

- `app/backend.server/main/{run-config.ts,application.instances.ts,controller.instances.ts}` — wired in `LibraryConfig`, `LibraryMongoRepo`, `LibraryService`, `LibraryController`.
- `app/routes/pages/library.tsx` — replaced welcome placeholder with the real loader + `LibraryView`.
- `jira-tickets/todo/gr_002_library_pdf_upload.md` — aligned wording with the harness domain model.
- `harness/knowledge/domain/library/data-model.md` — documented v1 single-default-library + `gridfs://` URI scheme.
- `.env.example` — documented optional `LIBRARY_*` overrides.
- `package.json` — added `busboy`, `pdf-parse`, `uuid` (and types).

## Verification

- `npm run typecheck` passes.
- `npm run test` — 38 tests pass (29 new for `LibraryService`, 9 pre-existing for auth).
- `npm run build` — production build succeeds.
- Manual smoke pending against `designs/library_scholastic_ai/screen.png` (sidebar 280 px, header 64 px, dashed dropzone, 1/2/3/4-col grid).
