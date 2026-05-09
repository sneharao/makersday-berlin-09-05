---
name: gr-003 chat with library
overview: "Implement GR-003 (Chat with the library + canned responses + source-document panel) on the harness `chat` bounded context: a single `Chat` aggregate root with append-only `ChatMessage` entities, persisted across two collections; the canned-response engine sits behind a `ChatResponseGateway` so the LLM/RAG upgrade is a single dependency change; `ChatService` calls `LibraryService` (not `LibraryRepo`) for cross-context library/artifact access."
todos:
  - id: layout-shell
    content: "Promote Sidebar + TopAppBar to ui.client/components/layout/AppShell; parameterise active item via useLocation; library page swaps imports"
    status: pending
  - id: domain
    content: "Author chat domain: chat.ts (with ChatTitle), chat-message.ts (with MessageRole, MessageBody, Citation; .superRefine for citations-only-on-assistant), chat.repo.ts port, chat-response.gateway.ts port"
    status: pending
  - id: application
    content: "Author chat application: ChatService, chat.dto.ts, errors.ts, config.ts; orchestrate createChat → system greeting → appendMessage flow; cover ACs 2/3/4/6/7/8 with in-memory ChatRepo + stub gateway + stub LibraryService"
    status: pending
  - id: library-service-extension
    content: "Extend LibraryService with getArtifactById(userId, artifactId) so ChatService can resolve citations cross-context via service, not repo (per dependency-rules.md)"
    status: pending
  - id: gateway-adapter
    content: "Implement CannedChatResponseAdapter at infrastructure/gateways/chat/canned-chat-response.adapter.ts; keyword switch (summary | compare | definition | default) with empty-library fallback; safe pageNumber=1 + templated excerpt"
    status: pending
  - id: infra-repo
    content: "Add Typegoose models (chat-mongo.model.ts, chat-message-mongo.model.ts), ChatMongoRepo adapter; sequence allocation per data-model.md (compute next, insert, retry on (chatId, sequence) unique-index race); maintain Chat.lastMessageAt + updatedAt on every append"
    status: pending
  - id: controller
    content: "Add ChatController with createChat / getChat / appendMessage methods; map ApplicationError → HTTP status (404/403/400/422); thin (≤15 lines/method)"
    status: pending
  - id: composition
    content: "Wire ChatConfig into run-config; instantiate ChatRepo + CannedChatResponseAdapter + ChatService(chatRepo, libraryService, gateway, config, clock) in application.instances; export chatController in controller.instances"
    status: pending
  - id: routes
    content: "Add api.chat.chats.ts (POST create), api.chat.chats.$chatId.ts (GET fetch), api.chat.chats.$chatId.messages.ts (POST append), api.chat.chats._sdk.ts; add page routes pages/chat.tsx (loader auto-creates + redirects) and pages/chat.$chatId.tsx (loader fetches chat + messages + library + artifacts)"
    status: pending
  - id: ui
    content: "Build chat UI components in ui.client/components/domain/chat/: ChatView, ChatMessages, ChatBubble, CitationChip, ChatComposer (autosize textarea, Shift+Enter newline, Enter submit, in-flight disable), SourceDocumentsPanel, IncludeDocumentsModal; hooks: use-send-message, use-active-artifact-ids, use-composer"
    status: pending
  - id: ticket-update
    content: "Update jira-tickets/todo/gr_003_chat_with_library.md to harness terminology: Chat / chatId / chats / chat_messages / chat-response.gateway; preserve user-visible AC text"
    status: pending
  - id: harness-doc
    content: "Note in harness/knowledge/domain/chat/data-model.md: ChatService depends on LibraryService (not LibraryRepo) per dependency-rules.md; v1 auto-binds chat to the user's Default library"
    status: pending
  - id: checks
    content: "Run npm run typecheck and npm run test; fix all errors; manual smoke against designs/chat_elegant_minimal_variant/screen.png"
    status: pending
  - id: exec-plan-and-pr
    content: "Save plan.md + conversation-summaries.md under harness/exec-plans/002-gr_003-chat-with-library/; create branch, commit, push, open draft PR labelled plan"
    status: pending
