# Dependency Rules

This document defines every allowed import path between the top-level application directories and the backend's internal rings. These rules are non-negotiable — every new file, import, and refactor must comply.

For the *why*, see [backend/architecture-manifesto.md](./backend/architecture-manifesto.md). For the broader layout, see [overview.md](./overview.md).

## Terminology

The backend is **onion architecture with ports and adapters**:

- **Rings** — concentric layers (`domain`, `application`, `infrastructure`) with dependencies pointing inward.
- **Ports** — interfaces declared in inner rings, implemented by outer rings. Two kinds:
  - **Repository ports** (`.repo.ts`) — collection-like abstractions over aggregate persistence; default to `domain/<context>/`, may live in `application/<context>/` when the context has no domain entities.
  - **Gateway ports** (`.gateway.ts`) — abstractions over external capabilities (auth, agents, third-party APIs); default to `application/<context>/`.
- **Adapters** — concrete implementations of ports, living in the outer (`infrastructure/`) ring:
  - **Driving adapters** push inward (controllers, workers, CLIs in `infrastructure/api/`, `infrastructure/workers/`, `infrastructure/cli/`).
  - **Driven adapters** are pushed outward by the application through ports (repositories in `infrastructure/repositories/`, gateways in `infrastructure/gateways/`).
- **`platform/`** — reusable backend-generic library tier. Two sub-tiers:
  - **`platform/shared/`** — pure in-process computation; importable by any ring.
  - **`platform/infrastructure/`** — protocol-coupled library code; importable only by `infrastructure/` and `main/`.
- **`main/`** — composition root; the only place concrete classes are named together and `process.env` is read.

## Top-Level Directory Rules

The top-level directories under `app/` form the coarsest boundary:

| Directory | May import from | Must NEVER import from |
|-----------|-----------------|-------------------------|
| `shared/` | External libs only (Zod, uuid, …) | `backend.server/`, `ui.client/`, `routes/` |
| `backend.server/` | `shared/` | `ui.client/`, `routes/` |
| `ui.client/` | `shared/`, `routes/api/*._sdk.ts` | `backend.server/` (anything `.server`) |
| `routes/pages/` | `backend.server/main/controller.instances.ts`, `backend.server/platform/infrastructure/route-utils/`, `ui.client/` components, `shared/` | `backend.server/` domain, application, infrastructure (other than via `main/`), platform/shared/infrastructure beyond route-utils |
| `routes/api/` | `backend.server/main/controller.instances.ts`, `backend.server/platform/infrastructure/route-utils/`, `shared/` | `backend.server/` domain, application, infrastructure (other than via `main/`), gateways, repositories |
| `routes/api/*._sdk.ts` | `shared/`, `ui.client/lib/` (client utilities) | `backend.server/` (SDKs run on the client) |

### Rules stated as prohibitions

1. **`shared/` is the leaf.** It has zero internal dependencies. If you are tempted to import from backend or UI into shared, the type belongs somewhere else.
2. **Backend is invisible to the frontend.** `ui.client/` must never import from `backend.server/`. The only backend surface the UI sees is indirectly through SDK files that call API routes.
3. **Routes are the integration layer, not a library.** No directory may import from `routes/` — except `ui.client/` importing `*._sdk.ts` files for type-safe API calls.
4. **Routes touch the controller graph from `main/`, not internals.** Route loaders and actions import from `main/controller.instances.ts` only. They never reach past controllers into application services, gateways, repositories, or domain directly.
5. **UI components are consumed only by routes.** No backend code may import from `ui.client/`.
6. **Routes may use route-utils.** Route files may import helper functions from `backend.server/platform/infrastructure/route-utils/` (e.g., `requireAuth`, `createResourceAction`, effect API handlers, `runEffectToResponse`, `requireParam`) in addition to controller instances. They must not import from any other backend directory.
7. **`main/controller.instances.ts` is controllers only.** This file must export only controller instances. Re-exporting application services, gateways, repositories, or config objects to satisfy the import rule is a boundary violation. If a route needs backend functionality not yet exposed, add a method to a controller.

## Backend Internal Ring Rules

Within `backend.server/`, dependencies flow strictly inward toward `domain/`. Application services depend on **ports** (interfaces); infrastructure adapters **implement** those ports; the composition root in `main/` wires them together.

```
                   driving adapters (infrastructure/api, workers, cli)
                                       │
                                       ▼
                              application services
                                  │          │
                                  ▼          ▼ (via ports)
                              domain    driven adapters (infra/repositories, infra/gateways)
                          (entities,        │
                           VOs,             ▼
                           domain svcs,    domain (interfaces & types only)
                           events,          │
                           ports)           ▼
                                       platform/infrastructure (mongo client, SDK wrappers, route-utils)
                                                │
                                                ▼
                                       platform/shared (pure helpers)
                                                │
                                                ▼
                                          shared/ (cross-process kernel)
```

### The 6×6 Ring Dependency Matrix

