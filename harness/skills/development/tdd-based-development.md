# Test-Driven Development

Use TDD when implementing new feature behaviour. This skill describes how to write tests that protect behaviour, enable safe refactoring, and avoid the brittleness that comes from testing implementation details.

The principles here are drawn from Kent Beck's *Test Driven Development: By Example* and Ian Cooper's talk *TDD, Where Did It All Go Wrong*, which re-examines Beck's original methodology and corrects common misunderstandings.

---

## Core Principle

**Test behaviours, not implementation details.**

The trigger for writing a new test is a *requirement you want to implement* — never a method you want to add to a class. A test should express what the system does for its consumers, not how it does it internally.

- **Behaviour:** "Adding two amounts in different currencies produces a correctly converted total."
- **Not behaviour:** "The `convert` method on `ExchangeRateService` is called with the correct parameters."

The system under test is the **public API of a module** — its exports, its facade — not the individual classes or helpers that make up the implementation behind it.

---

## When to Use TDD

Apply TDD when implementing **new behaviour** — a new feature, a new use case, a new business rule. This includes:

- New service methods or controller actions that fulfil a requirement
- New domain logic with meaningful branching or computation
- Bug fixes where a failing test can first reproduce the defect

**Skip TDD** for:

- Pure wiring (registering a route, adding an import, wiring DI)
- Trivial getters/setters with no logic
- UI component layout (use browser verification instead)
- Refactoring that does not change behaviour (existing tests already cover you)

---

## The Red-Green-Refactor Cycle

### 1. Red — Write a Failing Test

Write a test that describes the behaviour you are about to implement. The test name should read like a requirement:

```typescript
it("should return the total in the target currency when adding amounts in different currencies", async () => { ... });
```

Not like an implementation detail:

```typescript
it("should call exchangeRateService.convert twice", async () => { ... });
```

**Run the test and confirm it fails.** A test you have never seen fail proves nothing. The red step establishes that your test can actually detect the absence of the behaviour.

### 2. Green — Make It Pass Quickly

Get the test to pass by the fastest route possible. Write direct, inline, ugly code. Transaction scripts. Copy-paste from the internet. Hard-coded return values that you know you will replace.

The goal of this step is to **understand how to solve the problem**, not to write production-quality code. You cannot effectively do two things at once — figure out the solution and engineer clean code. So separate those concerns: solve first, engineer second.

> *"For this brief moment, speed trumps design."* — Kent Beck

### 3. Refactor — Clean Up Without New Tests

Now improve the code. Extract classes, apply patterns, remove duplication, rename, restructure. This is where clean code happens.

**Critical rule: do not write new tests during the refactoring step.**

Refactoring is defined as changing the structure of code without changing its behaviour. Your behaviour test from step 1 already covers you. If you extract a helper class, do not write a separate test for it — it is an implementation detail, free to change in the future.

If during refactoring you discover a genuinely new behaviour (a new conditional, a new public-facing capability), that signals a new requirement. Stop refactoring, go back to Red, and write a new behaviour test for it.

Use code coverage to keep yourself honest: if coverage drops during refactoring, you have likely introduced an untested conditional, which means you introduced new behaviour and need a new test.

---

## What to Test

### Test the Public Contract

The public contract of a module is its stable interface — the thing external consumers depend on. In this codebase (onion + ports/adapters), that typically means:

| Ring | What constitutes the public API |
|------|-------------------------------|
| **Domain** | Exported functions, entity methods, and domain-service methods that encode business rules with meaningful branching |
| **Application** | Public methods on an application service (e.g. `UploadArtifactService.upload(...)`) — the use-case seam |
| **Infrastructure (driving adapters)** | Public methods on a controller (e.g. `LibraryController.list(...)`) |
| **Infrastructure (driven adapters)** | The behaviour of the adapter against the real external system (a test Mongo, a sandbox embeddings/LLM provider) — covered by `.integration.test.ts` |

### Do Not Test Internals

Implementation details are everything behind the public API: private methods, extracted helper classes, internal data transformations, the specific sequence of calls between collaborators.

These must remain free to change without breaking any test. That freedom is what makes refactoring safe and cheap.

**Practical checks:**

- If you find yourself making something `public` or `export`ed solely to get it under test — stop. It is an implementation detail.
- If a test describes *how* the code works rather than *what* it achieves — rewrite it as a behaviour test or delete it.

---

## Mocking Guidance

### The Unit of Isolation Is the Test, Not the Class

A common mistake is to interpret "unit test" as "test a class in isolation by mocking all its dependencies." This leads to mock-heavy tests that are tightly coupled to implementation details and break on every refactor.

Kent Beck's original definition: unit tests should be able to run together in a suite without one test impacting another. The isolation is between *tests*, not between the class and its collaborators.

### When to Mock

Mock at the **ports** declared by the ring under test. Concretely:

- **Repository ports** (`.repo.ts`) — substitute with an in-memory or fake repo, not the real Mongo adapter
- **Gateway ports** (`.gateway.ts`) — auth providers, agents, third-party APIs
- **Unit-of-work, clock, event publisher ports** — for transaction control and determinism

The shape of the layering shows in the tests:

- **Domain** is unit-tested **without mocks** — construct objects, call methods, assert on results. If domain code needs mocks to test, it has dependencies it shouldn't have.
- **Application services** are unit-tested with **fake or in-memory port implementations** — no database, no network. If application services require a real database to test, their ports are too thin or misused.
- **Adapters** are **integration-tested** against the real external system (a test Mongo, a sandbox embeddings/LLM provider). These tests use the `.integration.test.ts` suffix.

