# Add Domain Entity

Add a new domain entity to the system — domain type, repository port, Mongo model, repository adapter, and composition-root wiring.

The shape of this skill follows the onion + ports-and-adapters layout defined in [`repo-architecture/backend/architecture-overview.md`](../../knowledge/repo-architecture/backend/architecture-overview.md). Read it first if you are new to the layout.

If your work crosses into a code category not covered by this skill (e.g. you start touching UI while adding a domain entity), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Prerequisites

Read these before starting:
- `harness/knowledge/repo-architecture/dependency-rules.md` — ring boundaries and the 6×6 import matrix
- `harness/knowledge/repo-architecture/backend/domain-conventions.md` — entities, value objects, repository ports
- `harness/knowledge/repo-architecture/backend/repositories-conventions.md` — Mongo adapter pattern (`<entity>-mongo.model.ts`, `<entity>-mongo.repo.ts`)
- `harness/knowledge/repo-architecture/backend/composition-root.md` — wiring in `main/application.instances.ts`
- `harness/knowledge/repo-architecture/shared-kernel.md` — when a type belongs in `app/shared/`

---

## Step 1 — Decide Where the Type Lives

Use this decision tree:

- **Type genuinely needed by both frontend and backend?** → put the lightweight subset in `app/shared/domain/<context>/`, and re-export it from `app/backend.server/domain/<context>/`.
- **Backend only?** → define directly in `app/backend.server/domain/<context>/`.

Most full entities live backend-side; only the slim subset the UI needs (status enums, public Zod schemas) belongs in `shared/domain/`.

---

## Step 2 — Define the Entity

Entities live in `domain/<context>/<entity>.ts` (no suffix — files without a suffix are entities or value objects). The entity must be **pure** — no Typegoose, no Mongoose, no SDK imports.

```typescript
// app/backend.server/domain/library/library.ts
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const LibrarySchema = z.object({
  id: z.string().uuid().default(() => uuidv4()),
  user_id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  created_at: z.date().default(() => new Date()),
});

export type Library = z.infer<typeof LibrarySchema>;
```

If the schema lives in `shared/domain/` instead, re-export it from the backend domain folder so backend code consistently imports from `@backend-domain/...`:

```typescript
// app/backend.server/domain/library/library.ts
export { LibrarySchema, type Library } from '@shared/domain/library/library';
```

### Rules

- Files without a suffix are entities or value objects (per the file-naming table in `dependency-rules.md`).
- Every per-user entity must be **user-scoped on every read and write**. Scholastic AI is single-tenant per user — there are two acceptable patterns; pick the one that matches the entity's place in the aggregate graph:
  - **Direct (default).** The entity carries `user_id` itself and every repository method filters on it. Use this for any aggregate root that does not hang off another user-scoped aggregate. `Library` and `Chat` use this pattern.
  - **Derived via parent.** The entity does not carry `user_id`; instead it carries an FK to a parent aggregate that itself carries `user_id`. Scoping is enforced at the application/repository layer by first resolving the parent under the requesting user (e.g. `libraryRepo.getById(user_id, libraryId)`) and only then querying the child by the parent FK. Use this only when the entity is conceptually a child of exactly one parent aggregate. `Artifact` (child of `Library`) and `ChatMessage` (child of `Chat`) use this pattern — see [`knowledge/domain/library/data-model.md`](../../knowledge/domain/library/data-model.md) and [`knowledge/domain/chat/data-model.md`](../../knowledge/domain/chat/data-model.md).

  Default to direct unless the derived pattern is clearly justified.
- No infrastructure imports — no `@typegoose/typegoose`, no `mongoose`, no SDKs, no `process.env`.
- Domain code may import only from `domain/`, `platform/shared/`, and computation libraries (`zod`, `uuid`, `date-fns`, …).
- **Single-entity behaviour goes in this file as exported functions, not in a domain service.** Predicates, derived values, and state-machine guards that depend solely on the entity's own fields (e.g. `isReady(artifact)`, `hasCitations(message)`) live next to the type — record-shaped entities cannot carry methods, so an exported function taking the entity as its first argument is the in-place equivalent. Promote to a `<name>.service.ts` domain service only when the rule **spans multiple entities or value objects**, or when callers need to inject a fake. See `domain-conventions.md` §"Single-Entity Behaviour on Record-Shaped Entities".

---

## Step 3 — Define the Repository Port

A **repository port** is a collection-like abstraction over aggregate persistence. Methods read like operations on a set (`get`, `save`, `find`) — never like protocols (`send`, `invoke`).

Default home: `domain/<context>/<entity>.repo.ts`. The port lives in `application/<context>/` only when the context has no domain entities.

