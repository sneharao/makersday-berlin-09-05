# Application Conventions

The application ring (`app/backend.server/application/`) is the **use-case ring**. It contains application services, DTOs, mappers, and the gateway / unit-of-work / clock / event-publisher ports the use cases depend on. It orchestrates domain logic against the outside world; it does not contain business rules.

For the *why*, see [architecture-manifesto.md](./architecture-manifesto.md). For the broader layout, see [architecture-overview.md](./architecture-overview.md).

## Purpose

Application services are the **use-case seam**. Driving adapters (controllers, workers, CLIs) call them; they orchestrate domain entities and ports to fulfill the use case and return a DTO. They are the public API of the backend — every controller calls one.

> "Application orchestrates; domain computes. Application knows the system exists. Domain doesn't." — [architecture-manifesto.md](./architecture-manifesto.md)

The application ring depends on `domain/`, `application/` itself, and `platform/shared/`. It does **not** import from `infrastructure/` or `platform/infrastructure/`. It does not import collaboration libraries (`mongodb`, `openai`, `axios`, `@aws-sdk/*`, etc.); it does not read `process.env`; it does not contain HTTP request/response shapes.

## Structure

```
application/<context>/
├── <usecase>.service.ts            # application services
├── <context>.dto.ts                # DTOs + co-located mappers
├── config.ts                       # application config slice (when needed)
├── <port>.gateway.ts               # gateway ports (default home)
├── session-context.ts              # value-style helpers shared across use cases
└── shared/                         # cross-context application code (rare; create only when needed)
```

Cross-context shared application code lives in `application/shared/`. The folder is created only when something actually belongs there; empty `shared/` folders are not maintained proactively.

## Application Services

One application service per bounded context by default. **Multiple are allowed when a context grows enough that splitting clarifies responsibility.**

> "Application services are not required to be one-per-use-case." — [architecture-manifesto.md](./architecture-manifesto.md)

**Strict rule: application orchestrates; domain computes.** Application services contain no business rules. Conditionals expressing policy in an application service are a leak from the domain.

Forbidden in application services:

- Business rules (move to domain entity or domain service).
- HTTP request/response handling (lives in `infrastructure/api/`).
- SDK calls (`mongodb`, `openai`, `@aws-sdk/*`, ...) — those go behind ports implemented in `infrastructure/gateways/` or `infrastructure/repositories/`.
- Reading `process.env` (only `main/run-config.ts` does that).

Skeleton:

```ts
// application/library/upload-artifact.service.ts
import type { LibraryRepository } from "@backend-domain/library/library.repo";
import type { PdfStorageGateway } from "@backend-application/library/pdf-storage.gateway";
import type { Clock } from "@backend-application/shared/clock";
import type { EventPublisher } from "@backend-application/shared/event-publisher";
import { Library } from "@backend-domain/library/library";
import {
  type UploadArtifactRequest,
  type ArtifactDto,
  toArtifactDto,
} from "@backend-application/library/library.dto";

export class UploadArtifactService {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly pdfStorage: PdfStorageGateway,
    private readonly clock: Clock,
    private readonly events: EventPublisher,
  ) {}

  async upload(request: UploadArtifactRequest): Promise<ArtifactDto> {
    const library = await this.libraries.getById(request.userId, request.libraryId);
    const sourceFile = await this.pdfStorage.persist(request.upload);
    const [artifact, event] = library.addArtifact({
      title: request.title,
      kind: request.kind,
      sourceFile,
      uploadedAt: this.clock.now(),
    });
    await this.libraries.addArtifactToLibrary(request.userId, library.id, artifact);
    await this.events.publish(event);
    return toArtifactDto(artifact);
  }
}
```

### Even trivial use cases get an application service

> "Even trivial use cases get an application service. The seam is where transaction boundaries, authorization, and DTO translation will eventually need to live. Writing it correctly the first time is cheaper than retrofitting it when the shortcut breaks." — [architecture-manifesto.md](./architecture-manifesto.md)

Driving adapters never bypass the application service to call a repository, gateway, or domain service directly. The recognised exceptions — health checks, pure metadata endpoints, CQRS read projections — are explicitly narrow and rare.

### Driving vs driven port distinction

> "Driving adapters call application services directly. The application service's public interface is its port; we do not extract a separate interface unless the use case has multiple implementations. Driven ports get explicit interfaces because the inner ring must forget which adapter exists; driving ports don't, because nothing in the inner rings depends back on the caller." — [architecture-manifesto.md](./architecture-manifesto.md)

In practice: the application service class itself is the driving-port surface. We only extract a `Service` interface when there are multiple implementations (e.g. a real one and a fake), and when extracted it lives in the same `.service.ts` file as the implementation.

## DTOs at Every Boundary

Domain entities and value objects do not cross the application-service boundary. Application services accept request DTOs and return response DTOs. Controllers translate between transport-shaped types (HTTP schemas, queue payloads) and these DTOs.

DTOs are introduced **at every application service boundary up front**, not lazily on first divergence.

> "Even where the DTO mirrors the entity 1:1 today, the type is duplicated so the boundary exists. The structural overlap stated above is the cost we accept for that contract surface." — [architecture-manifesto.md](./architecture-manifesto.md)

The structural overlap between entities and DTOs is **deliberate**, not duplication. The DTO layer is what lets the domain evolve without breaking API contracts, prevents accidental exposure of internal fields, and keeps entities shaped by business invariants rather than by external consumers.

