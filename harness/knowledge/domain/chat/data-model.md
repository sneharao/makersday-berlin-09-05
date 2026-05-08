# Chat — Data Model

Persistence shape for the `chat` bounded context. Read this file only when working on repositories, Mongo schemas, or migrations.

This file is the canonical source for **collection layout, field types, defaults, on-write transforms, indexes, tenancy enforcement, and migration**. It is **not** the source for invariants, value-object values, or aggregate behaviour:

- Aggregate boundaries, conceptual state, and invariants → [domain-model.md](domain-model.md).
- Value-object values, per-value meanings, and the append-only transcript rule → [language.md](language.md).

The persistence layer faithfully serialises the single aggregate root defined in [domain-model.md](domain-model.md) — `Chat` — across **two collections**: one for the root, and one for its internal `ChatMessage` entities. Storing messages in a separate collection (rather than embedded in the chat document) is a deliberate choice — see [Why two collections for one aggregate](#why-two-collections-for-one-aggregate). The aggregate boundary is preserved at the application/repository layer: external callers go through `ChatRepo` only; `ChatMessage` has no separate repository port.

## Storage

- **Database:** MongoDB.
- **ODM:** Typegoose, with Zod for runtime validation on read and write (passed to the base `Repository<TDocument, TEntity>` constructor — see [`repositories-conventions.md`](../../repo-architecture/backend/repositories-conventions.md)).
- **Identifiers:** UUID v4 stored as a top-level `id: string` field on every document. Mongo's auto-generated `_id` is not used as the domain identifier and is ignored by application code. Matches the convention established in `user/data-model.md`.
- **Timestamps:** every document carries `createdAt` and `updatedAt` (managed via Typegoose `timestamps: true`).
- **Soft delete:** `Chat` carries `isActive: boolean` (default `true`). `ChatMessage` is **append-only** — no soft or hard delete, no mutation; once written the document is immutable for the lifetime of the chat.
- **Tenant scope:** `chats` carries `userId` directly. `chat_messages` does **not** — its tenancy is derived from its parent chat via `chatId`. See the [Tenancy Rule](#tenancy-rule).
- **Embedded value objects:** `body` is stored inline on the chat-message document as an embedded sub-document (`{ format, text }`); `citations` is stored inline as an array of embedded sub-documents (`{ libraryId, artifactId, pageNumber, excerpt? }`).

## Collections

| Collection | Aggregate / Entity | Tenant-scoped? | Soft delete? |
|------------|--------------------|----------------|--------------|
| `chats` | `Chat` (aggregate root) | Yes — direct (`userId`) | Yes (`isActive`) |
| `chat_messages` | `ChatMessage` (internal entity of `Chat`) | Yes — derived (via `chatId` → `chats.userId`) | No (append-only, immutable once written) |

## Why two collections for one aggregate

`ChatMessage` is an internal entity of the `Chat` aggregate (per [domain-model.md](domain-model.md)), but it is **not** stored embedded in the chat document. The split is a persistence-shape decision driven by three pressures:

1. **Document growth.** A chat accumulates messages indefinitely; long research conversations easily exceed hundreds of turns. Embedding would push chat documents toward MongoDB's 16 MB limit and make every read of the chat fetch the full transcript even when the caller only needs the chat metadata (e.g. the History view, which renders only `title`, `lastMessageAt`, and a snippet).
2. **Append cost.** Each new message must atomically advance `updatedAt` and `lastMessageAt` and append the message itself. Embedding turns this into a write of the entire growing chat document on every turn; a separate collection turns it into a single insert plus a small chat metadata update.
3. **Read patterns.** The chat view fetches messages paginated by `sequence` (often the last N for resume). The History view never fetches messages at all. Both patterns are first-class on a separate collection with a `(chatId, sequence)` index; both are awkward against an embedded array.

The aggregate boundary is preserved at the application/repository layer:

- External callers see only `ChatRepo`. There is no `ChatMessageRepo` port — messages are reached only through chat-scoped methods (`listMessagesForChat`, `appendMessage`, `getMessageBySequence`).
- `ChatRepo` reads and writes both collections internally; it is the only place in the codebase that knows the `chat_messages` collection exists.
- All message writes are tenant-scoped via the parent chat check (see [Tenancy Rule](#tenancy-rule)). There is no in-collection write to `chat_messages` that does not first verify the parent chat belongs to the requesting tenant.

This mirrors the same pattern used in [`library/data-model.md`](../library/data-model.md) for `Artifact`.

## `chats` Collection

Backs the `Chat` aggregate root. Each document belongs to exactly one user. Field-level invariants live in [domain-model.md#chat](domain-model.md#chat).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` (UUID v4) | yes | Aggregate id. The value used as `chatId` in any future cross-context reference. |
| `userId` | `string` (UUID v4) | yes | Tenant scope; FK to `users.id`. |
| `libraryId` | `string` (UUID v4) | yes | Cross-context reference to `libraries.id`. Set at chat creation; immutable. The library must be owned by the same user — enforced at the application layer (see [Tenancy Rule](#tenancy-rule)). |
| `title` | `string` | yes | Trimmed on write; non-empty after trim. Defaulted at creation time to a derived placeholder (e.g. `"New chat"`). |
| `isActive` | `boolean` | yes | Default `true`. Soft-delete flag. |
| `lastMessageAt` | `Date` | no | The `createdAt` of the most recent `ChatMessage` in this chat; absent until the first message is appended. Maintained by `ChatRepo.appendMessage`. |
| `createdAt` | `Date` | yes | Chat-creation timestamp. |
| `updatedAt` | `Date` | yes | Last-modified timestamp. Bumped on rename, on activation flip, and on every message append. |

**Indexes:**

- `id` — unique.
- `userId` — non-unique (every tenant-scoped query filters on it).
- `(userId, isActive, lastMessageAt)` — compound non-unique with `lastMessageAt` descending; *serves read pattern:* the History view's per-user listing of chats sorted by recency (the "Oct 24 / Oct 22 / Oct 18" grouping in the chat-history design). Also the live "Chat" sidebar listing when filtered to `isActive = true`.
- `libraryId` — non-unique; *serves read pattern:* finding all chats grounded in a given library (e.g. for cascade-deactivation flows when a library is archived in a future iteration).

## `chat_messages` Collection

Backs the `ChatMessage` internal entity of the `Chat` aggregate. Each document belongs to exactly one chat; tenancy is inherited from that chat (the document does not carry its own `userId`). **Documents in this collection are immutable once written** — there is no update path; `ChatRepo` only inserts new messages. Field-level invariants live in [domain-model.md#chatmessage](domain-model.md#chatmessage).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` (UUID v4) | yes | Entity id. |
| `chatId` | `string` (UUID v4) | yes | FK to `chats.id`. The sole tenancy and parent reference. |
| `sequence` | `number` (integer ≥ 1) | yes | 1-based position within the chat. Strictly monotonic, no gaps. Allocated by `ChatRepo.appendMessage` under a per-chat lock (see below). |
| `role` | `string` (enum) | yes | Closed-set string. Values: see [language.md#messagerole](language.md#messagerole). |
| `body` | `{ format: string, text: string }` | yes | Embedded sub-document. `format` is one of the closed-enum format values (currently only `markdown`); `text` is non-empty after trim. |
| `citations` | `{ libraryId: string, artifactId: string, pageNumber: number, excerpt?: string }[]` | yes | Embedded array. Empty array when `role` is `user` or `system`. May be non-empty only when `role` is `assistant`. Cross-field invariant; see [domain-model.md#chatmessage](domain-model.md#chatmessage). Every `citations[i].libraryId` equals the parent chat's `libraryId` — application-layer enforced. |
| `createdAt` | `Date` | yes | Append timestamp. Used to set the parent chat's `lastMessageAt` in the same write. |
| `updatedAt` | `Date` | yes | Equals `createdAt` for every document in this collection (append-only). Carried for uniformity with other collections. |

**Indexes:**

- `id` — unique.
- `(chatId, sequence)` — compound unique. *Enforces invariant:* the strictly-monotonic-no-gaps `sequence` invariant on `ChatMessage`. Also the primary read index for the chat view (paginating messages by sequence).

There is no document-level tenant key on chat messages; the tenant is the chat's `userId`. See the [Tenancy Rule](#tenancy-rule).

### Sequence allocation

`sequence` is allocated by `ChatRepo.appendMessage` server-side. The repository:

1. Resolves the parent chat under the requesting tenant (see [Tenancy Rule](#tenancy-rule)).
2. Reads the current `chats.lastMessageAt` and the highest existing `chat_messages.sequence` for `chatId` (one indexed query).
3. Computes `nextSequence = maxSequence + 1` (or `1` if no messages exist).
4. Inserts the new `chat_messages` document with `sequence = nextSequence`. The `(chatId, sequence)` unique index is the safety net: if two appends race and both compute the same `nextSequence`, exactly one insert succeeds; the loser retries from step 2.
5. Updates the parent `chats` document setting `lastMessageAt = inserted.createdAt` and bumping `updatedAt`.

This in-process, optimistic-with-unique-index sequence allocation is sufficient for v1 — the expected concurrency on a single chat is one user prompt followed by one assistant reply, never two parallel writers. If the platform later supports collaborative chats, this scheme is replaceable with a per-chat counter document or a transaction without changing the domain shape.

## Tenancy Rule

Every tenant-scoped read and write **must** be scoped to a `userId`. Repository adapters in this context are responsible for enforcing this; callers must pass the tenant id explicitly. There is no implicit/global query.

- `chats` filters `userId` directly on the query.
- `chat_messages` has no `userId` field. `ChatRepo` message methods take a `userId` and enforce tenancy at the application/repository layer by **first** resolving the parent chat (via an internal `_getChatById(userId, chatId)` that filters by `userId`) and rejecting the call if no such chat exists in the requesting tenant. Once the chat is verified, the message query is by `chatId` alone.
- **Cross-context tenant guard at chat creation.** `ChatRepo.save(chat)` must reject any new chat whose `libraryId` does not belong to the same `userId`. Enforcement: the chat **application service** (`application/chat/chat.service.ts`) takes both `ChatRepo` and `LibraryRepo` ports as dependencies and asserts `libraryRepo.getById(userId, libraryId)` resolves before calling `chatRepo.save(...)`. The repository layer trusts that this assertion has happened upstream.

This is the **derived-via-parent** tenancy pattern documented in [`add-domain-entity.md`](../../../skills/development/add-domain-entity.md) (Step 2 rules), chosen here because chat messages are conceptually a child of chat, the path to the tenant is unambiguous via `chatId`, and a duplicated `userId` on the message document would only re-introduce a cross-tenant equality invariant the database cannot enforce.

## Repository Ports & Adapters

Per the harness convention ([`repositories-conventions.md`](../../repo-architecture/backend/repositories-conventions.md), [`add-domain-entity.md`](../../../skills/development/add-domain-entity.md)):

- A single domain port `domain/chat/chat.repo.ts` exposes both chat- and message-level operations (because `ChatMessage` is internal to the `Chat` aggregate, it has no separate port).
- Two Typegoose models in `infrastructure/repositories/chat/` — one per collection — each `implements` the corresponding domain type (`Chat` and `ChatMessage`).
- A single adapter `infrastructure/repositories/chat/chat-mongo.repo.ts` implements the port; it knows about both collections and is the only place message-collection access happens.

| Aggregate / Entity | Port (domain) | Model (infrastructure) | Adapter (infrastructure) |
|--------------------|---------------|------------------------|--------------------------|
| `Chat` (root) | `chat.repo.ts` | `chat-mongo.model.ts` | `chat-mongo.repo.ts` |
| `ChatMessage` (internal entity) | *(none — internal)* | `chat-message-mongo.model.ts` | *(handled inside `chat-mongo.repo.ts`)* |

Method names speak the domain language. A representative (non-exhaustive) shape of `ChatRepo`:

- Chat-level: `getById(userId, chatId)`, `listForUser(userId, { isActive?, libraryId? })`, `save(chat)`, `rename(userId, chatId, newTitle)`, `archive(userId, chatId)`.
- Message-level (always tenant-scoped via `userId`): `appendMessage(userId, chatId, messageInput)` (allocates `sequence`, writes the message, updates parent `lastMessageAt` — see [Sequence allocation](#sequence-allocation)), `listMessagesForChat(userId, chatId, { fromSequence?, limit? })`, `getMessageBySequence(userId, chatId, sequence)`.

None of these methods betray Mongo (`insertOne`, `aggregate`, …). Adapters return domain entities, never `DocumentType`s.

## Migration Plan

**Strategy: greenfield.** No production data exists; the schema is created from scratch on first deploy of every environment.

### Phase 1 — Drop legacy

No legacy. Skip.

### Phase 2 — Create new collections and indexes

Create the two new collections with the indexes specified above. Indexes are declared via Typegoose `@prop` decorators on each model class and applied automatically by the ODM on first connect; the migration does not need to issue `createIndex` directly. Verify post-deploy with `db.<collection>.getIndexes()` that the unique and compound indexes are present.

| Collection | Indexes to verify |
|------------|-------------------|
| `chats` | `id` unique; `userId`; `(userId, isActive, lastMessageAt)` compound; `libraryId` |
| `chat_messages` | `id` unique; `(chatId, sequence)` compound unique |

### Phase 3 — Seed (per environment)

For local and dev environments, optionally seed one example chat per seeded user grounded in their seeded library, with a system message and a couple of user/assistant turns so the History view is not empty on first login. Production seeds nothing — chats are user-created.

Seeding lives in dedicated init scripts (not in the application server), invoked manually per environment.

### Phase 4 — Code cutover

The schema, repository, and application service ship together as a single deploy:

- Add the `Chat` and `ChatMessage` entities under `domain/chat/`.
- Add the single `ChatRepo` port under `domain/chat/chat.repo.ts`.
- Add the two Typegoose models and the single adapter under `infrastructure/repositories/chat/`.
- Wire the adapter in `main/application.instances.ts`. The chat **application service** wires `ChatRepo` together with `LibraryRepo` for the cross-context `libraryId` ownership check at chat creation (see [Tenancy Rule](#tenancy-rule)).

### Phase 5 — Cross-context cleanup

No other context references `chatId` yet. For greenfield this is a non-issue.

### Roll-back

Roll-back is "revert the deploy and drop the `chats` and `chat_messages` collections in the rolled-back environment." There is no in-place revert.