```typescript
// app/backend.server/domain/library/library.repo.ts
import type { Library } from './library';
import type { Artifact } from './artifact';

export interface LibraryRepo {
  findByUser(user_id: string): Promise<Library[]>;
  getById(user_id: string, libraryId: string): Promise<Library>;
  save(library: Library): Promise<Library>;
  delete(libraryId: string): Promise<void>;

  listArtifacts(libraryId: string): Promise<Artifact[]>;
  saveArtifact(artifact: Artifact): Promise<Artifact>;
}
```

### Rules

- Suffix: `.repo.ts`. The interface is named after its role (e.g. `LibraryRepo`).
- Method names use domain language, never database operations.
- Parameters and return types use domain types — never `DocumentType<…>` or other Mongoose types.
- The port lives in the inner ring; the adapter that implements it lives in `infrastructure/repositories/`.

---

## Step 4 — Create the Mongo Model and Repository Adapter

Driven adapters live under `infrastructure/repositories/<context>/`. Create two files: a Typegoose model and the adapter that extends `Repository<TDocument, TEntity>` from `platform/infrastructure/mongo/`.

**Model file** — Typegoose class that `implements` the domain entity:

```typescript
// app/backend.server/infrastructure/repositories/library/library-mongo.model.ts
import { modelOptions, prop, Severity, type DocumentType } from '@typegoose/typegoose';
import { v4 as uuidv4 } from 'uuid';
import type { Library } from '@backend-domain/library/library';

@modelOptions({
  schemaOptions: { timestamps: true, versionKey: false },
  options: { allowMixed: Severity.ALLOW },
})
export class LibraryMongoModel implements Library {
  @prop({ default: () => uuidv4(), unique: true, required: true, type: String })
  public id!: string;

  @prop({ required: true, type: String, index: true })
  public user_id!: string;

  @prop({ required: true, type: String })
  public name!: string;

  @prop({ type: String })
  public description?: string;

  @prop({ default: Date.now, required: true, type: Date })
  public created_at!: Date;
}

export type LibraryMongoDocument = DocumentType<LibraryMongoModel>;
```

**Adapter file** — extends `Repository<TDocument, TEntity>` and implements the domain port:

```typescript
// app/backend.server/infrastructure/repositories/library/library-mongo.repo.ts
import { Repository } from '@backend-platform/infrastructure/mongo/repository';
import type { MongoClient } from '@backend-platform/infrastructure/mongo/client';
import { LibrarySchema, type Library } from '@backend-domain/library/library';
import type { LibraryRepo } from '@backend-domain/library/library.repo';
import { LibraryMongoModel, type LibraryMongoDocument } from './library-mongo.model';

export class LibraryMongoRepo
  extends Repository<LibraryMongoDocument, Library>
  implements LibraryRepo
{
  constructor(mongoClient: MongoClient) {
    super(LibraryMongoModel, mongoClient, 'libraries', LibrarySchema);
  }

  async findByUser(user_id: string): Promise<Library[]> {
    const docs = await this._find({ user_id });
    return docs.map((doc) => this.documentToEntity(doc));
  }

  async getById(user_id: string, libraryId: string): Promise<Library> {
    const doc = await this._findOne({ user_id, id: libraryId });
    if (!doc) throw new Error(`Library ${libraryId} not found`);
    return this.documentToEntity(doc);
  }

  async save(library: Library): Promise<Library> {
    const validated = this.validateEntityForWrite(library);
    const doc = await this._upsert({ id: library.id }, validated);
    return this.documentToEntity(doc);
  }

  async delete(libraryId: string): Promise<void> {
    await this._deleteOne({ id: libraryId });
  }

  // ... listArtifacts / saveArtifact omitted for brevity — same pattern, separate Mongo model.
}
```

### Rules

- File suffixes: `<entity>-mongo.model.ts` for the Typegoose model, `<entity>-mongo.repo.ts` for the adapter.
- The model class **must** `implements <DomainEntity>` — gives compile-time sync between the Mongo shape and the domain type.
- The adapter **must** `implements <Port>` — guarantees the adapter fulfils the port contract.
- The adapter extends `Repository<TDocument, TEntity>` from `@backend-platform/infrastructure/mongo/repository`.
- Pass the domain Zod schema to the base constructor for runtime validation on read/write.
- Public methods return domain types — never `DocumentType<…>`.
- Collaboration libraries (`@typegoose/typegoose`, `mongoose`) appear only inside `infrastructure/` or `platform/infrastructure/`.

---

## Step 5 — Wire in the Composition Root

Adapters are instantiated only in `app/backend.server/main/application.instances.ts`. This is the only place `new` is called on infrastructure classes.

