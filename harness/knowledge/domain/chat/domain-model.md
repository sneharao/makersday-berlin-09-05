# Chat — Domain Model

The `chat` bounded context owns the **grounded conversations** a user has with the contents of a library. Each conversation is a `Chat` aggregate; each turn within it is a `ChatMessage` internal entity. Chats reference libraries (and, through citations, specific artifacts inside those libraries) by id only; the chat context never loads `Library` or `Artifact` aggregates directly.

This file is the canonical source for **aggregate boundaries, conceptual state, invariants, and behaviour**. Field types, indexes, and storage shape live in [data-model.md](data-model.md). Term definitions and the values of every value object live in [language.md](language.md).

## Aggregate Roots

The context owns one aggregate root: `Chat`. `Chat` carries `userId` directly (this context's tenancy anchor) and `libraryId` (the cross-context reference to the library the chat is grounded in). The turns of the conversation are modelled as an **internal entity** (`ChatMessage`) inside the `Chat` aggregate, not as a separate aggregate root: messages are loaded, mutated, and queried through the chat.

The diagram below shows every modelled element in this context. The aggregate is drawn as a dashed orange boundary containing its root, the internal entity it owns, and the value objects each composes. Cross-context references to `User` (owned by `user`) and `Library` (owned by `library`) are drawn as dashed-id arrows leaving the context, and those external aggregate roots use the shared external-root styling from [../index.md#diagramming-conventions](../index.md#diagramming-conventions).

```mermaid
flowchart TB
    subgraph ChatAgg["Chat Aggregate"]
        direction LR
        Chat[Chat]
        ChatTitle([ChatTitle])
        ChatMessage[ChatMessage]
        MessageRole([MessageRole])
        MessageBody([MessageBody])
        Citation([Citation])
        Chat        --- ChatTitle
        Chat        --- ChatMessage
        ChatMessage --- MessageRole
        ChatMessage --- MessageBody
        ChatMessage --- Citation
    end

    UserExt["User<br/>(user)"]
    LibraryExt["Library<br/>(library)"]

    Chat -.->|"userId"|    UserExt
    Chat -.->|"libraryId"| LibraryExt

    classDef agg fill:transparent,stroke:#f59e0b,stroke-width:2.5px,stroke-dasharray:8 5
    classDef root fill:#0f5b5e,stroke:#f59e0b,stroke-width:3px,color:#ffffff
    classDef externalRoot fill:#0f5b5e,stroke:#60A5FA,stroke-width:3px,color:#ffffff
    classDef entity fill:#0f5b5e,stroke:#0f5b5e,color:#ffffff
    classDef vo fill:#c8d8d4,stroke:#0f5b5e,color:#000000

    class ChatAgg agg
    class Chat root
    class UserExt,LibraryExt externalRoot
    class ChatMessage entity
    class ChatTitle,MessageRole,MessageBody,Citation vo

    linkStyle 5 stroke:#000000,stroke-width:5px,stroke-dasharray:10 6
    linkStyle 6 stroke:#000000,stroke-width:5px,stroke-dasharray:10 6
```

### `Chat`

A grounded conversation between a `User` and the contents of one `Library`. The unit a chat-history entry corresponds to.

**State:**

- `id` — internal UUID. The value used as `chatId` in any future cross-context reference.
- `userId` — the owning user (tenant scope and cross-context reference; same field). The chat context's tenancy anchor.
- `libraryId` — the library this chat is grounded in. Cross-context reference to a `Library` aggregate root in the `library` context. Set at chat creation; immutable.
- `title` — `ChatTitle` value object (human-readable; defaults to a derived placeholder until enough content exists or the user renames the chat).
- `messages` — ordered list of `ChatMessage` internal entities (zero or more, ordered by `sequence`). Loaded with the chat; reached only through it.
- `isActive` — `true` for active chats; `false` for archived. Soft-delete flag.
- `createdAt` — chat-creation timestamp.
- `updatedAt` — last-modified timestamp (bumped whenever a message is appended or the chat is renamed).
- `lastMessageAt` — timestamp of the most recent `ChatMessage`. Absent until the first message is appended.

**Invariants:**

- **Hard.** `id` is immutable.
- **Hard.** `userId` is immutable once set; chats cannot be transferred between users.
- **Hard.** `libraryId` is immutable once set; a chat cannot be re-pointed at a different library. To chat against a different library, create a new chat. (This guarantees every `ChatMessage`'s `Citation`s within a chat consistently resolve through one library.)
- **Hard.** `libraryId` must reference a `Library` whose `userId` equals this chat's `userId` — a user may only chat against their own libraries. Enforced at the application layer (the chat application service resolves the library through the `library` context's repository scoped to the requesting user; if no such library exists in that scope, the operation is rejected).
- **Hard.** `title` is required and non-empty. Default value at creation time is a derived placeholder (e.g. `"New chat"` or the first user message truncated); the user may rename it at any time.
- **Hard.** Every `ChatMessage` in `messages` has a `sequence` that is strictly monotonically increasing and starts at `1` for the first message. No gaps, no duplicates.
- **Hard.** A `Chat` is never hard-deleted; archiving flips `isActive` to `false`. Archived chats remain visible in the History view (matching the design's "Resume Chat" affordance) until the user purges them — purge is out of scope for this iteration.
- **Soft.** `lastMessageAt` equals the `createdAt` of the most recent `ChatMessage` in `messages` if any exist, else absent. Maintained by the application layer; not by an index.

**Identity sourcing:** `Chat.id` is platform-minted (UUID v4).

**Lifecycle:** Created when the user begins a new conversation against a library (the user picks the library on the library overview, or starts from the chat sidebar item). Mutated each time a message is appended (`ChatMessage` added; `updatedAt` and `lastMessageAt` advanced) or the chat is renamed. Archived (never deleted) when the user removes it from the active list. There is no transfer between users or between libraries.

## Internal Entities

### `ChatMessage`

A single turn in a `Chat` conversation — either a user prompt, an assistant reply, or a system message. **Internal entity, not an aggregate root.** Loaded, mutated, and queried only through its parent chat; never addressed directly from outside the `chat` context.

**State:**

- `id` — internal UUID, unique within its parent chat.
- `chatId` — the parent chat this message belongs to. Always equal to the parent `Chat.id`; carried denormalised on the entity for clarity at the application layer. Tenancy is derived from the parent chat (ChatMessage does not carry its own `userId`).
- `sequence` — strictly monotonic positive integer giving message order within the chat (first message is `1`).
- `role` — `MessageRole` value object (closed enum: `user`, `assistant`, or `system`).
- `body` — `MessageBody` value object (the markdown content of the turn).
- `citations` — set of `Citation` value objects (zero or more). Only populated on assistant messages; always empty for `user` and `system` messages.
- `createdAt` — timestamp the message was appended.

**Invariants:**

- **Hard.** `id` is immutable and unique within its parent chat.
- **Hard.** `chatId` is immutable once set; messages cannot be moved between chats.
- **Hard.** `sequence` is immutable once set, strictly positive, and unique within its parent chat. The first message in the chat has `sequence = 1`; subsequent messages increment by 1 with no gaps.
- **Hard.** `role` is required (single closed-enum value).
- **Hard.** `body` is required and non-empty.
- **Hard.** `citations` is empty when `role` is `user` or `system`. Only `assistant` messages may carry citations.
- **Hard.** Every `Citation.libraryId` equals the parent chat's `libraryId` — a chat is grounded in one library, so citations on its messages may only reference artifacts in that library. Enforced at the application layer; not by an index.
- **Hard.** A `ChatMessage` is never deleted (hard or soft). Once appended, the conversation transcript is append-only. Editing a past message is modelled as a new appended message, not as a mutation. (This preserves a faithful audit of what the assistant actually said.)

**Lifecycle:** Created (appended) by the application layer when the user sends a prompt and when the assistant returns a reply. Never updated; never deleted.

## Value Objects

This section describes each value object's **cardinality and behavioural role**. Value enumerations and per-value meanings are owned by [language.md](language.md) and are not duplicated here.

### `ChatTitle`

The human-readable title of a `Chat`, composed on `Chat` as `title`. **Single required value object, open form (validated string).** Trimmed on write; non-empty after trim. No uniqueness constraint — two of a user's chats may share a title. Default at creation time is a derived placeholder; the user may rename at any time.

### `MessageRole`

The role of the speaker for a `ChatMessage`, composed on `ChatMessage` as `role`. **Closed enum, exactly one value, required.** Values: see [language.md#messagerole](language.md#messagerole).

### `MessageBody`

The content of a `ChatMessage`, composed on `ChatMessage` as `body`. **Single required value object, open form.** Two fields:

- `format` — closed enum, exactly one value: `markdown` for now (the only supported format in v1; the field is present so future formats — e.g. `markdown_with_widgets` — can be added without restructuring the value object).
- `text` — the body content as a string in the declared `format`. Required and non-empty (after trim).

### `Citation`

A reference from an assistant `ChatMessage` to a specific page of a specific `Artifact` in the parent chat's `Library`. Composed on `ChatMessage` as `citations`. **Open form, multi-valued (zero or more), required cardinality is zero.** Only present on `assistant` messages (see `ChatMessage` invariants). Four fields:

- `libraryId` — the library the cited artifact lives in. Must equal the parent chat's `libraryId` (see `ChatMessage` invariants).
- `artifactId` — the id of the cited `Artifact` within that library. Together with `libraryId` forms the only valid form of cross-context artifact reference (because `Artifact` is internal to `Library`).
- `pageNumber` — the 1-based page within the artifact the citation points to. Must be in the range `[1, pageCount]` of the cited artifact at the time the citation is issued. Validated by the application layer at message-append time.
- `excerpt` — optional short text snippet from the cited page, used to render the badge in the UI (e.g. "ON THE NATURE OF DIGITAL THINGS - PG 42" in the chat design).

A `Citation` is immutable once attached to a message — assistant message bodies and their citations are frozen the moment the message is appended (consistent with the append-only transcript invariant on `ChatMessage`).

## Boundaries with other contexts

- The `user` context is referenced only for tenancy. `Chat.userId` is the sole link from the chat context to the user context. No chat element references `Email`, `DisplayName`, or any other user-level concept.
- The `library` context is referenced by `Chat.libraryId` (the library a chat is grounded in) and by the pair `(Citation.libraryId, Citation.artifactId)` (the cited artifact). Neither reference loads `Library` or `Artifact` aggregates directly — both go through the `library` context's repository ports. `Citation.pageNumber` is validated against the cited artifact's `pageCount` via the same boundary.
- Application-layer enforcement: when a chat is created, the chat application service resolves `libraryId` through the `library` context's repository scoped to the requesting `userId`; if no such library exists in that scope, the call is rejected. This is the single point at which the cross-tenant invariant on `Chat.libraryId` is enforced.
- All cross-context references are by id only. The `Chat` aggregate is never loaded directly from outside this context.
