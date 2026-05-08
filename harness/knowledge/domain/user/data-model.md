# User — Data Model

Persistence shape for the `user` bounded context. Read this file only when working on repositories, Mongo schemas, or migrations.

This file is the canonical source for **collection layout, field types, defaults, on-write transforms, indexes, tenancy enforcement, and migration**. It is **not** the source for invariants, value-object values, or aggregate behaviour:

- Aggregate boundaries, conceptual state, and invariants → [domain-model.md](domain-model.md).
- Value-object values and per-value meanings → [language.md](language.md).
- Auth-provider field semantics (`authSubject`, `subjectId`, `provider`) → [language.md](language.md).

The persistence layer faithfully serialises the single aggregate root defined in [domain-model.md](domain-model.md) — `User` — as one collection.

## Storage

- **Database:** MongoDB.
- **ODM:** Typegoose, with Zod for runtime validation on read and write (passed to the base `Repository<TDocument, TEntity>` constructor — see [`repositories-conventions.md`](../../repo-architecture/backend/repositories-conventions.md)).
- **Identifiers:** UUID v4 stored as a top-level `id: string` field on every document. Mongo's auto-generated `_id` is not used as the domain identifier and is ignored by application code.
- **Timestamps:** every document carries `createdAt` and `updatedAt` (managed via Typegoose `timestamps: true`).
- **Soft delete:** `User` carries `isActive: boolean` (default `true`). No hard delete in this context — historical references from `library` and `chat` must remain resolvable.
- **Tenant scope:** the `users` collection **is** the tenant directory; it is the only collection in the platform that has no tenant filter on read. See the [Tenancy Rule](#tenancy-rule).

## Collections

| Collection | Aggregate root | Tenant-scoped? | Soft delete? |
|------------|----------------|----------------|--------------|
| `users` | `User` | No (it *is* the tenant directory) | Yes (`isActive`) |

## `users` Collection

Backs the `User` aggregate root. One document per user (= one document per tenant). Field-level invariants live in [domain-model.md#user](domain-model.md#user).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` (UUID v4) | yes | Aggregate id. The value used as `userId` everywhere else. |
| `email` | `string` | yes | Login identifier and human-facing bridge to the auth provider. Lowercased and trimmed on write. |
| `displayName` | `string` | yes | Trimmed on write; non-empty after trim. |
| `locale` | `string` (enum) | yes | Closed-set BCP 47 string. Values: see [language.md#locale](language.md#locale). |
| `authSubject` | `{ provider: string, subjectId: string }` | yes | Embedded sub-document. `provider` is one of the `AuthProvider` closed-enum values; `subjectId` is the opaque identifier minted by that provider. See [language.md#authsubject](language.md#authsubject). |
| `isActive` | `boolean` | yes | Default `true`. Soft-delete flag. |
| `createdAt` | `Date` | yes | Account-creation timestamp. |
| `updatedAt` | `Date` | yes | Last-modified timestamp. |

**Indexes:**

- `id` — unique.
- `email` — unique. *Enforces* the platform-wide `email` uniqueness invariant; also the lookup index used at session/identity-resolution time to map an authenticated user back to a `User` aggregate.
- `(authSubject.provider, authSubject.subjectId)` — compound unique. *Enforces* the invariant that the same `(provider, subjectId)` pair never maps to two different users; also the lookup index used at session/identity-resolution time when the auth provider supplies the subject id directly.

`isActive` filtering happens at the application layer; no `isActive`-bearing index pre-emptively (add only when a real query proves it necessary).

## Tenancy Rule

The `users` collection is the **tenant directory**. It is the only collection in the platform that does not require a tenant filter on read or write — there is no tenant above the user. All other collections in all other contexts must filter by `userId` (directly, via a document field) or by a parent aggregate that does.

Identity resolution at session start follows one of two paths:

- The auth provider supplies `email` only → `userRepo.findByEmail(email)`.
- The auth provider supplies `(provider, subjectId)` → `userRepo.findByAuthSubject(provider, subjectId)`.

If neither lookup finds an existing user, the application service responsible for first-login provisioning calls `userRepo.save(user)` to mint a new `User` aggregate. The `id` of the resulting user becomes the `userId` carried into every subsequent request as the tenant key.

## Repository Ports & Adapters

Per the harness convention ([`repositories-conventions.md`](../../repo-architecture/backend/repositories-conventions.md), [`add-domain-entity.md`](../../../skills/development/add-domain-entity.md)), the aggregate root gets:

- A domain port `domain/user/<entity>.repo.ts`.
- A Typegoose model `infrastructure/repositories/user/<entity>-mongo.model.ts` that `implements` the domain entity.
- An adapter `infrastructure/repositories/user/<entity>-mongo.repo.ts` that extends `Repository<TDocument, TEntity>` and `implements` the port.

| Aggregate | Port (domain) | Model (infrastructure) | Adapter (infrastructure) |
|-----------|---------------|------------------------|--------------------------|
| `User` | `user.repo.ts` | `user-mongo.model.ts` | `user-mongo.repo.ts` |

Method names speak the domain language: `getById(userId)`, `findByEmail(email)`, `findByAuthSubject(provider, subjectId)`, `save(user)`, `deactivate(userId)`. They never betray Mongo (`insertOne`, `aggregate`, …). Adapters return domain entities, never `DocumentType`s.

## Migration Plan

**Strategy: greenfield.** No production data exists; the schema is created from scratch on first deploy of every environment.

### Phase 1 — Drop legacy

No legacy. Skip.

### Phase 2 — Create new collection and indexes

Create the `users` collection with the indexes specified above. Indexes are declared via Typegoose `@prop` decorators on the model class and applied automatically by the ODM on first connect; the migration does not need to issue `createIndex` directly. Verify post-deploy with `db.users.getIndexes()` that the unique indexes are present.

| Collection | Indexes to verify |
|------------|-------------------|
| `users` | `id` unique; `email` unique; `(authSubject.provider, authSubject.subjectId)` compound unique |

### Phase 3 — Seed bootstrap users (per environment)

For local and dev environments, seed a small set of users with `authSubject.provider = "local"` and platform-minted `subjectId`s so engineers can sign in without a third-party provider hooked up. Production seeds nothing — users are provisioned on first successful authentication against the production auth provider.

Seeding lives in dedicated init scripts (not in the application server), invoked manually per environment.

### Phase 4 — Code cutover

The schema and repository ship together as a single deploy:

- Add the `User` entity and repository port under `domain/user/`.
- Add the Typegoose model and adapter under `infrastructure/repositories/user/`.
- Wire the adapter in `main/application.instances.ts`.

### Phase 5 — Cross-context cleanup

The `library` and `chat` contexts will reference the new `userId` (UUID). For greenfield this is a non-issue — those contexts also have no preserved data.

### Roll-back

Roll-back is "revert the deploy and drop the `users` collection in the rolled-back environment." There is no in-place revert.
