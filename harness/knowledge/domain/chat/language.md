# Chat — Ubiquitous Language

Terms scoped to the `chat` bounded context. Use these terms exactly as defined here in code, comments, commit messages, and conversation when working in this context. Do not import these meanings into other contexts.

For terms that span all contexts (`Chat`, `chatId`), see [shared-language.md](../shared-language.md). The cross-context entry there states only what other contexts need; this file is the authoritative, full definition for everything inside `chat`.

## Conversation

### Chat

A grounded conversation between a `User` and the contents of one `Library`. An aggregate root in this context. A chat belongs to exactly one user and is grounded in exactly one library — both immutable once set. To converse against a different library, the user creates a new chat. Chats are archived (soft-delete), never hard-deleted; archived chats remain visible in the History view (the "Resume Chat" affordance shown in the design).

### ChatTitle

A field on `Chat` (a single required `ChatTitle` value object). The human-readable title shown in the chat sidebar and in the History view. Trimmed on write; non-empty after trim. Defaults to a derived placeholder at creation time (e.g. `"New chat"` or the first user message truncated); the user may rename at any time. No uniqueness constraint.

### ChatMessage

A single turn in a `Chat` conversation. **Internal entity** of the `Chat` aggregate, not an aggregate root. Loaded, mutated, and queried only through its parent chat. The chat transcript is **append-only** — once a message is added, it is never modified or removed. "Editing" a past message is modelled as a new appended message.

### `sequence` (on ChatMessage)

A field on `ChatMessage` (positive integer). The 1-based order of the message within its parent chat. Strictly monotonic, no gaps, immutable. The first message has `sequence = 1`.

## Roles and Content

### MessageRole

A field on `ChatMessage` (a single required `MessageRole` value object). The role of the speaker for this turn. **Closed enum, exactly one value, required.** Values:

- `user` — a turn authored by the human user (a prompt). Carries no `citations`.
- `assistant` — a turn authored by the AI assistant (a reply). May carry `citations`.
- `system` — a system-issued turn (e.g. the priming "I have loaded the selected documents from your library…" message shown at the top of the chat design). Carries no `citations`.

The active list is intentionally three values; code that switches on `MessageRole` must handle every value — there is no `default` fallback.

### MessageBody

A field on `ChatMessage` (a single required `MessageBody` value object). The content of the turn. Two fields:

- `format` — closed enum, exactly one value: `markdown` for v1. The field is present so a future format (e.g. `markdown_with_widgets`) can be added without restructuring the VO.
- `text` — the body content as a string in the declared `format`. Required and non-empty after trim.

The body is immutable for the lifetime of the message (consistent with the append-only transcript rule).

## Citations

### Citation

A field on `ChatMessage` (a multi-valued `Citation` value object set; cardinality is zero or more). A reference from an assistant turn to a specific page of a specific artifact in the parent chat's library. Drives the citation badge rendered under assistant messages in the chat design (e.g. "ON THE NATURE OF DIGITAL THINGS - PG 42").

Only present on `assistant` messages. Always immutable once the parent message is appended.

Four fields:

- `libraryId` — the id of the library the cited artifact lives in. Must equal the parent chat's `libraryId`. Cross-context reference into the `library` context.
- `artifactId` — the id of the cited `Artifact` within that library. Together with `libraryId` forms the only valid form of cross-context artifact reference, because `Artifact` is internal to the `Library` aggregate (see [shared-language.md#artifact](../shared-language.md#artifact)).
- `pageNumber` — the 1-based page within the artifact. Must be in the range `[1, pageCount]` of the cited artifact at the time the citation is issued; validated by the application layer at message-append time by resolving the artifact through the `library` context's repository.
- `excerpt` — optional short text snippet from the cited page. Used to render the citation badge text in the UI.

## Lifecycle

### `isActive` (on Chat)

A field on `Chat`. `true` for active chats; `false` for archived. Soft-delete flag — chats are never hard-deleted. Archived chats remain visible in the History view; only active chats appear in the live "Chat" sidebar list.

### `lastMessageAt` (on Chat)

A field on `Chat` (timestamp). The `createdAt` of the most recent `ChatMessage` in the chat, if any exist; absent otherwise. Used by the History view to sort and group chats by recency (the "Oct 24 / Oct 22 / Oct 18" headers in the chat-history design). Maintained by the application layer; not by an index.

### `libraryId` (on Chat)

A field on `Chat`. The id of the `Library` this chat is grounded in. Cross-context reference into the `library` context. Set at chat creation; immutable. Must reference a library owned by the same user (`Library.userId == Chat.userId`); enforced at the application layer.

### `chatId` (on ChatMessage)

A field on `ChatMessage`. The id of the parent chat this message belongs to. Always equal to the parent `Chat.id`; carried denormalised on the entity for clarity at the application layer. Immutable.
