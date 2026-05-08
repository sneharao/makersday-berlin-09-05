# Domain Conventions

The domain ring (`app/backend.server/domain/`) is the innermost ring of the onion. It contains entities, value objects, domain services, domain events, and the repository ports that belong to the ubiquitous language. Pure business logic — no I/O, no frameworks, no SDKs.

For the *why*, see [architecture-manifesto.md](./architecture-manifesto.md). For the broader layout, see [architecture-overview.md](./architecture-overview.md).

## Purpose

The domain ring encodes the business — the entities, the rules that govern them, and the language used to talk about them. If a class can be tested without mocks and without booting a database, it likely belongs here.

The domain ring depends on nothing in the codebase except `domain/` itself and `platform/shared/`. It does not import from `application/`, from `infrastructure/`, or from `platform/infrastructure/`. It does not import collaboration libraries (`mongodb`, `openai`, `axios`, `@aws-sdk/*`, etc.) — only computation libraries (`zod`, `date-fns`, `lodash`, `uuid`).

> "If a 'domain service' imports a repository or a gateway, it is an application service wearing the wrong label, and we move it." — [architecture-manifesto.md](./architecture-manifesto.md)

## Structure

```
domain/<context>/
├── <entity>.ts                 # entities & value objects (no suffix)
├── <name>.service.ts           # domain services
├── <event>.event.ts            # domain events (when introduced)
└── <port>.repo.ts              # repository ports (when in ubiquitous language)
```

