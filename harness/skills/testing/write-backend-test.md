# Write a Backend Test

> **Status: stub.** No backend test runner is installed yet for Scholastic AI. This file is intentionally short until a runner (Jest, Vitest, Node `node:test`, …) is chosen and wired up.

## When tooling exists

Once a runner is in `package.json`, this skill should describe end-to-end how to write each layer's tests, mirroring the directory structure in [`code-standards/backend/testing.md`](../../knowledge/code-standards/backend/testing.md):

- **Domain tests** (`tests/backend.server/domain/<context>/`) — pure unit tests, no mocks. Cover entity invariants, value-object parsing, and domain services for the `user`, `library`, and `chat` contexts.
- **Application tests** (`tests/backend.server/application/<context>/`) — fake/in-memory port implementations. Cover application services such as a future `UploadArtifactService` or `CreateChatService`.
- **Infrastructure integration tests** (`tests/backend.server/infrastructure/{api,repositories,gateways}/<context>/`) — real Mongo for repositories, real sandbox for gateways (e.g. PDF storage, embeddings, LLM completions).

## Until then

- Drive design with the FIRST principles described in [`code-standards/backend/testing.md`](../../knowledge/code-standards/backend/testing.md).
- Where helpful, document the test you *would* have written next to the production change as a code comment (`// TEST: ...`) so that adding a runner later is mechanical.
- Do **not** introduce a runner ad-hoc — flag the need in [`harness/housekeeping/debt.md`](../../housekeeping/debt.md) and choose deliberately.