The complete dependency rules between rings (rows import from columns):

| From ↓ / To →             | `domain` | `application` | `infrastructure` | `platform/shared` | `platform/infrastructure` | `main` |
|---------------------------|----------|---------------|------------------|-------------------|---------------------------|--------|
| `domain`                  | ✓        | ✗             | ✗                | ✓                 | ✗                         | ✗      |
| `application`             | ✓        | ✓             | ✗                | ✓                 | ✗                         | ✗      |
| `infrastructure`          | ✓        | ✓             | ✓                | ✓                 | ✓                         | ✗      |
| `platform/shared`         | ✗        | ✗             | ✗                | ✓                 | ✗                         | ✗      |
| `platform/infrastructure` | ✗        | ✗             | ✗                | ✓                 | ✓                         | ✗      |
| `main`                    | ✓        | ✓             | ✓                | ✓                 | ✓                         | ✓      |

Reading: `domain` imports from itself and `platform/shared`. `platform/shared` imports nothing but itself. `main` imports anything. Everything else is bounded.

> **Lint exception note:** `infrastructure` includes `infrastructure/api/` (controllers), so controllers may import from `platform/infrastructure/` directly. The lint config reflects this exception explicitly.

> **Lint exception note:** `platform/infrastructure/route-utils/` is a sub-element of `platform/infrastructure/` carved out as its own lint element (`backend-route-utils`). Unlike the rest of `platform/infrastructure/`, route-utils may use **type-only** imports from `application/` and `domain/` — it needs `SessionContext` (application) and `Permissions` (domain) to type its function signatures. This mirrors the type-only-from-inner-rings pattern used by gateway and repository adapters. Routes import route-utils at `@backend-platform/infrastructure/route-utils/...`.

> **Cross-context shared-folder rule:** Each ring (`domain`, `application`, `infrastructure`) may have a `<ring>/shared/` folder for cross-context code. Create the folder only when something actually belongs there; empty `shared/` folders are not maintained proactively.

## Third-Party Dependencies

External libraries are classified by whether they mediate a conversation with something outside the process or provide pure in-process computation.

**Collaboration libraries** — talk to external systems. HTTP clients, database drivers, LLM SDKs, message bus clients, third-party service SDKs, agent frameworks. Examples: `mongodb`, `mongoose`, `@typegoose/typegoose`, `openai`, `axios`, `@sendgrid/mail`.

> Imported only inside `infrastructure/` adapters or `platform/infrastructure/` modules. They never appear in `domain/`, `application/`, `platform/shared/`, or `app/shared/`. Each such library is imported in exactly one place: the adapter that implements the relevant port (or the SDK wrapper in `platform/infrastructure/`).

**Computation libraries** — pure, in-process, no I/O. Schema validators, date math, data manipulation, functional primitives, crypto, decimal arithmetic. Examples: `zod`, `date-fns`, `lodash`, `uuid`.

> Importable from any ring.

**The swap test.** When unsure: *if this library were replaced with an equivalent alternative, would the change ripple through `application/` or `domain/` code?* If yes → collaboration → behind a port. If no → computation → import directly.

> **Logging caveat:** Logging sits on the border. Default to treating it as **collaboration** (inject a logger port and implement it in `infrastructure/` or `platform/infrastructure/`) unless the team has explicitly decided otherwise.

## File-Naming Quick Reference

| Role                  | Suffix                  | Example                                                     |
|-----------------------|-------------------------|-------------------------------------------------------------|
| Entity / value object | (none)                  | `library.ts`, `artifact.ts`, `chat-message.ts`              |
| Domain service        | `.service.ts`           | `citation-resolution.service.ts`                            |
| Application service   | `.service.ts`           | `upload-artifact.service.ts`, `create-chat.service.ts`      |
| Repository port       | `.repo.ts`              | `library.repo.ts`, `chat.repo.ts`                           |
| Repository adapter    | `.repo.ts` (tech-prefixed) | `library-mongo.repo.ts`                                 |
| ORM model             | `.model.ts` (tech-prefixed) | `library-mongo.model.ts`                               |
| Gateway port          | `.gateway.ts`           | `embeddings.gateway.ts`, `pdf-storage.gateway.ts`           |
| Adapter               | `.adapter.ts`           | `openai-embeddings.adapter.ts`, `s3-pdf-storage.adapter.ts` |
| DTO + mappers         | `.dto.ts`               | `library.dto.ts`, `chat-message.dto.ts`                     |
| Config                | `config.ts` (no prefix) | `infrastructure/gateways/<context>/config.ts`               |
| Controller            | `.controller.ts`        | `library.controller.ts`, `chat.controller.ts`               |
| Domain event          | `.event.ts`             | `artifact-uploaded.event.ts`                                |

There is no generic `.port.ts` suffix — every port is one of `.repo.ts` or `.gateway.ts`. Mappers between domain entities and DTOs are plain functions co-located with the DTO; there is no dedicated `.mapper.ts` suffix.

