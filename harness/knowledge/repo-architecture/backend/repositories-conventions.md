# Repository Conventions

Repository **adapters** live under `app/backend.server/infrastructure/repositories/<context>/`. They implement repository **ports** declared in `domain/<context>/` (or in `application/<context>/` when the entity has no business invariants worth expressing as a domain port).

For the *why*, see [architecture-manifesto.md](./architecture-manifesto.md). For the broader layout, see [architecture-overview.md](./architecture-overview.md).

## Structure

```
infrastructure/repositories/<context>/
├── <entity>-mongo.model.ts         # Typegoose model (infrastructure-only)
└── <entity>-mongo.repo.ts          # adapter — extends Repository<TDocument, TEntity>
```

The technology prefix (`-mongo`) disambiguates the **adapter** from the bare-context **port** (e.g. `domain/library/library.repo.ts` is the port; `infrastructure/repositories/library/library-mongo.repo.ts` is the adapter). Both share the `.repo.ts` suffix because "repository" names the same collaboration at both layers.

```
domain/library/library.repo.ts                                 ← port (interface LibraryRepository)
infrastructure/repositories/library/library-mongo.model.ts     ← Typegoose model (Library)
infrastructure/repositories/library/artifact-mongo.model.ts    ← Typegoose model (Artifact internal entity)
infrastructure/repositories/library/library-mongo.repo.ts      ← adapter (class LibraryMongoRepository)
```

## Adapters Extend the Base Class

Repository adapters extend the abstract base class `Repository<TDocument, TEntity>` exported from `platform/infrastructure/mongo/repository.ts`. Base-class inheritance is the prescribed pattern.

> "Do not compose the base, do not reimplement the validation/connection plumbing inside individual repos." — [architecture-manifesto.md / repo-architecture.md]

```ts
// infrastructure/repositories/library/library-mongo.repo.ts
import type { Library } from "@backend-domain/library/library";
import type { LibraryRepository } from "@backend-domain/library/library.repo";
import { Repository } from "@backend-platform/infrastructure/mongo/repository";
import { LibraryModel, type LibraryDocument } from "./library-mongo.model";

export class LibraryMongoRepository
  extends Repository<LibraryDocument, Library>
  implements LibraryRepository
{
  constructor() {
    super(LibraryModel);
  }

  async getById(userId: string, libraryId: string): Promise<Library | null> {
    const doc = await this.model.findOne({ id: libraryId, userId }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async save(library: Library): Promise<void> {
    await this.model.updateOne({ id: library.id }, { $set: library }, { upsert: true });
  }

  async listForUser(userId: string): Promise<Library[]> {
    const docs = await this.model.find({ userId, isActive: true }).lean();
    return docs.map((d) => this.toEntity(d));
  }
}
```

## Models `implements` the Domain Entity

The Typegoose model class `implements` the corresponding domain entity type, so a structural drift between persistence shape and domain shape is a compile error.

```ts
// infrastructure/repositories/library/library-mongo.model.ts
import { getModelForClass, prop } from "@typegoose/typegoose";
import type { Library } from "@backend-domain/library/library";

export class LibraryDocument implements Library {
  @prop({ required: true, unique: true }) id!: string;
  @prop({ required: true, index: true }) userId!: string;
  @prop({ required: true }) name!: string;
  @prop() description?: string;
  @prop({ required: true, default: true }) isActive!: boolean;
}

export const LibraryModel = getModelForClass(LibraryDocument);
```

Models are **infrastructure-only**. They never appear in `domain/`, `application/`, or `app/shared/`. Application code touches the entity (`Library`), never the document (`LibraryDocument`).

## Domain Language for Method Names

Repository methods speak the **domain language**. Names read like operations on a set: `getById`, `save`, `listForUser`. They do not betray the mechanism (`insertOne`, `updateMany`, `aggregate`).

> "Methods read like operations on a set (`get`, `save`, `find`), never like protocols (`send`, `invoke`). If the methods betray the mechanism, it isn't a repository." — [architecture-manifesto.md](./architecture-manifesto.md)

Repository methods always return **domain entities**, never `DocumentType`s, `LeanDocument`s, or raw `BSON` shapes. Conversion happens inside the adapter (`toEntity` provided by the base class).

## Configuration

The Mongo connection string and other client-level config live at `platform/infrastructure/mongo/config.ts` (`MongoClientConfig.fromEnv()`). Per-context repository config — when it exists — is co-located with the adapter (`infrastructure/repositories/<context>/config.ts`).

> No `run-config.ts` at the top of `infrastructure/`. Configuration is not a top-level concern of the infrastructure ring. — [repo-architecture.md]

The composition root (`main/run-config.ts`) reads `process.env`; nothing under `infrastructure/repositories/` does.

See [composition-root.md](./composition-root.md) for full config rules.

## Tests

Repository adapter tests are **integration tests** that use a real Mongo (test container or test database). They live in `tests/backend.server/infrastructure/repositories/<context>/<entity>-mongo.repo.integration.test.ts` and use the `.integration.test.ts` suffix to distinguish them from unit tests.

See [`code-standards/backend/testing.md`](../../code-standards/backend/testing.md) for framework specifics.

## File Naming

| Role               | Suffix              | Example                                        |
|--------------------|---------------------|------------------------------------------------|
| Repository port    | `.repo.ts`          | `library.repo.ts` (in `domain/library/`)       |
| Repository adapter | `.repo.ts` (with technology prefix) | `library-mongo.repo.ts`        |
| Mongo model        | `.model.ts` (with technology prefix) | `library-mongo.model.ts`, `artifact-mongo.model.ts` |
| Config slice       | `config.ts`         | `infrastructure/repositories/<context>/config.ts` |

Class naming:

| File                          | Class                                |
|-------------------------------|--------------------------------------|
| `library.repo.ts` (port)      | `interface LibraryRepository`        |
| `library-mongo.repo.ts`       | `class LibraryMongoRepository`       |
| `library-mongo.model.ts`      | `class LibraryDocument`, `const LibraryModel` |

## Allowed and Forbidden Imports

| Imports allowed                                          | Imports forbidden                                                  |
|----------------------------------------------------------|--------------------------------------------------------------------|
| `@backend-domain/...` (entities, port interfaces)        | `@backend-infrastructure/api/...`                                   |
| `@backend-application/...` ports (when the port lives there) | `@backend-infrastructure/gateways/...`                          |
| `@backend-platform/infrastructure/mongo/...`             | Reading `process.env` directly                                      |
| `@typegoose/typegoose`, `mongoose`, `mongodb`            | Calling application services                                        |
| Computation libraries (`zod`, `date-fns`, ...)           | HTTP transport concerns                                             |
