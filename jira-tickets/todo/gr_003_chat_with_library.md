# GR-003 — Chat with the library (hardcoded responses + source panel)

- **Type:** Story
- **Epic:** Scholastic AI — Foundations
- **Priority:** P0
- **Status:** To Do
- **Estimate:** M

## Problem & why now

The library is only valuable if users can actually *talk* to it. We don't yet have a real RAG pipeline, but we need the conversational UI in place so we can (a) demo the end-to-end vision, (b) lock in the interaction patterns (split layout, source citations, input affordances), and (c) give GR-004 (History) something real to persist.

## User story

> **As a** signed-in researcher,
> **I want** to start a chat from the sidebar, ask questions about my library, and see which source documents back up the answer,
> **so that** I can explore my materials conversationally and trust the AI's responses.

## Outcome we want

A user clicks **Chat** in the sidebar, lands on an empty conversation, types a question, sees a (canned) AI response stream in, and watches the right-hand "Source Documents" panel populate with the documents the answer is grounded in. The user knows at a glance which document each answer came from.

## In scope

- Authenticated route `/chat` matching `designs/chat_elegant_minimal_variant/screen.png`:
  - Left sidebar (Chat active).
  - Center column: scrollable conversation, AI greeting bubble, user bubbles right-aligned in `--primary`, AI bubbles left-aligned with `--outline-variant` border, citation chips under AI messages.
  - Right column: "Source Documents" panel listing documents referenced by the current conversation (active doc highlighted, others muted), plus "Include more documents" affordance.
  - Bottom composer: textarea with attach icon, send button, helper text "Scholastic AI can make mistakes…".
- Backend endpoints:
  - `POST /api/chat/sessions` — creates a new chat session for the current user, returns `session_id`.
  - `GET /api/chat/sessions/:id` — returns session metadata and ordered messages.
  - `POST /api/chat/sessions/:id/messages` — accepts a user message, persists it, then **returns a hardcoded AI response** (see "Response strategy" below) along with a list of source document references.
- A small, deterministic mock-response engine on the backend:
  - Picks the AI reply from a curated set of canned responses keyed by simple keywords (e.g. "summary", "compare", "definition", default fallback).
  - Each canned response includes 0–3 `source_document_id`s drawn from the user's actual library (GR-002), so citations always link to a real file.
  - If the user has no documents, the AI response politely points them to the Library page.
- Frontend behaviours:
  - Sending a message optimistically appends the user bubble, then streams (or just shows after a small artificial delay, e.g. 400 ms) the AI bubble.
  - Citation chips under AI bubbles are clickable and highlight the corresponding card in the Source Documents panel.
  - The Source Documents panel updates as new sources are referenced.
  - "Include more documents" opens a simple modal listing all the user's library documents (multi-select) — selected docs become eligible for citation in subsequent canned responses.

## Out of scope

- Real LLM, embeddings, retrieval, or RAG pipeline (this is the entire point — we're stubbing).
- Streaming token-by-token rendering (a single delayed reveal is fine; design the API so streaming can be added later without a frontend rewrite).
- File attachments inside chat (the paperclip is rendered but inert).
- Editing or deleting messages.
- Multiple concurrent sessions in a single tab.

## Acceptance criteria

1. **Visual fidelity** — `/chat` matches `designs/chat_elegant_minimal_variant/screen.png` using tokens from `designs/library_intelligence_system/DESIGN.md` (centered max-w-3xl conversation column, 320px right panel on `lg+`, rounded-3xl bubbles with sharpened sender corner, 8px spacing rhythm).
2. **New session on entry** — Clicking **Chat** in the sidebar lands the user on an empty, freshly created session with the AI greeting bubble visible.
3. **Send message** — Typing a question and pressing Enter (or clicking send) appends the user bubble immediately, then renders a canned AI bubble within ~1 s.
4. **Citations** — When the canned response references one or more documents, citation chips appear under the AI bubble showing each document's title, and the right-hand panel marks them as referenced (active document is highlighted, others shown as "In Library").
5. **Source panel sync** — Clicking a citation chip scrolls the right panel to and highlights the matching document card.
6. **Empty library fallback** — If the user has no documents in their library, the AI's first response is the canned "Your library is empty — head to Library to upload a PDF" message, with a link/button to `/library`.
7. **Persistence** — All user messages, AI messages, and the list of referenced `document_id`s are persisted on the session so GR-004 can resume them.
8. **Authorisation** — All chat endpoints require an authenticated session and only ever return / mutate the current user's sessions.
9. **Composer ergonomics** — Shift+Enter inserts a newline; Enter submits; the send button is disabled while a request is in flight; the textarea autosizes up to ~5 lines then scrolls.

## Design references

- Screen: `designs/chat_elegant_minimal_variant/screen.png`
- HTML reference: `designs/chat_elegant_minimal_variant/code.html`
- Design system (colors, typography, spacing, components): `designs/library_intelligence_system/DESIGN.md`
- Cross-screen overview: `designs/highlevel_design_overview.png`

## Technical notes

- MongoDB collections (snake_case):
  - `chat_sessions`: `_id`, `user_id`, `title`, `created_at`, `updated_at`, `last_message_preview`.
  - `chat_messages`: `_id`, `session_id`, `user_id`, `role` (`user` | `assistant`), `content`, `source_document_ids`, `created_at`.
- Keep the canned-response logic behind a `chat_response_provider` interface so swapping it for a real LLM/RAG pipeline is a single dependency change.
- Make `session_id` visible in the URL (`/chat/:session_id`) so deep-linking from History (GR-004) is trivial.
- The Source Documents panel reads from `documents` (GR-002) joined with the union of `source_document_ids` across the session's messages.

## Dependencies

- **GR-001** (auth) — required.
- **GR-002** (library + documents collection) — citations need real document IDs.

## Open questions

- How fancy should the canned-response engine be? Pure keyword switch, or a tiny templated bank with placeholders that get filled with real document titles?
- Do we expose a "regenerate" affordance now, or keep MVP as send-only?
- Should the AI greeting reference the user's most-recent uploaded document by name to make the demo feel personalised?
