# GR-003 — Chat With the Library — Planning Summary

## Key decisions (made during the planning conversation)

### 1. Naming: follow the harness, not the ticket
The ticket originally describes `chat_sessions`, `session_id`, and `POST /api/chat/sessions/:id/messages`. The harness ubiquitous language (`harness/knowledge/domain/chat/{language,domain-model,data-model}.md`) consistently uses `Chat`, `chatId`, and `chats` / `chat_messages` collections. We chose to follow the harness — same precedent set during GR-002, where the ticket was rewritten to match the harness model. The ticket file itself (`jira-tickets/todo/gr_003_chat_with_library.md`) will be updated in the same PR; the user-visible AC text stays untouched.

### 2. Library binding: auto-bind to the user's Default library
The `Chat` aggregate's `libraryId` is set at creation and immutable. In v1 every user has exactly one auto-provisioned "My Library" (per GR-002's `LibraryService.ensureDefaultLibrary`). `ChatService.createChat(userId)` calls `ensureDefaultLibrary` and binds the new chat to it. There is no user-facing library picker — that's the future multi-library ticket. The data model is already correct for the multi-library future, so today's binding has zero migration cost.

### 3. Cross-context dependency: ChatService → LibraryService (not LibraryRepo)
There is a documented tension in the harness:
- `harness/knowledge/repo-architecture/dependency-rules.md` (Common Scenarios) says: *"I need an application service to call another context's logic → Depend on the other context's application service. Never reach into another context's repository or gateway."*
- `harness/knowledge/domain/chat/data-model.md` says the chat application service should take `LibraryRepo` directly.

We chose to honour `dependency-rules.md`: `ChatService` depends on `LibraryService`, which we extend with a single new read-only method `getArtifactById(userId, artifactId)`. Benefits:
- Tenancy enforcement stays centralised in `LibraryService`.
- Chat unit tests stub `LibraryService` (one mock) instead of `LibraryRepo` (six methods).
- The "extend the other context's app service when you need a new use case" pattern is the maintainable path forward.

The harness `data-model.md` for chat will be updated in the same PR to reflect this resolution.

### 4. System priming message: persist as a `system` ChatMessage
The chat design shows an "I have loaded the selected documents…" greeting at the top of every fresh chat. The harness defines `MessageRole = system` for exactly this. We persist the greeting as a `system` `ChatMessage` at chat creation (sequence 1). Trade-offs:
- ✅ Resumable from history (GR-004) without special-casing.
- ✅ Exercises the `system` enum value end-to-end.
- ✅ One fewer client-side branch.
- ⚠️ The greeting is a snapshot of the template at write-time; if we later change the template, old chats keep the old text. This is the desired behaviour (faithful audit), not a bug. A code comment on `ChatService.createChat` will spell this out.

### 5. Mock-response engine: behind a `ChatResponseGateway` port
The canned response logic is hidden behind a gateway port `application/chat/chat-response.gateway.ts` and implemented by `infrastructure/gateways/chat/canned-chat-response.adapter.ts`. The "swap test" (`harness/knowledge/repo-architecture/dependency-rules.md`) is unambiguous: replacing the canned engine with a real LLM/RAG would ripple through the whole chat domain, so the boundary belongs at a port. The LLM/RAG upgrade is a single-line change in `application.instances.ts`.

The engine itself is a tiny templated bank: keyword switch over the lower-cased prompt (`/summar/`, `/compare|differ/`, `/define|definition|what is/`, default fallback) with placeholder substitution for the cited document title. Empty-library short-circuits to the canned "your library is empty — head to /library" reply with zero citations.

The gateway returns *citation drafts* (`{ artifactId, pageNumber, excerpt? }`); the application service stamps `libraryId` from the parent chat. This keeps the gateway free of `id`/`sequence`/`createdAt`/`libraryId` allocation.

**Self-critique resolution:** The plan originally placed the gateway port at `domain/chat/`. The critique pointed out the gateway-default per the file-naming table is `application/<context>/`, and "generate a reply" is an application-layer use case (not a domain concept). Final placement: `application/chat/chat-response.gateway.ts`.

### 6. Active-document subset: client-side, per-request
The "Include more documents" modal needs somewhere to store the user's selection. We considered (a) adding `Chat.activeArtifactIds: string[]` to the aggregate, vs (b) keeping it client-side and passing `activeArtifactIds` in each `POST .../messages` request. We chose (b):
- It's a runtime control, not a domain invariant.
- No data-model change.
- If we later decide it must persist across reloads, we add the field to `Chat`.

The canned engine restricts citation candidates to the supplied subset when non-empty; otherwise picks from the chat's full library.