```ts
// application/library/library.dto.ts
import type { Artifact } from "@backend-domain/library/artifact";

export type UploadArtifactRequest = {
  userId: string;
  libraryId: string;
  title: string;
  kind: string;
  upload: { bytes: Uint8Array; filename: string; mimeType: string };
};

export type ArtifactDto = {
  id: string;
  libraryId: string;
  title: string;
  kind: string;
  uploadStatus: "uploaded" | "processing" | "ready" | "failed" | "removed";
  pageCount?: number;
  uploadedAt: string;
};

export function toArtifactDto(artifact: Artifact): ArtifactDto {
  return {
    id: artifact.id,
    libraryId: artifact.libraryId,
    title: artifact.title,
    kind: artifact.kind,
    uploadStatus: artifact.uploadStatus,
    pageCount: artifact.pageCount,
    uploadedAt: artifact.uploadedAt.toISOString(),
  };
}
```

## Mappers

Mappers between domain entities and DTOs are **plain functions co-located with the DTO**. There is no `.mapper.ts` suffix; they are exported alongside the DTO type from `<context>.dto.ts`.

> "If a mapper needs to fetch or compute, that work belongs in the application service, not the mapper." — [architecture-manifesto.md](./architecture-manifesto.md)

Mappers are mechanical functions, not classes with injected dependencies.

## Ports Owned by the Application Ring

By default, application services declare the ports they need:

- **Gateway ports** (`<port>.gateway.ts`) — abstractions over external capabilities (auth providers, agents, third-party APIs). Default home is `application/<context>/`.
- **Unit-of-work** — abstraction over transactional boundaries.
- **Clock** — abstraction over wall-clock time.
- **Event publisher** — receives domain events produced by entities and domain services and forwards them to a message bus or audit log.

Repository ports default to `domain/<context>/` when the entity has business invariants worth expressing as a port; otherwise they live in `application/<context>/`.

A bounded context with no domain entities (a future embeddings-only or storage-only context) keeps **all** of its ports in `application/<context>/`. In practice the chat/library contexts own those ports directly:

```ts
// application/library/pdf-storage.gateway.ts
export interface PersistedSourceFile {
  storageUri: string;
  byteSize: number;
  mimeType: string;
  sha256Hash: string;
}

export interface PdfStorageGateway {
  persist(upload: { bytes: Uint8Array; filename: string; mimeType: string }): Promise<PersistedSourceFile>;
  read(storageUri: string): Promise<Uint8Array>;
  remove(storageUri: string): Promise<void>;
}
```

## Cross-Context Coordination

Prefer service-to-service over reaching across into other contexts' repositories. If `application/chat/` needs to verify that a `library_id` belongs to the requesting user before creating a chat, it depends on `LibraryService` (or a focused subset of its surface), not on `LibraryRepository` directly. This keeps each context's invariants enforced by its own service.

## Configuration

Each application service that needs runtime configuration declares its own config-slice type next to it (e.g. `EmbeddingsConfig` in `application/library/config.ts` once the embeddings gateway is wired). The composition root aggregates these into `AppConfig`; the application service receives its slice via the constructor.

> Config follows the inward rule. Application services declare what they need; `main/run-config.ts` aggregates and resolves from `process.env`. See [composition-root.md](./composition-root.md).

## File Naming

| Role                  | Suffix                  | Example                                              |
|-----------------------|-------------------------|------------------------------------------------------|
| Application service   | `.service.ts`           | `upload-artifact.service.ts`, `create-chat.service.ts` |
| DTO + mappers         | `.dto.ts`               | `library.dto.ts`, `chat.dto.ts`                      |
| Gateway port          | `.gateway.ts`           | `pdf-storage.gateway.ts`, `embeddings.gateway.ts`    |
| Repository port (here when no domain folder) | `.repo.ts` | `vector-index.repo.ts`                  |
| Config slice          | `config.ts` (no prefix) | `application/library/config.ts`                      |
| Other types           | (none)                  | `session-context.ts`                                 |

Interfaces:

| Interface suffix | When extracted                                                                          |
|------------------|------------------------------------------------------------------------------------------|
| `Service`        | Only when an application service has multiple implementations (e.g. real + fake). Lives in the same `.service.ts` file as the implementation. |
| `Gateway`        | Always. Lives in the `.gateway.ts` file.                                                 |
| `Repository`     | Always. Lives in the `.repo.ts` file.                                                    |

## Testing

Application services are **unit-tested with fake or in-memory port implementations** — no database, no network.

> "If application services require a real database to test, their ports are too thin or misused." — [architecture-manifesto.md](./architecture-manifesto.md)

Tests live in `tests/backend.server/application/<context>/<file>.test.ts`. Fake/in-memory port implementations are kept under `tests/backend.server/application/shared/` (or co-located in the test file when small).

See [`code-standards/backend/testing.md`](../../code-standards/backend/testing.md) for framework specifics.

## Forbidden in `application/`

- Imports from `infrastructure/` or `platform/infrastructure/`.
- HTTP request/response shapes (those live in `infrastructure/api/`).
- SDK imports (`mongodb`, `openai`, `@aws-sdk/*`, ...).
- Reading `process.env`.
- Direct `new` on infrastructure classes.

The full third-party classification rules live in [../dependency-rules.md](../dependency-rules.md#third-party-dependencies).
