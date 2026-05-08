# Modify Domain Entity

Change an existing domain entity — add a field, rename a field, change a validation invariant, update a value object, or adjust a domain rule — while keeping all downstream layers (application, infrastructure, composition root) in sync.

If your work crosses into a code category not covered by this skill (e.g. you start touching UI while modifying a domain entity, or you need a new repository method that does not yet exist), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Prerequisites

Read these before starting:

- `harness/knowledge/domain/<context>/language.md` — ubiquitous language for the bounded context. Verify new field names / renamed terms align with it.
- `harness/knowledge/domain/<context>/domain-model.md` — entity graph, invariants, and relationships. Update this document if the model changes.
- `harness/knowledge/repo-architecture/dependency-rules.md` — ring boundaries and the 6×6 import matrix.
- `harness/knowledge/repo-architecture/backend/domain-conventions.md` — entities, value objects, repository ports.
- `harness/knowledge/repo-architecture/backend/repositories-conventions.md` — Mongo adapter pattern.
- `harness/knowledge/repo-architecture/backend/composition-root.md` — wiring in `main/`.

---

## Step 1 — Locate the entity

Find all files that implement or depend on the entity:

1. Locate the entity type in `app/backend.server/domain/<context>/<entity>.ts`.
2. Locate the repository port in `domain/<context>/<entity>.repo.ts` (or `application/<context>/`).
3. Locate the Mongo model in `infrastructure/repositories/<context>/<entity>-mongo.model.ts`.
4. Locate the repository adapter in `infrastructure/repositories/<context>/<entity>-mongo.repo.ts`.
5. Locate DTOs and mappers in `application/<context>/<context>.dto.ts`.
6. Locate the composition root entry in `main/application.instances.ts`.

Note every file that imports from the entity file — these are all potential change sites.

---

## Step 2 — Check ubiquitous language

If you are adding or renaming a field, open `harness/knowledge/domain/<context>/language.md`. Verify the new term:

- Exists in the language file with the correct definition, OR
- Does not exist yet, in which case you must add it to the language file before renaming anything in code.

Do not introduce or rename terms that are not in the language file. If a name is wrong, fix the language file first, then propagate.

---

## Step 3 — Write or extend tests first

Before touching any production code, write or update the failing tests that describe the desired behaviour:

- **Domain unit test** (if the entity has custom logic): `tests/backend.server/domain/<context>/<entity>.test.ts`. Add assertions for the new field, validation rule, or invariant. See `harness/knowledge/code-standards/backend/testing.md § Domain`.
- **Application service test** (if a use case changes): update the relevant application-layer test to reflect new inputs/outputs.
- **Integration / repository test** (if the schema changes): confirm the new field round-trips through the Mongo adapter.

Run the test suite and confirm the new/updated tests are red before continuing.

---

## Step 4 — Update the domain layer

Apply changes in strict inside-out order:

1. **Entity (`domain/<context>/<entity>.ts`)** — add/rename/remove fields or update Zod refinements. Ensure the entity remains pure (no infrastructure imports). Ensure per-user (`user_id`) scoping is preserved on every read/write path — Scholastic AI is single-tenant *per user*, so every aggregate read or write must be scoped to the requesting user (directly via `user_id`, or derived through the parent aggregate; see [`knowledge/domain/library/data-model.md` § Tenancy Rule](../../knowledge/domain/library/data-model.md#tenancy-rule)).
2. **Repository port (`domain/<context>/<entity>.repo.ts`)** — update method signatures only if the change affects how the entity is retrieved or persisted. Do not add application-level concerns to the port.
3. **Domain knowledge** — update `harness/knowledge/domain/<context>/domain-model.md` and `data-model.md` to reflect the change. Keep docs in sync with code.

---

## Step 5 — Update the infrastructure layer

With the domain layer green, update outward:

1. **Mongo model (`infrastructure/repositories/<context>/<entity>-mongo.model.ts`)** — add/rename/remove `@prop` decorators to match the updated entity. Keep `implements <DomainEntity>` — TypeScript will flag any shape mismatches.
2. **Repository adapter (`infrastructure/repositories/<context>/<entity>-mongo.repo.ts`)** — update queries, upserts, and mappers as needed. Ensure `implements <Port>` contract is still satisfied.

---

## Step 6 — Update the application layer

1. **DTOs (`application/<context>/<context>.dto.ts`)** — update the DTO type and any mapper functions to reflect the entity change.
2. **Application services** — update method signatures or implementations that consume the changed entity fields.
3. **Controllers** — update only if the HTTP contract changes (request/response shape). Keep controllers thin.

---

## Step 7 — Check for a migration requirement

If the change adds a new required field or removes an existing one:

- Existing Mongo documents in production will not have the new field (or will still have the removed field). Assess whether a data migration is needed.
- If a migration is required, **stop here** and note it in the PR body. Write a forward migration script (batched, idempotent), a verifying read, a rollback plan, and a deployment-ordering note before proceeding with the entity change.
- If the field is optional or has a safe default, document the assumption in the PR body.

---

## Step 8 — Update the composition root (if wiring changed)

If constructor signatures in the adapter or service changed, update `main/application.instances.ts`.

---

## Step 9 — Run checks

Execute `harness/skills/testing/run-code-checks.md`:

- `npm run typecheck` — catches shape mismatches across domain → model → adapter → DTO.
- `npm run build` — catches bundler-level boundary violations.
- *(planned)* `npm run lint` and `npm run test` — once the lint config and test runner are wired up, add them here.

---

## Checklist

Before marking the change complete:

- [ ] New/renamed term added to `harness/knowledge/domain/<context>/language.md` (if applicable)
- [ ] Entity type updated and remains pure (no infrastructure imports)
- [ ] Per-user (`user_id`) scoping preserved on every read/write path
- [ ] Mongo model `implements <DomainEntity>` still holds
- [ ] Repository adapter `implements <Port>` still holds
- [ ] DTOs and mappers updated
- [ ] Domain knowledge files (`domain-model.md`, `data-model.md`) reflect the change
- [ ] Migration assessed — either not needed (with documented reason) or tracked separately
- [ ] All checks pass (`typecheck`, `lint`, `test`)
