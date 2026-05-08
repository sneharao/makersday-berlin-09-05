# GR-004 — Chat history: browse and resume past conversations

- **Type:** Story
- **Epic:** Scholastic AI — Foundations
- **Priority:** P1 (depends on GR-003 producing real sessions)
- **Status:** To Do
- **Estimate:** S/M

## Problem & why now

Researchers don't have one-shot conversations — they come back to the same line of inquiry across days. Without a history view, every reload of `/chat` feels like starting over and the prior context is lost. Adding history turns the tool from a toy into something users can actually rely on for ongoing research.

## User story

> **As a** signed-in researcher,
> **I want** to see all my past chat sessions and click into any of them to resume,
> **so that** I can pick up a line of research without losing the prior conversation or its sources.

## Outcome we want

A user clicks **History** in the sidebar, sees every prior chat as a card with a date, a title, and a snippet from the conversation, clicks one, and lands inside `/chat/:session_id` with the full message thread and the same Source Documents panel they had before.

## In scope

- Authenticated route `/history` matching `designs/chat_history_scholastic_ai/screen.png`:
  - Left sidebar (History active).
  - Top app bar with knowledge-base search input (search itself is **out of scope**; render disabled or non-functional).
  - Page header "History" + subtext "Review and resume your past research conversations.".
  - Filter dropdown: All Documents / Recent (30 Days) / Archived.
  - Bento grid of history cards: date label, conversation title, italicised snippet (~2 lines from the most recent meaningful message), "Resume Chat" button.
  - Empty state when the user has no sessions yet (illustration + CTA "Start your first chat" → `/chat`).
- Backend endpoints:
  - `GET /api/chat/sessions` — lists the current user's sessions, newest first, with `session_id`, `title`, `last_message_preview`, `created_at`, `updated_at`, `archived` flag. Supports `?filter=all|recent|archived`.
  - `PATCH /api/chat/sessions/:id` — rename a session and/or toggle `archived` (drives the filter).
- Frontend behaviours:
  - Cards show the session's auto-generated title (first ~6 words of the first user message, falling back to "Untitled chat").
  - Snippet shows the last AI or user message, truncated with `line-clamp-3`, italicised per the design.
  - "Resume Chat" navigates to `/chat/:session_id`, which (per GR-003) loads the full message thread and source documents.
  - Filter dropdown re-queries the API; "Recent (30 Days)" filters to `updated_at > now - 30d`; "Archived" returns only archived sessions.
  - Card overflow menu (or right-click) offers "Rename" and "Archive" — minimal UI is fine.

## Out of scope

- Full-text search across conversations (input is rendered but inert).
- Hard-deletion of sessions (archiving is enough for MVP).
- Sharing or exporting conversations.
- Folder/tag organisation.
- Pagination — assume < 200 sessions per user for the MVP and load all in one request.

## Acceptance criteria

1. **Visual fidelity** — `/history` matches `designs/chat_history_scholastic_ai/screen.png` using tokens from `designs/library_intelligence_system/DESIGN.md` (display-lg "History" header, responsive bento grid 1/2/3 cols, 220px min card height, "Resume Chat" button with history icon).
2. **Lists every session** — Every session created via GR-003 appears here, ordered by `updated_at` desc.
3. **Auto-title** — A session's title is derived from the first user message (first ~6 words, ellipsised); a session with no user messages yet shows "Untitled chat".
4. **Snippet** — Each card shows a 2–3 line italic snippet pulled from the last assistant message (or last user message if none).
5. **Resume** — Clicking "Resume Chat" or the card body navigates to `/chat/:session_id` and loads the full thread and the historical Source Documents panel. The user can keep chatting from there.
6. **Filter** — Switching the filter to "Recent (30 Days)" hides sessions whose `updated_at` is older than 30 days. Switching to "Archived" shows only archived sessions; the default "All Documents" shows all non-archived sessions.
7. **Archive** — Archiving a session removes it from the default view; it appears under "Archived" and can be unarchived from there.
8. **Rename** — Renaming a session updates the title in place without a full page reload.
9. **Empty state** — A user with zero sessions sees a friendly empty state with a CTA that creates a new session and routes to `/chat`.
10. **Authorisation** — All history endpoints require an authenticated session and only ever return / mutate the current user's sessions.

## Design references

- Screen: `designs/chat_history_scholastic_ai/screen.png`
- HTML reference: `designs/chat_history_scholastic_ai/code.html`
- Design system (colors, typography, spacing, components): `designs/library_intelligence_system/DESIGN.md`
- Cross-screen overview: `designs/highlevel_design_overview.png`

## Technical notes

- Reuse the `chat_sessions` and `chat_messages` collections introduced in GR-003 — no new core schema. Add an `archived: boolean` (default false) and an optional `title` (defaults to derived value at read time) on `chat_sessions`.
- Index `(user_id, archived, updated_at desc)` to make the listing query fast under all three filters.
- Compute the snippet on the server when listing (cheaper than shipping the whole message back) — pull `last_message_preview` directly from `chat_sessions.last_message_preview`, which GR-003 keeps current on every message write.
- Keep API responses small: don't include full message arrays in the list endpoint.

## Dependencies

- **GR-001** (auth) — required.
- **GR-003** (chat sessions and messages) — required; without it there are no sessions to list.

## Open questions

- Are sessions per-user only, or do we want a notion of shared/team sessions later? (Affects whether we add a `visibility` field now.)
- Do we want soft-delete (`deleted_at`) in addition to `archived`, or is archive enough for MVP?
- Should "Resume Chat" continue the existing session in place, or fork it into a new session that references the original (better for reproducibility)?