The legacy `<thing>.config.ts` (dash-prefixed) form is **deprecated**.

## Common Scenarios

### "I need a type in both frontend and backend"
Put it in `shared/domain/`. Both sides can import from `@shared-domain/...`.

### "I need an application service to call another context's logic"
Depend on the other context's **application service** (cross-context coordination). Never reach into another context's repository or gateway.

### "I need to add a new external integration"
1. Define the **gateway port** in `application/<context>/<port>.gateway.ts` (default) or in `domain/<context>/<port>.gateway.ts` if the abstraction is part of the ubiquitous language.
2. Implement the **adapter** in `infrastructure/gateways/<context>/<tech>-<purpose>.adapter.ts`.
3. If the adapter wraps a third-party SDK, put the raw SDK client in `platform/infrastructure/<system>/`.
4. Wire the adapter and the application service in `main/application.instances.ts`.

### "I need a utility used only on the server"
Pure, no I/O → `backend.server/platform/shared/`. Protocol-coupled → `backend.server/platform/infrastructure/`.

### "I need a pure utility used by both backend and frontend"
Put it in `app/shared/platform/`. Both sides import from `@shared-platform/...`.

### "I need a request/response type shared between an API route and its SDK"
Put it in `shared/api/<context>/`. Both the route file and the SDK file import from there. SDK files must never import from non-SDK route files.

### "I need a React hook"
Co-locate it with its callers — there is no top-level `ui.client/hooks/` folder. Walk this five-tier decision in order:

1. **Typed wrapper around `useRouteLoaderData(...)` for a parent route's loader data?** → `ui.client/lib/hooks/route-loaders/`. Exactly one hook per parent route, zero exceptions (including `app/root.tsx`). See the "Loader-data accessor hooks" section in [frontend/hooks.md](./frontend/hooks.md).
2. **Generic infrastructure** (DOM, viewport, debounce, …) **with zero domain or layout coupling?** → `ui.client/lib/hooks/`.
3. **Consumed only by route page(s)?** → `ui.client/components/<category>/<context>/hooks/` matching the route's domain.
4. **Used by exactly one component dir?** → inside that component dir at the lowest common ancestor of all callers (sibling type-only imports count).
5. **Used only within one components category subtree?** → `ui.client/components/<category>/<sub>/hooks/`.

Hooks may depend on `shared/` types, `lib/`, and `routes/api/*._sdk.ts` files. Full placement rule lives in [frontend/hooks.md](./frontend/hooks.md).

## Non-Negotiables

(Quoted from [backend/architecture-overview.md](./backend/architecture-overview.md), which mirrors `repo-architecture.md` non-negotiables. The complementary 8 non-negotiables in [backend/architecture-manifesto.md](./backend/architecture-manifesto.md#non-negotiables) cover the philosophical commitments.)

1. **Context names are identical across rings.**
2. **Dependency rules from the dependency matrix are enforced.** Violations fail review.
3. **File suffixes match the role table.** Files without a suffix are entities or value objects.
4. **DTOs live in `application/`**, never in `infrastructure/api/`.
5. **Concrete instantiation of cross-ring classes happens only in `main/`.**
6. **`platform/shared/` contains only pure in-process computation. `platform/infrastructure/` is imported only by `infrastructure/` and `main/`.** Neither tier imports from the rest of the repo.
7. **Nothing in `infrastructure/api/` (or any driving adapter) calls a repository, gateway, or domain service directly.** It calls an application service.
8. **Collaboration libraries are imported only inside `infrastructure/` or `platform/infrastructure/`.** Computation libraries may be imported from any ring.

## How These Rules Are Enforced

Architectural rules that exist only in documentation get violated. We enforce as much as possible at build time so violations fail fast — in the editor and in CI — rather than surviving to code review.

| Mechanism | What it guards | Config |
|-----------|----------------|--------|
| TypeScript strict mode | Type safety, unused vars, missing returns | `tsconfig.json` |

> **Linting status:** ESLint is **not yet wired up** for Scholastic AI. The harness ships a draft ESLint configuration under `harness/enforcement/eslint/` (boundaries between rings, no-restricted-imports for collaboration libraries, controller-thinness heuristic, etc.). It is intended to be activated when an `eslint.config.js` lands at the repo root. Until then these rules are documentation-enforced — review them in PRs.

When ESLint is activated, the table will document each programmatic guard (boundaries, no-restricted-imports/syntax/globals, max-lines-per-function for controllers, …) and the file that configures it.

### What is NOT enforced programmatically

Some rules require human or agent judgement and are enforced by convention and review:

- Whether application services use the correct port **interfaces** from domain or application (boundaries sees the directory, not the export shape).
- Intra-context layering within a single bounded context.
- Whether a controller is truly "thin" beyond the line-count heuristic.
- Whether a service named `*Service` lives in the right ring (domain vs application).
- Naming conventions and file placement within a ring.