```typescript
// app/backend.server/main/application.instances.ts
import { MongoClient } from '@backend-platform/infrastructure/mongo/client';
import { LibraryMongoRepo } from '@backend-infrastructure/repositories/library/library-mongo.repo';
import { LibraryService } from '@backend-application/library/library.service';
import type { AppConfig } from './run-config';

export function buildApplicationInstances(config: AppConfig) {
  const mongo = new MongoClient(config.mongo);
  const libraryRepo = new LibraryMongoRepo(mongo);
  const libraryService = new LibraryService(libraryRepo);

  return { libraryService, mongo };
}
```

The application service receives the **port** (`LibraryRepo`) by interface — never the concrete adapter type. See [`composition-root.md`](../../knowledge/repo-architecture/backend/composition-root.md) for the full wiring pattern, including config slices and `controller.instances.ts`.

---

## Step 6 — Add an Application Service (if a use case exists)

A new entity rarely stands alone — it is consumed through a use case. Application services live in `application/<context>/<usecase>.service.ts` and depend on the **port**, not the adapter:

```typescript
// app/backend.server/application/library/library.service.ts
import type { LibraryRepo } from '@backend-domain/library/library.repo';
import { type LibraryDto, toLibraryDto } from './library.dto';

export class LibraryService {
  constructor(private readonly libraryRepo: LibraryRepo) {}

  async listForUser(user_id: string): Promise<LibraryDto[]> {
    const libraries = await this.libraryRepo.findByUser(user_id);
    return libraries.map(toLibraryDto);
  }
}
```

Domain entities never cross the application-service boundary. Use a DTO co-located with the service (`<context>.dto.ts`). Mappers between entities and DTOs are plain functions co-located with the DTO. See [`application-conventions.md`](../../knowledge/repo-architecture/backend/application-conventions.md) for full rules on services, DTOs, and ports.

If you are also exposing the use case over HTTP, follow `harness/skills/development/add-api-endpoint.md`.

---

## Step 7 — Add Shared Types (if applicable)

If the entity has status enums or lightweight value types used by the UI, place them in `shared/domain/<context>/` and re-export from `backend.server/domain/<context>/` if the backend also needs them:

```typescript
// app/shared/domain/library/artifact-status.ts
export enum ArtifactStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}
```

---

## Step 8 — Decide Whether the Entity Warrants a Domain Unit Test

Before creating `tests/backend.server/domain/<context>/<entity>.test.ts`, list out what the file would actually assert. Then apply this gate:

- **No file is needed** if every assertion would only re-verify a stock Zod combinator (`z.string().min(1)` rejects `""`, `z.email()` rejects `"x"`, `z.enum([...])` rejects an unknown value, a required field is missing, etc.). Zod's own tests cover its contract; the repository integration test exercises the schema end-to-end on every save and load.
- **No file is needed** if the entity is a pure record schema — no methods, no `.transform(...)`, no `.refine(...) / .superRefine(...)`, and no value objects with custom parsing. The integration test for the adapter is the only test that needs to exist.
- **Write the file** only when there is custom logic to cover: a `.transform(...)` you wrote, a cross-field `.refine(...)`, a method on the entity or a value object, a domain service, or a non-trivial parser/normaliser.

See `code-standards/backend/testing.md` § Domain for the full rules and the "predict the assertions" heuristic.

---

## Step 9 — Run Checks

Execute `harness/skills/testing/run-code-checks.md` to verify:
- `npm run typecheck` — catches mismatches between domain type, model, and port
- `npm run build` — catches bundler-level boundary violations
- *(planned)* `npm run lint` — once ESLint is wired up, this will catch ring violations (e.g. domain importing from `infrastructure/`)

---

## Checklist

Before considering the entity complete:

- [ ] Entity defined in `domain/<context>/<entity>.ts` with no infrastructure imports
- [ ] Type exported as `z.infer<typeof Schema>`
- [ ] Repository port in `domain/<context>/<entity>.repo.ts` with domain-language method names
- [ ] Mongo model in `infrastructure/repositories/<context>/<entity>-mongo.model.ts` with `implements <DomainEntity>`
- [ ] Adapter in `infrastructure/repositories/<context>/<entity>-mongo.repo.ts` extending `Repository<TDocument, TEntity>` and `implements <Port>`
- [ ] Domain Zod schema passed to base repository constructor
- [ ] All public adapter methods return domain types (never `DocumentType`)
- [ ] Adapter instantiated only in `main/application.instances.ts`
- [ ] Application service depends on the port (interface), not the adapter
- [ ] DTOs (`<context>.dto.ts`) used at the application-service boundary
- [ ] Per-user (`user_id`) scoping on every read/write — either `user_id` on the entity (direct, default) or scope derived through a parent aggregate that carries `user_id` (see Step 2 rules)
- [ ] All checks pass (`typecheck`, `build`)
