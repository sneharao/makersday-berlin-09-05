# Shared Language

Terms that legitimately span every bounded context. Keep this file deliberately small. Anything specific to one context belongs in that context's `language.md`.

## DDD Terms

### Bounded Context

A region of the model in which a single ubiquitous language and one consistent model are in force. Each top-level folder under `harness/knowledge/domain/` (other than this file and `context-map.md`) is a bounded context. Cross-context references use ids and value objects, never direct entity references.

### Aggregate Root

The entity that is the entry point to an aggregate. Only aggregate roots are referenced from outside their context. Non-root entities (`Artifact` inside `Library`, `ChatMessage` inside `Chat`) and value objects are internal to the aggregate and do not appear on the [context map](context-map.md).

## Tenancy and Cross-Context Identity

The terms below name aggregate roots and ids that are referenced across context boundaries. From outside the owning context, treat the ids as opaque — load the full aggregate via the owning context's repository if you need its data.

### User (Tenant)

A human who logs into the platform. The unit of multi-tenancy. `User` is an aggregate root owned by the `user` context. Every other aggregate root in every context carries a `userId` (or derives it transitively from a parent that does), and every query and every domain operation is scoped to a user.

### `userId`

The tenant key. Its value is `User.id` — an internal UUID minted by the platform. Treat it as opaque outside the `user` context. The auth provider's per-user identifier (`authSubjectId`) is a **separate** field on the `User` aggregate (see `user/language.md`), never the value of `userId`. Carried directly on every aggregate root that needs to be scoped to a tenant; internal entities (`Artifact`, `ChatMessage`) reach the tenant transitively through their aggregate root and do not carry `userId` themselves.

### Library

A named collection of uploaded source documents owned by exactly one `User`. `Library` is an aggregate root owned by the `library` context. A user may have many libraries. Other contexts may reference a library by `libraryId`.

### `libraryId`

The id of a `Library` aggregate. Carried on aggregate roots in other contexts when those aggregates are grounded in a specific library (e.g. a chat). Treat it as opaque outside the `library` context.

### Artifact

A single uploaded source document (a PDF, article, dataset, book, etc.) inside a `Library`. **Internal entity** of the `Library` aggregate, not an aggregate root: an artifact is loaded, mutated, and queried through its parent library. It is referenced from outside `library` only as the pair `(libraryId, artifactId)`, because the artifact may only be reached through its parent library — this is the standard DDD rule that internal entities are not directly addressable from outside their aggregate.

### `artifactId`

The id of an `Artifact` internal entity. Only meaningful when accompanied by the parent `libraryId`. Used by the `chat` context inside `Citation` value objects on `ChatMessage`s. Treat it as opaque outside the `library` context.

## Conversation Identity

### Chat

A grounded conversation between a `User` and the contents of one `Library`. `Chat` is an aggregate root owned by the `chat` context. Other contexts may reference a chat by `chatId` (no other context currently does, but the term is documented proactively for the cross-context contract).

### `chatId`

The id of a `Chat` aggregate. Not currently consumed by any other context. Treat it as opaque outside the `chat` context.
