# Context Map

The high-level map of the **Scholastic AI** domain. Lists each **bounded context**, its role in the product, and the **aggregate roots** it owns. Inter-context relationships are described in DDD terms (upstream/downstream, references via ids).

> **Bounded context** — a region of the model in which a single ubiquitous language and one consistent model are in force. The same word can mean different things in different contexts.
>
> **Aggregate root** — the entity that is the entry point to an aggregate (a cluster of entities and value objects treated as a single consistency boundary). Only aggregate roots are referenced from outside their context; non-root entities are internal and reached only through their root.

## Bounded Contexts

| Bounded Context | Notes |
|-----------------|-------|
| `user` | Identity and authentication. Owns the `User` aggregate, which is the platform's tenancy boundary — every other aggregate in every other context resolves back to a `User` somehow. |
| `library` | The user's collection of uploaded source documents. Owns `Library` (the named collection) and `Artifact` (the uploaded PDF or other source document — an internal entity inside `Library`). |
| `chat` | Grounded conversations against a library. Owns `Chat` (the conversation) and `ChatMessage` (an individual turn in the conversation — an internal entity inside `Chat`). |

The detailed model and language for each context lives in its folder (`user/`, `library/`, `chat/`).

## Aggregate Roots

`user` owns one aggregate root — `User`. `User` is the per-user scoping boundary: every aggregate root in every other context carries `userId` (directly, or derived through a parent that does). There is no organisation/team concept above the user; one user is one tenant.

`library` owns one aggregate root — `Library`. A user may have many libraries. `Library` carries `userId` directly (the library context's tenancy anchor). The `Artifact` concept (an uploaded PDF, article, dataset, etc.) is an **internal entity** inside the `Library` aggregate, not an aggregate root: artifacts are loaded, mutated, and queried through the library, and an artifact cannot be moved between libraries.

`chat` owns one aggregate root — `Chat`. `Chat` carries `userId` directly (its tenancy anchor) and `libraryId` (the library it is grounded in). The `ChatMessage` concept (one turn in the conversation) is an **internal entity** inside the `Chat` aggregate, not an aggregate root: messages are loaded, mutated, and queried through the chat.

```mermaid
flowchart TB
    User[User]
    Library[Library]
    Chat[Chat]

    User -->|"has"|        Library
    User -->|"has"|        Chat
    Chat -->|"grounded in"| Library

    classDef root fill:#0f5b5e,stroke:#f59e0b,stroke-width:3px,color:#ffffff
    class User,Library,Chat root

    linkStyle 0 stroke:#000000,stroke-width:3px
    linkStyle 1 stroke:#000000,stroke-width:3px
    linkStyle 2 stroke:#000000,stroke-width:3px
```

`Artifact` (internal to `Library`) and `ChatMessage` (internal to `Chat`) do not appear on this high-level map — only aggregate roots do. They are visible inside their respective context's `domain-model.md`.

| Aggregate Root | Owning Context | Purpose |
|----------------|----------------|---------|
| `User` | `user` | A human who logs into the platform. The unit of multi-tenancy. |
| `Library` | `library` | A named collection of uploaded source documents owned by exactly one `User`. A user may have many libraries. Holds `Artifact`s as internal entities. |
| `Chat` | `chat` | A grounded conversation between a `User` and the contents of one `Library`. Holds `ChatMessage`s as internal entities. |

## Inter-Context Relationships

- **All contexts → `user` (tenancy).** Every aggregate root in every context resolves to a `User`. `Library.userId` and `Chat.userId` are direct. `Artifact` (internal to `Library`) inherits its tenant transitively via the parent library's `userId`. `ChatMessage` (internal to `Chat`) inherits its tenant transitively via the parent chat's `userId`.
- **`chat` → `library` (Customer/Supplier; `chat` downstream).** `Chat.libraryId` references the `Library` the chat is grounded in. The chat scope is **always the entire library** — there is no per-chat artifact subset selection. `libraryId` is set at chat creation and immutable thereafter (a chat cannot be re-pointed at a different library). When a `ChatMessage` cites a specific source artifact, the citation carries the pair `(libraryId, artifactId)` because `Artifact` is an internal entity, not an aggregate root, and may only be reached through its parent library.
- **`library` → `user`.** Tenancy only. `Library.userId` is the sole link from the library context to the user context. The library context does not reference `Email`, `Locale`, or any other user-level concept.
- **`chat` → `user`.** Tenancy only. `Chat.userId` is the sole link from the chat context to the user context.

References across contexts are by **id only**, never by direct entity reference. This preserves each context's autonomy and keeps aggregate boundaries crisp. Cross-context ids (`userId`, `libraryId`, `artifactId`) are opaque outside their owning context — load the full aggregate via that context's repository when you need its data.

## Multi-Tenancy

`userId` is the tenancy boundary. The value of `userId` is `User.id` — an internal UUID minted by the platform. The auth provider's per-user identifier (`authSubjectId`) is a separate field on the `User` aggregate (see `user/language.md`); it is never used as the tenancy key.

Every aggregate root either carries `userId` **directly** on its document, or **derives** it transitively through a parent aggregate that does. Internal entities (`Artifact`, `ChatMessage`) do not carry `userId` themselves — they are reached only through their aggregate root, which carries it. There is no implicit/global query — every read and write must be tenant-scoped one way or the other.

| Aggregate / Entity | Tenancy | Path to tenant |
|--------------------|---------|----------------|
| `User` (`user`) | — | *is* the tenant |
| `Library` (`library`) | direct | `userId` |
| `Artifact` (internal to `Library`) | derived | reached only via `Library`; tenant is the parent library's `userId` |
| `Chat` (`chat`) | direct | `userId` |
| `ChatMessage` (internal to `Chat`) | derived | reached only via `Chat`; tenant is the parent chat's `userId` |

Derived tenancy is enforced at the repository/application layer by first resolving the parent aggregate under the requesting tenant and rejecting the call if no such parent exists in that tenant. Per-context details — including the application-service-level guard that asserts `Chat.libraryId` belongs to the requesting `userId` at chat creation — live in each context's `data-model.md` (`user/data-model.md#tenancy-rule`, `library/data-model.md#tenancy-rule`, `chat/data-model.md#tenancy-rule`).