### When Not to Mock

- **Internal collaborators within a module** — if your service calls a domain helper, let the real helper run. Mocking it couples your test to the call sequence and prevents safe refactoring.
- **To verify call sequences** — a mock that asserts "method X was called before method Y with these exact args" is testing implementation, not behaviour. Assert on the *outcome* instead.

---

## Shifting Gears

Not every piece of code demands the same level of TDD rigour. Use the gears metaphor to adjust:

### High Gear (Default)

Test the public API. Write the green step cleanly because the solution is obvious. Refactor minimally. This is your default for straightforward features.

### Standard Gear

Full red-green-refactor. Write sinful green code, then refactor thoroughly. Use when the solution is non-trivial but you know the shape of it.

### Low Gear (Probing)

When you don't know *how* to go green — the problem is unfamiliar or algorithmic — shift down. Write smaller, more granular tests to probe and explore the implementation.

**But: delete these probing tests when you are done.** They helped *you* understand the problem. They will be a maintenance burden for the next developer who needs to change the internals. Keep only the behaviour-level tests that protect the public contract.

---

## Applying to This Codebase

### Test Location and Naming

Tests will live in a parallel `tests/` tree at the repo root that mirrors `app/` (e.g. `tests/backend.server/domain/...`, `tests/backend.server/application/...`, `tests/backend.server/infrastructure/{api,repositories,gateways}/...`). Tests are **not co-located** with source. The `tests/` tree does not exist yet — the test runner has not been chosen — see [`code-standards/backend/testing.md`](../../knowledge/code-standards/backend/testing.md).

Test framework conventions (suffixes, commands, fakes, mocks) are documented in `harness/knowledge/code-standards/backend/testing.md`.

Name test files after the module or behaviour they cover:

```
tests/backend.server/domain/library/artifact-state.test.ts
tests/backend.server/application/library/upload-artifact.service.test.ts
tests/backend.server/infrastructure/api/library.controller.test.ts
tests/backend.server/infrastructure/repositories/library/library-mongo.repo.integration.test.ts
```

The `.integration.test.ts` suffix marks tests that touch real external systems (test Mongo, sandbox embeddings/LLM provider, etc.). All other tests use the plain `.test.ts` suffix.

### Where to Aim Tests

```
                          ┌────────────────────────────────────┐
                          │  infrastructure/api/ (controller)   │  driving adapter
                          │  ─ unit tested with fake services    │
                          └──────────────────┬─────────────────┘
                                             │ calls
                          ┌──────────────────▼─────────────────┐
    Tests aim here ────►  │  application/<context>/<svc>.service │  use case seam
                          │  ─ unit tested with fake/in-memory ports
                          └──────────────────┬─────────────────┘
                                             │ depends on ports
                          ┌──────────────────▼─────────────────┐
    Mock at ports ──────► │  domain ports (.repo.ts/.gateway.ts) │  ports
                          └──────────────────┬─────────────────┘
                                             │ implemented by
                          ┌──────────────────▼─────────────────┐
    Integration test ───► │  infrastructure/{repositories,gateways} driven adapters
                          │  ─ .integration.test.ts vs real systems
                          └────────────────────────────────────┘
```

- **Test at:** the controller, the application service, and exported domain logic — the public contract of each ring
- **Mock at:** the ports declared by the ring under test (`.repo.ts`, `.gateway.ts`)
- **Let run freely:** domain entities, value objects, helpers — these are implementation details of the module and should execute with real code
- **Integration test:** driven adapters against the real external system, using `.integration.test.ts`

### Test Structure

Use the given-when-then pattern to make behaviour explicit:

```typescript
describe("LibraryController", () => {
  describe("list", () => {
    it("should return only libraries belonging to the requesting user", async () => {
      // Given: two libraries exist, one for user A, one for user B
      const inMemoryLibraries = new InMemoryLibraryRepository([libraryForUserA, libraryForUserB]);
      const service = new LibraryService(inMemoryLibraries);
      const controller = new LibraryController(service);

      // When: user A requests their libraries
      const result = await controller.list({ userId: userAId });

      // Then: only user A's library is returned
      expect(result.libraries).toEqual([libraryForUserA]);
    });
  });
});
```

---

## Anti-Patterns to Avoid

| Anti-pattern | Why it hurts | What to do instead |
|---|---|---|
| Writing a test for every class extracted during refactoring | Couples tests to implementation; refactoring breaks tests | Test the behaviour through the public API only |
| Mock-heavy tests that mirror the call sequence | Tests become a brittle specification of *how*, not *what* | Mock only at architectural boundaries; assert on outcomes |
| Making internals public/exported to test them | Breaks encapsulation; exposes implementation details | Test through the module's public facade |
| Test names that describe methods (`should call X`) | Tests are unreadable and don't document requirements | Name tests after behaviours (`should return X when Y`) |
| Keeping probing/exploratory tests permanently | Burden on future developers; block refactoring | Delete probing tests once you've solved the problem |
| Skipping the red step | You can't trust a test you've never seen fail | Always run the test and confirm it fails before implementing |
| Writing new tests during refactoring | Creates unnecessary coupling to the new structure | Refactoring is covered by existing behaviour tests |

---

## Reference

- Kent Beck — *Test Driven Development: By Example* (2002)
- Ian Cooper — [*TDD, Where Did It All Go Wrong*](https://www.youtube.com/watch?v=EZ05e7EMOLM) (DevTernity Conference)
- Martin Fowler — *Refactoring: Improving the Design of Existing Code*