### 7. Streaming: deferred, but API shape allows it
The ticket explicitly accepts a single delayed reveal in v1 ("e.g. 400 ms") and asks for an API that supports streaming later. We chose the simplest shape: `POST /api/chat/chats/:chatId/messages` returns `{ userMessage, assistantMessage }` as a single JSON payload. The frontend renders the user bubble optimistically, awaits, then renders the assistant bubble after a 400 ms artificial delay. Streaming becomes a future change to the response branch only — the controller, persistence, and request shape stay identical.

### 8. Routes: `/chat` redirects, `/chat/:chatId` is the real page
- `/chat` — page-route loader that calls `chatController.createChat` and `redirect`s to `/chat/:chatId`. Satisfies AC#2 ("clicking Chat in the sidebar lands the user on a freshly created session").
- `/chat/:chatId` — the actual page. Loader fetches chat + messages + library + artifacts in parallel.

**Self-critique resolution:** Auto-creating a chat in a GET loader is technically a side-effect-in-a-GET violation. To prevent the user spawning many empty chats by repeatedly clicking the sidebar link, the `<Sidebar />` component receives an optional `currentChatId?` prop and links to `/chat/${currentChatId}` when present. A fresh chat is created only on direct visits to `/chat`. (A "New chat" affordance is out of scope for v1.)

### 9. App-shell extraction: Sidebar + TopAppBar promoted to `layout/AppShell/`
The library page's `Sidebar` and `TopAppBar` live under `domain/library/`. The chat page needs the same shell. Per `add-ui-component.md`, `layout/` is the right home ("layout: app shell structure — sidebar, navigation"). We move both components, parameterise active item via `useLocation`, and have the library page swap two imports. Small refactor, paid back on this very ticket and again on GR-004.

### 10. Self-critique acceptances (Step 7 of `001_plan.md`)
The drafted plan was self-critiqued per `harness/skills/planning/critique-coding-plan.md`. All seven critique points were accepted and folded into the plan:
- Move `ChatResponseGateway` from `domain/chat/` to `application/chat/`.
- Drop out-of-range citations (log them) rather than failing `appendMessage`.
- Inline `use-active-artifact-ids` into `<ChatView />` (it's a single `useState`).
- Add `<Sidebar />` `currentChatId?` prop to avoid spawning chats on repeated sidebar clicks.
- Add a `tests/.../build-chat-service.ts` factory to keep per-test setup short.
- Inline comment on `ChatService.createChat` explaining "system greeting is intentionally a snapshot".
- Keep three near-identical route files (no premature abstraction); mirror the GR-002 controller pattern verbatim.

## Things deliberately NOT done

- **No real LLM, embeddings, or RAG pipeline.** This is the entire point of GR-003 — the canned engine ships behind a port so the LLM/RAG ticket is a one-line composition-root change.
- **No SSE / token-by-token streaming.** Single-shot JSON response with a frontend reveal delay; API shape preserves the streaming upgrade path.
- **No `Chat.activeArtifactIds` field.** Active subset is client-side per request.
- **No multi-library chat.** v1 binds to the user's Default library at creation.
- **No regenerate / edit / delete affordances.** Append-only transcript per the harness.
- **No real markdown library.** The canned engine emits a constrained subset (paragraphs + bullet lists + bold). A hand-rolled ~30-line tokeniser is enough; we revisit when a real LLM lands.
- **No repository integration tests against real Mongo.** Same precedent as GR-002 (see its `conversation-summaries.md` §"Things deliberately NOT done"). The in-memory `ChatRepo` mirrors the unique-index semantics (`code: 11000` on `(chatId, sequence)` collision).
- **No controller integration tests.** Same precedent — JSON parsing through React Router 7 actions is exercised manually via the live route during development.

## Open question deferrals (from the ticket)

- *"How fancy should the canned-response engine be?"* → Tiny templated bank with placeholder substitution for real document titles. Documented in §2 of the plan and §5 above.
- *"Do we expose a 'regenerate' affordance now?"* → No. MVP is send-only; transcript is append-only per the harness.
- *"Should the AI greeting reference the user's most-recent uploaded document by name?"* → Yes — the `systemGreetingTemplate` includes `{firstArtifactTitle?}` placeholder. If the library is empty the placeholder degrades gracefully.

## Workflow next steps after approval

Per `harness/dev-workflow/001_plan.md` Step 9:
1. Create branch `feature/gr-003-chat-with-library`.
2. Commit `plan.md` + `conversation-summaries.md` under `harness/exec-plans/002-gr_003-chat-with-library/`.
3. Push.
4. Open a **draft** PR labelled `plan` with `marduSwanepoel` as reviewer (per the user-level `create-develop-pr` skill).