A bounded context with no domain entities has **no `domain/<context>/` folder at all**. Do not create empty folders to maintain ring symmetry. An external-only capability (e.g. a future PDF-storage or embeddings gateway that has no domain aggregate of its own) is the canonical example — no `domain/<context>/` folder; its gateway ports live in `application/<context>/` (or, more commonly, in the consuming context's `application/` folder, with no separate context at all).

Cross-context shared domain types (rare) live in `domain/shared/`. The folder is created only when something actually belongs there; empty `shared/` folders are not maintained proactively.

## Entities and Value Objects

Entities and value objects take **no suffix** — they are the default citizen of the domain ring.

```ts
import { z } from "zod";

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  libraryId: z.string().uuid(),
  title: z.string().min(1),
  kind: z.string(),
  uploadStatus: z.enum(["uploaded", "processing", "ready", "failed", "removed"]),
});

export type Artifact = z.infer<typeof ArtifactSchema>;
```

Entities express invariants. If a transition between two valid entity states requires more than a method on the entity itself — for example, because it spans multiple entities — the rule moves into a domain service.

### Single-Entity Behaviour on Record-Shaped Entities

Entities here are Zod-derived plain records (`type Entity = z.infer<typeof EntitySchema>`) — they cannot carry methods. The in-place equivalent of "method on the entity" is an **exported function in the same `<entity>.ts` module** that takes the entity (and only the entity) as its first argument. Use this for predicates, derived values, and state-machine guards that depend solely on one entity's own fields.

```ts
// domain/library/artifact.ts
export function isReady(artifact: Artifact): boolean {
  return artifact.uploadStatus === "ready";
}
```

Promote to a domain service (`<name>.service.ts`) only when the rule **spans multiple entities or value objects**, or when callers need to inject a fake. A class with one method that takes one entity is ceremony — keep it as a function next to the type. The trigger for a domain service is the signature taking two or more domain shapes (see the `CitationResolutionService` example below), not the desire to group rules under a noun.

## Domain Services

A domain service encodes a business rule that does not naturally belong on a single entity. The file uses the `.service.ts` suffix; the class implements the rule directly, with an empty or near-empty constructor and no port dependencies.

```ts
// domain/chat/citation-resolution.service.ts
import type { Chat } from "@backend-domain/chat/chat";
import type { Citation } from "@backend-domain/chat/citation";

export class CitationResolutionService {
  /** Every citation produced for a chat must point to the chat's grounding library. */
  belongsToChat(chat: Chat, citation: Citation): boolean {
    return citation.libraryId === chat.libraryId;
  }
}
```

A domain service interface is extracted only when a fake is needed (for testing other domain code or application code). When extracted, it takes the `Service` suffix (e.g. `interface EvidenceSufficiencyService`) and lives in the same `.service.ts` file as the implementation.

If a domain service needs to import a `.repo.ts` or `.gateway.ts` to do its job, it is misplaced. Move it into `application/<context>/` and rename it as a use-case service.

## Domain Events

Domain events are **return values** produced by entities and domain services. The domain does not publish events — that is an application concern handled via an event-publisher port owned by the application ring.

A domain method that produces an event returns it (or returns a tuple of `[newState, events]`); an application service collects the events and forwards them to the publisher port. Events live next to the entity that produces them, with the `.event.ts` suffix.

```ts
// domain/library/artifact-uploaded.event.ts
export type ArtifactUploadedEvent = {
  type: "artifact.uploaded";
  libraryId: string;
  artifactId: string;
  uploadedAt: Date;
};
```

## Where Ports Live

Ports live in the ring that depends on them. The defaults:

- **Repository ports** (`<entity>.repo.ts`) — default to `domain/<context>/` when the entity has business invariants worth expressing as a port. Otherwise to `application/<context>/`.
- **Gateway ports** (`<port>.gateway.ts`) — default to `application/<context>/`. Move into `domain/<context>/` only when the abstraction is part of the ubiquitous language.

A bounded context with no domain entities has no `domain/<context>/` folder; **all** of its ports live in `application/<context>/`.

```ts
// domain/library/library.repo.ts
import type { Library } from "@backend-domain/library/library";
import type { Artifact } from "@backend-domain/library/artifact";

export interface LibraryRepository {
  getById(userId: string, libraryId: string): Promise<Library | null>;
  listForUser(userId: string): Promise<Library[]>;
  save(library: Library): Promise<void>;
  addArtifactToLibrary(userId: string, libraryId: string, artifact: Artifact): Promise<void>;
  listArtifactsForLibrary(userId: string, libraryId: string): Promise<Artifact[]>;
}
```

Repository methods speak the **domain language** ("getById", "save", "listForUser") — never persistence vocabulary like "insert" or "update".

> Repository adapters live in `infrastructure/repositories/<context>/`; see [repositories-conventions.md](./repositories-conventions.md). Gateway adapters live in `infrastructure/gateways/<context>/`; see [gateways-conventions.md](./gateways-conventions.md).

## File Naming

| Role                  | Suffix          | Example                                                                  |
|-----------------------|-----------------|--------------------------------------------------------------------------|
| Entity / value object | (none)          | `library.ts`, `artifact.ts`, `chat-message.ts`, `citation.ts`            |
| Domain service        | `.service.ts`   | `citation-resolution.service.ts`                                         |
| Repository port       | `.repo.ts`      | `library.repo.ts`, `chat.repo.ts`                                        |
| Gateway port (in domain — rare) | `.gateway.ts` | `embeddings.gateway.ts`                                            |
| Domain event          | `.event.ts`     | `artifact-uploaded.event.ts` (co-located with the entity that produces it) |

Interfaces:

| Interface suffix | File suffix      | Example                                                                       |
|------------------|------------------|-------------------------------------------------------------------------------|
| `Repository`     | `.repo.ts`       | `interface LibraryRepository` in `library.repo.ts`                            |
| `Gateway`        | `.gateway.ts`    | `interface EmbeddingsGateway` in `embeddings.gateway.ts`                      |
| `Service`        | `.service.ts`    | `interface CitationResolutionService` in `citation-resolution.service.ts`     |

## Cross-Process Domain Types

Types that need to be visible to both backend and frontend (e.g. enums for select-options, validation schemas for client-side form validation) live in `app/shared/domain/<context>/`, not in `backend.server/domain/`. Backend domain code may import from `@shared-domain/...`; the reverse is forbidden.

See [../shared-kernel.md](../shared-kernel.md) for full rules on the shared kernel.

## Testing

Domain code is tested with **unit tests, no mocks**. A `tests/backend.server/domain/<context>/<file>.test.ts` file imports only domain code and test utilities; it never boots a database or hits the network. If a piece of domain logic is hard to test without mocks, it is suspected of being misplaced — investigate whether it should be an application service.

See [`code-standards/backend/testing.md`](../../code-standards/backend/testing.md) for framework specifics.

## Forbidden in `domain/`

- Imports from `application/`, `infrastructure/`, or `platform/infrastructure/`.
- `import` of collaboration libraries: `mongodb`, `mongoose`, `@typegoose/typegoose`, `openai`, `axios`, `@aws-sdk/*`, `node-fetch`, etc.
- Reading `process.env`.
- React, JSX, anything browser-shaped.
- Direct event publishing (events are return values; application orchestrates the publishing).

The full third-party classification rules live in [../dependency-rules.md](../dependency-rules.md#third-party-dependencies).