isProject: false
---

## GR-003 — Chat With the Library (canned responses + source panel)

> Workflow stage: `harness/dev-workflow/001_plan.md`. Plan output destination: `harness/exec-plans/002-gr_003-chat-with-library/{plan.md, conversation-summaries.md}`.

### 1. Decisions resolved during planning

- **Naming.** Follow the harness, not the ticket: `Chat` aggregate, `ChatMessage` internal entity, `chats` + `chat_messages` collections, `chatId` field, URL `/chat/:chatId`. Same precedent as GR-002. The ticket itself will be updated to match.
- **Library binding.** v1 has one Default library per user (auto-provisioned by `LibraryService.ensureDefaultLibrary`). `ChatService.createChat(userId)` calls `LibraryService.ensureDefaultLibrary` and binds the new chat to that library's id. No user-facing library picker today.
- **Cross-context dependency.** `ChatService` depends on `LibraryService` (extended with `getArtifactById(userId, artifactId)`) — **not** on `LibraryRepo` directly. This honours `harness/knowledge/repo-architecture/dependency-rules.md` (Common Scenarios: "depend on the other context's application service") and centralises tenancy enforcement in `LibraryService`. This is a deliberate divergence from the wording in `harness/knowledge/domain/chat/data-model.md`; the harness doc will be updated in the same PR.
- **System priming message.** The "I have loaded the selected documents…" greeting visible at the top of every fresh chat is persisted as a `system` `ChatMessage` at chat creation (sequence 1). This exercises the `MessageRole = system` enum value end-to-end, removes a special case from the UI, and is automatically resumed by GR-004's history.
- **Mock-response engine.** Behind a gateway port `application/chat/chat-response.gateway.ts` (`ChatResponseGateway.generateReply(...)`), implemented by `infrastructure/gateways/chat/canned-chat-response.adapter.ts`. Keyword switch over the user prompt (`summary`, `compare`, `definition`, default fallback) returning a templated body with placeholder substitution for the cited document title. Empty-library short-circuits to the canned "library is empty — head to /library" reply with zero citations.
- **Active-document subset.** Stored client-side per session and passed in each `POST .../messages` request body as `activeArtifactIds: string[]`. No data-model change. The canned engine restricts citation candidates to that subset when non-empty; otherwise picks from the chat's full library.
- **Streaming.** Single-shot JSON response from `POST /api/chat/chats/:chatId/messages` returning `{ userMessage, assistantMessage }`. The frontend renders the user bubble optimistically, awaits the response, then renders the assistant bubble with a small artificial delay (≈400 ms) for feel. The API shape lets us add Server-Sent Events later by replacing only the assistant-message branch — no controller, persistence, or request changes.
- **Routes.** `/chat` is a thin loader that auto-creates a fresh chat via `ChatController.createChat` and `redirect`s to `/chat/:chatId`. `/chat/:chatId` is the real page (loader fetches chat + messages + library + artifacts in parallel). This satisfies AC#2 ("clicking Chat in the sidebar lands the user on a freshly created session") and gives GR-004's history view trivial deep links.
- **App-shell extraction.** `Sidebar` + `TopAppBar` are promoted from `ui.client/components/domain/library/` to `ui.client/components/layout/AppShell/` (per `add-ui-component.md`'s layout category). Active item is derived from `useLocation`. The library page swaps its two imports.

### 2. New files (creation)

#### Domain (`app/backend.server/domain/chat/`)
- `chat.ts` — `Chat` entity + Zod schema. Fields: `id`, `userId`, `libraryId`, `title`, `isActive`, `createdAt`, `updatedAt`, `lastMessageAt?`. `ChatTitle` enforced inline as `z.string().trim().min(1)`.
- `chat-message.ts` — `ChatMessage` entity + Zod schema with embedded `MessageBody` and `Citation` schemas, plus `MessageRole` and message-format enums. Cross-field invariant via `.superRefine`: `citations` may be non-empty only when `role === "assistant"`; empty for `user` and `system`. `body.text` non-empty after trim.
- `chat.repo.ts` — `ChatRepo` port. Chat-level: `getById(userId, chatId)`, `listForUser(userId, { isActive?, libraryId? })`, `save(chat)`, `rename(userId, chatId, newTitle)`, `archive(userId, chatId)`. Message-level (all `userId`-scoped via parent chat): `appendMessage(userId, chatId, messageInput)` (server-allocates `sequence`; updates parent `lastMessageAt`/`updatedAt`), `listMessagesForChat(userId, chatId, { fromSequence?, limit? })`, `getMessageBySequence(userId, chatId, sequence)`. **No method names betray Mongo.** All message methods delegate tenant verification to a private `_getChatForUser(userId, chatId)` per the data-model.md tenancy rule.
- `chat-response.gateway.ts` — `ChatResponseGateway` port (lives in `domain/` because it expresses a domain capability — generating a reply for a chat — even though its only adapter today is canned). Single method:
  ```ts
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult>;
  ```
  where `GenerateReplyInput = { chat: Chat, transcript: ChatMessage[], userPrompt: string, candidateArtifacts: ArtifactDto[] }` and `GenerateReplyResult = { body: MessageBody, citations: CitationDraft[] }`. (`CitationDraft` is the gateway-output shape — `{ artifactId, pageNumber, excerpt? }`; the application service stamps `libraryId` from the parent chat.) Returning a draft (not a `ChatMessage`) keeps the gateway free of `id`/`sequence`/`createdAt` allocation.

#### Application (`app/backend.server/application/chat/`)
- `chat.service.ts` — `ChatService` orchestrating the use cases:
  - `createChat(userId)` — calls `libraryService.ensureDefaultLibrary(userId)`, creates the `Chat` (title `"New chat"`), persists it, then immediately appends the system greeting message (sequence 1) and returns the freshly-created `ChatDto` together with its messages.
  - `getChat(userId, chatId)` — fetches chat + ordered messages; returns `ChatWithMessagesDto`.
  - `appendUserMessage({ userId, chatId, text, activeArtifactIds })` — persists the user `ChatMessage`, resolves the candidate artifact set (subset filter or full library), invokes the gateway, validates each citation's `pageNumber` lies within the artifact's `pageCount`, persists the assistant `ChatMessage`, returns `{ userMessage, assistantMessage }`.
  - `listChatsForUser(userId)` — newest-first by `lastMessageAt` (forward-compat for GR-004; called by no UI in this ticket but added for symmetry).
- `chat.dto.ts` — `ChatDto`, `ChatMessageDto` (with embedded `MessageBodyDto` + `CitationDto`), `ChatWithMessagesDto`, `AppendMessageRequest`, `AppendMessageResponse`. Plain mappers `toChatDto`, `toMessageDto`. Domain entities never cross the application boundary.
- `errors.ts` — `ChatNotFoundError`, `MessageBodyEmptyError`, `EmptyLibraryWarning` *(soft — used to flag the empty-library canned path; not an HTTP error)*, `CitationOutOfRangeError`, `LibraryAccessDeniedError`. Stable codes for the controller error map.
- `config.ts` — `ChatConfig`: `defaultChatTitle` (`"New chat"`), `systemGreetingTemplate` (the canned greeting body with `{libraryName}` and `{firstArtifactTitle?}` placeholders), `messageMaxBodyChars` (default 4000). `fromEnv` reads no env vars today; created for symmetry with `LibraryConfig`.

#### Application (`app/backend.server/application/library/`) — extension only
- `library.service.ts` — add `getArtifactById(userId, artifactId): Promise<ArtifactDto | null>` (delegates to `libraryRepo.getArtifactById` after `ensureDefaultLibrary` resolves the user's library). Used by `ChatService` for citation page-range validation.

#### Infrastructure / Gateways (`app/backend.server/infrastructure/gateways/chat/`)
- `canned-chat-response.adapter.ts` — `CannedChatResponseAdapter implements ChatResponseGateway`. Stateless. Lower-cases the user prompt, walks a small ordered ruleset (`/summar/`, `/compare|differ/`, `/define|definition|what is/`, default), builds the `body.text` from a template, picks 0–3 candidate artifacts deterministically (round-robin keyed on `chat.id` + message sequence so re-renders are stable), generates `CitationDraft`s with `pageNumber: 1` and a templated excerpt (`"Excerpt from page 1 of {title}"`). On empty candidate set → returns the canned "library is empty" body with zero citations. Pure module — no I/O, no clock.

#### Infrastructure / Repositories (`app/backend.server/infrastructure/repositories/chat/`)
- `chat-mongo.model.ts` — Typegoose `ChatMongoModel implements Chat`. Indexes per `data-model.md`: `id` unique, `userId`, `(userId, isActive, lastMessageAt)` compound non-unique with `lastMessageAt: -1`, `libraryId`.
- `chat-message-mongo.model.ts` — Typegoose `ChatMessageMongoModel implements ChatMessage` with embedded `MessageBodyMongo` subdoc and `CitationMongo` subdoc array. Indexes: `id` unique, `(chatId, sequence)` compound unique (the safety net for sequence allocation).
- `chat-mongo.repo.ts` — `ChatMongoRepo extends Repository<ChatMongoDocument, Chat> implements ChatRepo`. Owns both collections; the only place that knows `chat_messages` exists. Sequence allocation per `data-model.md` §"Sequence allocation": resolve parent chat under tenant → read max `sequence` for `chatId` → insert with `sequence = max + 1` → on `code: 11000` retry. Append updates `chats.lastMessageAt` and `chats.updatedAt` in a follow-up `updateOne` (single-process consistency is sufficient for v1; the unique index is the actual safety net).

#### Infrastructure / API (`app/backend.server/infrastructure/api/chat/`)
- `chat.controller.ts` — `ChatController`. Methods (each ≤ 15 lines):
  - `createChat(request)` → `{ status: 201, body: { chat, messages } }`.
  - `getChat(request, chatId)` → `{ status: 200, body: { chat, messages } }` or 404.
  - `appendMessage(request, chatId)` — parses JSON body via `AppendMessageRequestSchema`, delegates to `ChatService.appendUserMessage`, returns `{ status: 201, body: { userMessage, assistantMessage } }`. Maps `ChatNotFoundError` → 404, `MessageBodyEmptyError` → 400, `CitationOutOfRangeError` → 422.
- (Re-uses `LoginController.enforceAuth` per the GR-002 controller pattern.)

#### Composition root (`app/backend.server/main/`)
- `run-config.ts` — extend `AppConfig` with `chat: ChatConfig`.
- `application.instances.ts` — instantiate `ChatMongoRepo`, `cannedChatResponseAdapter` (singleton), `ChatService(chatRepo, libraryService, cannedChatResponseAdapter, chatConfig, () => new Date())`.
- `controller.instances.ts` — export `chatController = new ChatController(app.chatService, loginController)`.

#### Routes (`app/routes/`)
- `pages/chat.tsx` — loader-only. Calls `chatController.createChat(request)`, `throw redirect("/chat/${chat.id}")`. No component (loader always redirects). `meta` provides title.
- `pages/chat.$chatId.tsx` — loader fetches `chatController.getChat(request, params.chatId)` plus `libraryController.getInitialState(request)` in parallel via `Promise.all` (the latter returns the user's library + full artifact list for the source-documents panel and modal). Component renders `<ChatView ... />`.
- `api/api.chat.chats.ts` — `action` POST → `chatController.createChat`.
- `api/api.chat.chats.$chatId.ts` — `loader` GET → `chatController.getChat`.
- `api/api.chat.chats.$chatId.messages.ts` — `action` POST → `chatController.appendMessage`.
- `api/api.chat.chats._sdk.ts` — `callCreateChatApi()`, `callGetChatApi(chatId)`, `callAppendMessageApi(chatId, { text, activeArtifactIds })`. All Zod-validate the response.

#### UI (`app/ui.client/components/layout/AppShell/`) — promoted from library
- `Sidebar/index.tsx` + `Sidebar/types.ts` — derives active item from `useLocation()`; "Library" / "Chat" / "History" each become an `aria-current="page"` when their pathname matches. History remains `aria-disabled` until GR-004.
- `TopAppBar/index.tsx` + `TopAppBar/types.ts` — accepts `user` + `onSignOut`.

#### UI (`app/ui.client/components/domain/chat/`)
- `ChatView/index.tsx` + `types.ts` — page composition: `<Sidebar />` + `<TopAppBar />` + main `<section>` (centered `max-w-3xl` conversation column + `<ChatComposer />` at bottom) + `<aside>` (320px `<SourceDocumentsPanel />`, `lg+` only).
- `ChatMessages/index.tsx` + `types.ts` — renders the ordered `ChatMessageDto[]`; delegates per-message rendering to `<ChatBubble />`.
- `ChatBubble/index.tsx` + `types.ts` — branches on `role` (system / user / assistant). User bubble right-aligned `bg-primary text-on-primary rounded-3xl rounded-tr-sm`; assistant + system bubbles left-aligned `bg-surface-container-lowest border-outline-variant/20 rounded-3xl rounded-tl-sm`. Renders markdown body via a tiny safe markdown renderer (only paragraphs, lists, bold — no HTML pass-through). Renders `<CitationChip />` array under assistant bubbles.
- `CitationChip/index.tsx` + `types.ts` — clickable chip displaying `{ARTIFACT_TITLE} - PG {pageNumber}` with `find_in_page` icon. `onClick(artifactId)` calls back into the parent for source-panel highlight + scroll.
- `ChatComposer/index.tsx` + `types.ts` — autosizing `<textarea>` (max ≈5 lines via `rows` + `max-h-32`), `attach_file` icon (visually present, `disabled` per ticket scope), `send` button (disabled while `isSending` or empty body). `onSubmit(text)` callback. Helper text "Scholastic AI can make mistakes. Verify important information." rendered below.
- `SourceDocumentsPanel/index.tsx` + `types.ts` — renders the union of artifacts referenced by any message in this chat (highlighted as "Active Document") plus all other artifacts in the library (muted "In Library"). Receives `activeArtifactId?` from parent for the highlight scroll behaviour. Includes the "Include more documents" button → opens `<IncludeDocumentsModal />`.
- `IncludeDocumentsModal/index.tsx` + `types.ts` — multi-select list of every artifact in the library; on confirm, calls back with `activeArtifactIds: string[]`. Stateless; parent owns the selection.
- `hooks/use-send-message.ts` — wraps `callAppendMessageApi`, manages `isSending`, applies the optimistic user-bubble + the artificial 400 ms reveal for the assistant bubble, surfaces send errors.
- `hooks/use-active-artifact-ids.ts` — `useState<string[]>([])` plus a `setSelected(ids)` setter; consumed by `<ChatView />` and passed into both `<SourceDocumentsPanel />` and `use-send-message`.
- `hooks/use-composer.ts` — handles textarea autosize, Shift+Enter newline, Enter submit, in-flight disable.

#### Tests (`tests/backend.server/`)
- `application/chat/chat.service.test.ts` — vitest, in-memory `ChatRepo`, stub `ChatResponseGateway`, stub `LibraryService`, fixed clock. One test per acceptance criterion (see §4).
- `application/shared/in-memory-chat-repo.ts` — implements `ChatRepo` over two `Map`s (chats by id, messages keyed by `(chatId, sequence)`); seed + inspection helpers (`messagesFor(chatId)`); deterministic sequence allocation; throws `code: 11000` on `(chatId, sequence)` collision to mirror the Mongo unique index.
- `application/shared/stub-chat-response-gateway.ts` — `recordedInputs[]` plus `enqueueReply(reply)`; deterministic, no canned-engine logic in the unit tests.
- `application/shared/stub-library-service.ts` — minimal `LibraryService` shape with `ensureDefaultLibrary` and `getArtifactById` returning seeded values.

### 3. Modifications (existing files)

- `app/backend.server/application/library/library.service.ts` — add `getArtifactById(userId, artifactId)` (and matching `LibraryRepo.getArtifactById` if not already public; it already exists internally as `getArtifactById(userId, libraryId, artifactId)` — the new service method calls `ensureDefaultLibrary` first to resolve `libraryId`).
- `app/backend.server/main/{run-config.ts,application.instances.ts,controller.instances.ts}` — wire chat context.
- `app/ui.client/components/domain/library/{Sidebar.tsx,TopAppBar.tsx}` — **moved** to `app/ui.client/components/layout/AppShell/{Sidebar,TopAppBar}/index.tsx`. The original files are deleted.
- `app/ui.client/components/domain/library/LibraryView.tsx` — swap two imports to the new `@components/layout/AppShell/...` paths.
- `app/routes/pages/library.tsx` — no change (it imports `<LibraryView />`, which now imports the moved components).
- `app/routes.ts` — no change (`flatRoutes` discovers the new files automatically).
- `harness/knowledge/domain/chat/data-model.md` — short note in the "Tenancy Rule / Cross-context tenant guard at chat creation" paragraph: the chat application service depends on `LibraryService` (not `LibraryRepo`) per `dependency-rules.md`.
- `jira-tickets/todo/gr_003_chat_with_library.md` — replace `chat_sessions` → `chats`, `chat_messages` field references (`session_id` → `chatId`, snake_case → camelCase), `POST /api/chat/sessions*` → `POST /api/chat/chats*`, "chat_response_provider interface" → "ChatResponseGateway port"; user-visible AC text untouched. Move to `jira-tickets/in-review/` only at PR time.
- `package.json` — no new dependencies. (We already have `zod`, `uuid`, `@typegoose/typegoose`, `mongoose`. The tiny markdown renderer can be the pure-JS `marked`/`micromark`, but for v1 we render with a hand-rolled paragraph + list + bold tokeniser — ~30 lines, zero dependencies, and it matches the constrained markdown output of the canned engine.)

### 4. Acceptance criteria → tests

| Ticket AC | Test type | Test |
|---|---|---|
| 1. Visual fidelity | Manual / future Playwright | Out of scope for vitest; capture screenshot in PR. |
| 2. New session on entry | Application unit test | `createChat(userId) creates a chat with libraryId = user's default library and a system greeting message at sequence 1`. |
| 3. Send message | Application unit test | `appendUserMessage persists user message at next sequence and returns assistant message from gateway`. |
| 4. Citations | Application unit test | `assistant message carries citations stamped with the chat's libraryId; user/system messages carry zero citations`. |
| 5. Source panel sync | Manual (UI-only) | Click chip → component scrolls + highlights; covered in PR walkthrough. |
| 6. Empty library fallback | Application unit test | `when libraryService returns no artifacts, gateway is invoked with candidateArtifacts=[] and the assistant message body matches the canned empty-library text`. |
| 7. Persistence | Application unit test | `getChat returns the same messages just appended, in sequence order; lastMessageAt + updatedAt advanced on append`. |
| 8. Authorisation | Application unit test | `user A cannot getChat / appendMessage on user B's chat (ChatNotFoundError)`. Loader-level `enforceAuth` already covered by GR-001. |
| 9. Composer ergonomics | Manual / hook unit test (optional) | `use-composer` keystroke handling can be covered with a small jsdom test if we add Testing Library; otherwise PR walkthrough. |

### 5. Implementation order (TDD-friendly)

1. Promote `Sidebar` + `TopAppBar` to `layout/AppShell/` (small refactor; verify Library still renders).
2. Add domain (`chat.ts`, `chat-message.ts`, `chat.repo.ts`, `chat-response.gateway.ts`) — typecheck only.
3. Add `chat.dto.ts`, `errors.ts`, `config.ts` and `chat.service.ts` red→green against in-memory `ChatRepo` + stubs. Cover ACs 2/3/4/6/7/8 here.
4. Implement `CannedChatResponseAdapter`. Tiny unit test on the keyword-routing function (pure module; happy paths + empty-library path).
5. Add Typegoose models + `ChatMongoRepo`. No integration test (matches GR-002 precedent).
6. Add `ChatController` + JSON request-schema validation. Wire composition root.
7. Add API routes + `_sdk`.
8. Add page routes (`/chat` redirect + `/chat/:chatId`).
9. Build chat UI components and hooks; wire `useFetcher`-or-`callAppendMessageApi` send loop; client-side optimistic user bubble + 400 ms reveal.
10. Manual smoke against `designs/chat_elegant_minimal_variant/screen.png` + npm run typecheck + npm run test.

### 6. Risks & open assumptions

- **Sequence allocation race.** Two near-simultaneous `appendUserMessage` calls on the same chat could compute the same `sequence`. Mitigation: `(chatId, sequence)` unique index is the safety net; the adapter retries on `code: 11000` (per `data-model.md`). For a single-user, single-tab v1 this race is essentially impossible — the assistant reply is awaited before the composer re-enables — but the adapter implements the retry so we never have to revisit.
- **Citation page validity.** Canned responses always pick `pageNumber: 1`, which is always valid for any artifact with `pageCount ≥ 1`. The application service nevertheless validates each citation's `pageNumber` against the resolved artifact's `pageCount` (defence in depth + future-proof for a real RAG).
- **Cross-context: extending `LibraryService` instead of using `LibraryRepo`.** Adding `getArtifactById` to the library service is a small API addition but the right one — it preserves the dependency-rules invariant and lets us mock `LibraryService` instead of `LibraryRepo` in chat tests. The library tests are unaffected (the existing library acceptance criteria don't exercise this method; the chat tests do).
- **Re-using the artifact list for the source panel + modal.** The `/chat/:chatId` loader fetches the user's full artifact list once; both the panel and the modal read from the same loader data. The panel computes "referenced" via the union of `citations[].artifactId` across the chat's messages.
- **Markdown rendering safety.** The canned engine emits a constrained subset (paragraphs + bullet lists + bold). Our hand-rolled tokeniser emits only `<p>`, `<ul>`, `<li>`, `<strong>` and HTML-escapes all other content — no `dangerouslySetInnerHTML` of arbitrary input. If we later swap to a real LLM, we revisit and pull in `react-markdown` (or equivalent) at that point.
- **Auto-create on `/chat` entry has a side effect on a GET.** Strictly a `loader` should be side-effect-free; we're knowingly violating that for UX (`createChat` is idempotent-enough — it makes one new chat per visit). Acceptable for v1; if this proves noisy in GR-004's history, we can switch to a `<Form method="post" reloadDocument>` on the sidebar link.

### 7. Self-critique (per `harness/skills/planning/critique-coding-plan.md`)

#### Gaps & blind spots
**Issue:** The plan persists a `system` greeting at chat creation, but if the canned `systemGreetingTemplate` changes between deploys, old chats keep the old greeting and new chats render a new one — a subtle inconsistency in the History view. **Suggestion:** Acceptable for v1 (it's literally the desired audit trail — "this is what we said at the time"), but call it out explicitly in `conversation-summaries.md` so future-me does not "fix" it by rewriting historical messages. Add a short comment on `ChatService.createChat` explaining the intent.

#### Robustness
**Issue:** `appendUserMessage` validates each gateway citation's `pageNumber` against the artifact's `pageCount`, but the plan does not say what happens on failure. If the canned engine ever returns an out-of-range citation, the whole `appendMessage` call fails after the user message is already persisted, and the user sees an error toast with their bubble alone in the transcript. **Suggestion:** On `CitationOutOfRangeError`, drop the offending citation and persist the assistant message without it (log the dropped citation server-side). The user always gets a reply; only the bad chip is suppressed. Citation validation is defensive, not gating.

#### Simplicity
**Issue:** The plan introduces three small UI hooks (`use-send-message`, `use-active-artifact-ids`, `use-composer`); two of them are state-setter wrappers that don't need to be hooks. **Suggestion:** Inline `use-active-artifact-ids` into `<ChatView />` (it's a single `useState<string[]>([])`). Keep `use-send-message` (it owns the network + delay + error toast) and `use-composer` (it owns DOM-coupled keyboard logic).

#### Testability
**Issue:** `ChatService` ends up with four constructor dependencies (`chatRepo`, `libraryService`, `responseGateway`, `config`, `clock`) — five if you count the clock. Stubbing all of them makes per-test setup verbose. **Suggestion:** Provide a `tests/backend.server/application/chat/build-chat-service.ts` test factory that wires sane defaults (in-memory repo, no-op gateway, single-artifact library, fixed clock) and lets each test override only what it cares about. Same pattern the GR-002 tests can adopt later.

#### Consistency
**Issue:** `ChatResponseGateway` is placed in `domain/chat/` but the dependency-rules `.gateway.ts` table says gateway ports default to `application/<context>/`. **Suggestion:** Move it to `application/chat/chat-response.gateway.ts`. The "domain port" carve-out is reserved for ports that are part of the ubiquitous language (e.g. a `pdf-storage.gateway.ts` could go either way). "Generate a reply" is an application-layer use-case capability, not a domain concept. Keeping it in `application/` matches `LibraryRepo`'s split (the repo port is in `domain/` because `LibraryRepo` is part of the ubiquitous library language; a reply-generation gateway is not part of the chat ubiquitous language).

#### Maintainability
**Issue:** Two of the new `routes/api/api.chat.chats.*.ts` files are one-method action thunks. The `chat.controller.ts` has three methods of nearly identical shape (parse → delegate → map error). **Suggestion:** Mirror the GR-002 controller pattern verbatim (`{ status, body }` return shape + a `mapServiceError` function in the same file). No premature abstraction; copy-paste of three 8-line route files is fine.

#### Design principles
**Issue:** The plan assumes the loader at `/chat` calls `createChat` on every navigation, producing a fresh chat per visit. This is technically a side-effect-in-a-GET violation and could spawn dozens of empty chats if the user clicks the sidebar link repeatedly. **Suggestion:** Acknowledge in v1; mitigate by having the sidebar Chat link **not** point to `/chat` at all when the user already has an active chat in this tab — the `<Sidebar />` component receives an optional `currentChatId?` prop and links to `/chat/${currentChatId}` when present. Fresh chat is created only when the user clicks "New chat" (not in v1) or visits `/chat` directly.

### 8. Triage decisions

- Accept all critique points (Gaps, Robustness, Simplicity, Testability, Consistency, Design principles, Maintainability).
- Fold into the plan during execution:
  - Move `chat-response.gateway.ts` from `domain/chat/` to `application/chat/`.
  - Drop bad citations rather than failing `appendMessage`.
  - Inline `use-active-artifact-ids` into `<ChatView />`.
  - Add the `<Sidebar />` `currentChatId?` prop and route to `/chat/${currentChatId}` when known.
  - Add `tests/.../build-chat-service.ts` factory.
  - Inline comment on `ChatService.createChat` explaining "system greeting is intentionally a snapshot, not re-derived".

### 9. Out of plan / explicitly deferred

- Real LLM, embeddings, retrieval, RAG.
- Server-Sent Events / token-by-token streaming (API shape allows future addition).
- Multi-library chat / library picker.
- Chat rename / archive / delete UI.
- "Regenerate" affordance on assistant messages.
- File attachments inside chat (paperclip is rendered but inert).
- Multi-tab / multi-user concurrency on a single chat (v1 assumes one user, one tab).
- `Chat.activeArtifactIds` persistence (v1 stores the active subset client-side).
- History view (GR-004).

### 10. Workflow next steps after approval

Per `harness/dev-workflow/001_plan.md` Step 9: branch (`feature/gr-003-chat-with-library`), commit `plan.md` + `conversation-summaries.md` to `harness/exec-plans/002-gr_003-chat-with-library/`, push, open a **draft** PR labelled `plan` with `marduSwanepoel` as reviewer (per the user-level `create-develop-pr` skill).
