# Testing Standards

This document defines the testing conventions for the Scholastic AI application.

**Skill:** When writing a backend test, follow `skills/testing/write-backend-test.md`.

## Testing Philosophy

### Test to Code

Writing tests is not about verification after the fact; it's a design activity that drives better interfaces and coupling. If something is hard to test, that's a design signal — the code likely has too many dependencies or does too many things.

### FIRST Principles

Tests should be:
- **Fast** — milliseconds, not seconds
- **Independent** — no test should depend on another test's state or execution order
- **Repeatable** — same result in any environment, every time
- **Self-validating** — pass or fail with no manual interpretation
- **Timely** — written alongside or before the production code

### One Concept Per Test

Don't test multiple unrelated behaviours in a single test function. Each test should have a clear, readable failure signal that tells you exactly what broke.

### Clean Tests are as Important as Clean Code

Tests that are hard to read or maintain will be abandoned. Apply the same readability standards to test code as production code.

## Test Framework

**Runner:** [Vitest](https://vitest.dev/) (adopted as part of GR-001).

- Config: [`vitest.config.ts`](../../../../vitest.config.ts) at the repo root. Reuses `vite-tsconfig-paths` so the `@backend-*` aliases resolve in tests.
- Environment: `node` (the backend tests are platform-only; UI component tests will pick `jsdom` per file once they land).
- Test discovery: `tests/**/*.test.ts` (unit) and `tests/**/*.integration.test.ts` (integration).

Commands:

| Command | Purpose |
|---------|---------|
| `npm run test` | Run the suite once. Required to be green before merge. |
| `npm run test:watch` | Watch-mode runner — use during TDD red-green-refactor. |
| `npm run test:coverage` | Single run with V8 coverage reporter (`text` + `html`). |

## Test Directory Structure

Tests will live in a parallel `tests/` tree at the repo root that mirrors the `app/` layout. Tests are **not co-located** with source — when a UI testing tool is chosen, it may co-locate stories/specs next to components per its own convention. Test dependencies follow the same ring rules as source.

```
tests/
└── backend.server/
    ├── domain/                        # Pure unit tests — no mocks needed
    │   └── <context>/                 # one of `user/`, `library/`, `chat/`
    ├── application/                   # Unit tests with fake/in-memory port impls
    │   ├── <context>/
    │   └── shared/                    # Shared fakes / in-memory ports (when reused)
    └── infrastructure/                # Integration tests (real external systems)
        ├── api/                       # Controller integration tests (app service mocked)
        │   └── <context>/
        ├── repositories/              # Repository integration tests (real Mongo)
        │   └── <context>/
        └── gateways/                  # Gateway integration tests (real external system)
            └── <context>/
```

The corresponding tree for `ui.client/` lives at `tests/ui.client/`.

## Layer Testing Strategy

### Domain (`tests/backend.server/domain/<context>/`)

Domain tests are **pure unit tests with no mocks**. Because domain code has zero external dependencies, tests construct objects, call methods, and assert on results.

Test only the parts of a domain entity, value object, or domain service that contain code **you wrote**:

- Custom Zod `.transform(...)` and `.refine(...)` logic.
- Cross-field invariants (a `.refine` or `.superRefine` that uses two or more fields).
- Methods on the entity or value object — state transitions, formatters, comparators, equality.
- Custom parsing/normalisation in value objects.
- Domain services (pure orchestration over entities).
- **No mocking** — if you need mocks, the code likely doesn't belong in `domain/`.

#### Do not write tests whose only assertion is that a stock library combinator behaves the way the library documents

Asserting that `z.string().min(1)` rejects `""`, that `z.email()` rejects `"x"`, or that `z.enum([...])` rejects an unknown value tests Zod's contract — not yours. These tests provide no signal: they cannot fail unless Zod itself regresses, in which case Zod's own test suite (and the type system) will tell us first. They also lock in implementation choices (which combinator was used) rather than behaviour.

The schema is exercised end-to-end by the repository integration tests on every save and load — that is the only place stock validation actually fires in production, and it is the right place to cover it.

**Heuristic — the "predict the assertions" test:** if a reviewer can predict every assertion in the file by reading only the entity's Zod schema, the test file is not earning its keep. Delete it.

**Heuristic — the "anaemic record" rule:** if the entity has no methods, no `.transform(...)`, no `.refine(...)`, and no value objects with custom parsing, there is nothing to unit-test. Skip the file entirely; the integration test for the adapter is sufficient.

### Application (`tests/backend.server/application/<context>/`)

Application service tests use **fake or in-memory port implementations** — no database, no network. Because application services depend on port interfaces (gateway, repository, clock, event publisher), test doubles are straightforward.

- Substitute real adapters with fakes/in-memory implementations of the relevant ports.
- Test use-case orchestration and DTO translation.
- Verify correct delegation to ports and to domain logic.
- Test error handling at the application boundary.

> "If application services require a real database to test, their ports are too thin or misused." — `repo-architecture/backend/architecture-manifesto.md`

### Infrastructure (`tests/backend.server/infrastructure/{api,repositories,gateways}/<context>/`)

Infrastructure adapters are tested with **integration tests** against the real external system. Each subfolder mirrors its source counterpart:

- **`api/<context>-controller.integration.test.ts`** — thin integration tests that mock the application service (the controller's only collaborator) and assert request validation, argument mapping, and response shape.
- **`repositories/<context>/<entity>-mongo.repo.integration.test.ts`** — integration tests against a real (or in-memory) Mongo. Validate CRUD, the `Repository<T,E>` contract, and the model ↔ entity round-trip.
- **`gateways/<context>/<tech>-<purpose>.adapter.integration.test.ts`** — integration tests against the sandbox/test environment of the external system (e.g. PDF storage, embeddings provider, LLM provider). Validate request/response shape, error mapping, and config handling.

## Test Categories

| Category    | Suffix                  | Command                  | Timeout | External Deps                                  |
|-------------|-------------------------|--------------------------|---------|------------------------------------------------|
| Unit        | `.test.ts`              | `npm run test`           | Default | None                                           |
| Integration | `.integration.test.ts`  | `npm run test`           | 30s+    | Real external system (test DB, sandbox)        |
| Evaluation  | `.eval.test.ts`         | *(planned)*              | 5min+   | LLM/embeddings provider, eval dataset          |

> The `npm run test` command runs both unit and integration tests today; once integration runs require a longer timeout or different environment, split them into `test:unit` / `test:integration` scripts and update this table.

### Unit Tests (`.test.ts`)
- Fast execution (milliseconds).
- No external dependencies (no database, no API calls, no file system).
- Cover `domain/` (no mocks) and `application/` (fake/in-memory ports).
- Focus on pure business logic and use-case orchestration.

### Integration Tests (`.integration.test.ts`)
- Test adapters against the real external system (test Mongo, sandbox embeddings/LLM provider, etc.).
- Require environment configuration (`.env`).
- Live exclusively under `tests/backend.server/infrastructure/`.

### Evaluation Tests (`.eval.test.ts`)
- AI/LLM performance assessment (relevant once chat is grounded in embeddings).
- Use predefined datasets.
- Expensive and slow — run selectively.
- Measure accuracy/grounding metrics against thresholds.

## Test File Naming

- `{module-name}.test.ts` — unit tests (domain, application).
- `{module-name}.integration.test.ts` — integration tests (infrastructure adapters).
- `{module-name}.eval.test.ts` — evaluation tests.

## Required Test Structure

Every file should follow Arrange-Act-Assert:

```typescript
describe('Test Suite Name', () => {
  beforeEach(async () => {
    // setup
  });

  afterEach(() => {
    // teardown
  });

  it('describes what is being tested', () => {
    // Arrange

    // Act

    // Assert
    expect(1).toBe(1);
  });
});
```

## AAA Pattern

Follow **Arrange, Act, Assert** consistently:

```typescript
it('uploads an artifact into a library owned by the user', async () => {
  // Arrange
  const userId = 'user-1';
  const library = makeLibrary({ id: 'lib-1', userId });
  libraries.seed([library]);
  const request: UploadArtifactRequest = {
    userId,
    libraryId: 'lib-1',
    title: 'Paper.pdf',
    kind: 'paper',
    upload: makeUpload(),
  };

  // Act
  const dto = await uploadArtifactService.upload(request);

  // Assert
  expect(dto.libraryId).toBe('lib-1');
  expect(libraries.artifactsFor('lib-1')).toHaveLength(1);
});
```

## Mocking Guidelines

- **Avoid heavy mocking when possible** — write code that doesn't require extensive mocking.
- Use dependency injection to make testing easier.
- Prefer composition over complex mocking scenarios.
- When mocking is needed, prefer typed in-memory implementations of the port interface over per-method spies.

## Test Data

### Use `const`, Not `let`
Instantiate test resources with `const` at a high level. Do not use `let` in tests.

```typescript
// Good
const libraries = new InMemoryLibraryRepository();
const service = new UploadArtifactService(libraries, fakePdfStorage, fixedClock, noopEvents);

// Avoid
let service: UploadArtifactService;
beforeEach(() => {
  service = new UploadArtifactService(libraries, fakePdfStorage, fixedClock, noopEvents);
});
```

### Fixture Factories

Create reusable fixture factories for the core entities:

```typescript
export const makeLibrary = (overrides: Partial<Library> = {}): Library => ({
  id: 'lib-test-id',
  userId: 'user-test-id',
  name: 'Test Library',
  description: undefined,
  isActive: true,
  ...overrides,
});

export const makeArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  id: 'artifact-test-id',
  libraryId: 'lib-test-id',
  title: 'Test Artifact',
  kind: 'paper',
  uploadStatus: 'ready',
  pageCount: 12,
  uploadedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

export const makeChatMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-test-id',
  chatId: 'chat-test-id',
  sequence: 1,
  role: 'user',
  body: { format: 'markdown', text: 'hello' },
  citations: [],
  ...overrides,
});
```

## Database Access in Unit Tests

Unit tests should **not** require database access. If a test needs the database, it should be an integration test instead.

## Running Tests

For commands, see `skills/testing/run-code-checks.md`.
