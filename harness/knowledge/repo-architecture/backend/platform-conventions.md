# Platform Conventions

`app/backend.server/platform/` contains **reusable backend-generic code** — code that is not specific to this application's domain and is a candidate for extraction into a standalone package. It is the library tier of the backend, sitting alongside the rings rather than as one of them.

For the *why*, see [architecture-manifesto.md](./architecture-manifesto.md). For the broader layout, see [architecture-overview.md](./architecture-overview.md).

## Two-Tier Split

```
platform/
├── shared/            # pure in-process utilities — importable by any ring
└── infrastructure/    # protocol-coupled library code — importable only by infrastructure/ and main/
```

The two tiers exist because "reusable" and "technology-coupled" are different properties. Conflating them either forces ring-crossing (when a pure helper is locked behind the infrastructure tier) or forces duplication (when a protocol-coupled library is treated as importable everywhere). The split keeps each property independent.

> "The inward-only dependency rule still applies — no tier of platform imports from the rest of the repo." — [architecture-manifesto.md](./architecture-manifesto.md)

### `platform/shared/` — pure, importable by any ring

Pure in-process utilities that do not mediate conversations with external systems. Examples:

- `platform/shared/env/env-utils.ts` — pure Zod over `process.env` (no I/O; just typed reads against the env object passed in).
- Type helpers, branded types, functional primitives.
- Pure data-shape utilities.

Importable by `domain/`, `application/`, `infrastructure/`, `main/`, and other `platform/shared/` modules.

### `platform/infrastructure/` — protocol-coupled, restricted

Protocol-coupled library code. Examples:

- `platform/infrastructure/mongo/{client.ts, repository.ts, config.ts}` — Mongo client, base `Repository<T,E>`.
- SDK wrappers under `platform/infrastructure/<system>/` (added when the corresponding adapter lands — e.g. `platform/infrastructure/s3/client.ts`, `platform/infrastructure/openai/client.ts`).
- `platform/infrastructure/route-utils/` — framework middleware helpers (`auth-middleware.server.ts`, `create-resource-action.ts`, `require-param.ts`).

> `platform/infrastructure/route-utils/` is a sub-element with one extra capability over the rest of `platform/infrastructure/`: it may **type-import** `SessionContext` from `application/` and `Permissions` from `domain/` to type its function signatures. This is enforced by a dedicated `backend-route-utils` lint element (see [`../dependency-rules.md`](../dependency-rules.md) "Lint exception note"). Routes import it via `@backend-platform/infrastructure/route-utils/...`.

Importable **only** by `infrastructure/`, `main/`, and (for `route-utils/`) by `routes/`. Forbidden from `domain/`, `application/`, `platform/shared/`, and `app/shared/`.

## The "Swap Test"

Use the same test you'd use for a third-party dependency.

> "When unsure, ask: *if this library were replaced with an equivalent alternative, would the change ripple through `application/` or `domain/` code?* If yes, it is a collaboration library and must sit behind a port. If no, it is a computation library and may be imported directly." — [repo-architecture.md / architecture-manifesto.md]

Applied to platform code:

- If the helper would ripple changes into `application/` or `domain/` when its underlying mechanism is swapped → it is collaboration → `platform/infrastructure/`.
- If the helper would not ripple changes (it is pure computation against passed-in inputs) → it is computation → `platform/shared/`.

A `randomId()` helper is shared. An `envString()` parser is shared (it does no I/O — `process.env` is read by the caller and passed in). A `MongoClient` is infrastructure. An `OpenAiClient` (when added) is infrastructure.

## Cross-Process Pairing

`platform/shared/` (backend-only pure code) has a cross-process companion at **`app/shared/platform/`** for pure code consumed by both backend and frontend.

> "If the helper is backend-only it lives in `backend.server/platform/shared/`; if it is also imported by UI or routes it lives in `app/shared/platform/`. Both tiers obey the same purity constraint — no protocol-coupled code, no framework imports." — [architecture-manifesto.md](./architecture-manifesto.md)

Decision rule:

| Helper                                                           | Lives in                                                              | Alias                                  |
|------------------------------------------------------------------|-----------------------------------------------------------------------|----------------------------------------|
| Pure, backend-only                                               | `backend.server/platform/shared/`                                     | `@backend-platform/shared/...`         |
| Pure, used by both backend and frontend (or by `app/routes/**`) | `app/shared/platform/`                                                | `@shared-platform/...`                 |
| Protocol-coupled (mongo client, SDK wrappers, framework helpers) | `backend.server/platform/infrastructure/`                             | `@backend-platform/infrastructure/...` |

There is no `app/shared/platform/infrastructure/` — by construction, anything cross-process is pure, because the frontend cannot run protocol-coupled backend code.

See [../shared-kernel.md](../shared-kernel.md) for the broader rules of the shared kernel.

## Examples Mapping

| Concern                                  | Location                                              |
|------------------------------------------|-------------------------------------------------------|
| Env var parsing (pure)                   | `platform/shared/env/env-utils.ts`                    |
| Mongo client and base `Repository<T,E>`  | `platform/infrastructure/mongo/`                      |
| Object-storage SDK wrapper *(planned)*   | `platform/infrastructure/s3/client.ts`                |
| LLM/embeddings SDK wrapper *(planned)*   | `platform/infrastructure/openai/client.ts` (or whichever provider is chosen) |
| Route-utils (auth middleware, handlers)  | `platform/infrastructure/route-utils/` (alias `@backend-platform/infrastructure/route-utils/`) |
| Pure transport utilities used by routes  | `app/shared/platform/transport/`                      |

## Third-Party Dependency Classification

External libraries are classified the same way as platform code:

**Collaboration libraries** — talk to external systems. HTTP clients, database drivers, LLM SDKs, message bus clients, third-party service SDKs. Examples: `mongodb`, `mongoose`, `@typegoose/typegoose`, `openai`, `axios`, `@aws-sdk/*`, `@sendgrid/mail`.

> Imported only inside `infrastructure/` adapters or `platform/infrastructure/` modules. Never appear in `domain/`, `application/`, `platform/shared/`, or `app/shared/`. Each library is imported in exactly one place: the adapter that implements the relevant port (or the SDK wrapper in `platform/infrastructure/`).

**Computation libraries** — pure, in-process, no I/O. Schema validators, date math, data manipulation, functional primitives, crypto, decimal arithmetic. Examples: `zod`, `date-fns`, `lodash`, `uuid`.

> Importable from any ring.

**Logging caveat:** logging sits on the border between collaboration and computation. Default to treating it as **collaboration** (inject a logger port and implement it in `infrastructure/` or `platform/infrastructure/`) unless the team has explicitly decided otherwise.

The full classification rules and the dependency matrix live in [../dependency-rules.md](../dependency-rules.md).

## File Naming

| Role                          | Suffix              | Example                                              |
|-------------------------------|---------------------|------------------------------------------------------|
| Pure helper                   | (none)              | `env-utils.ts`, `branded-id.ts`                      |
| SDK wrapper / client          | `.ts` (named for the system) | `client.ts` inside `platform/infrastructure/<system>/` |
| Base class for adapters       | (none)              | `repository.ts` inside `platform/infrastructure/mongo/` |
| Route middleware              | `.server.ts`        | `auth-middleware.server.ts`                          |
| Config slice                  | `config.ts`         | `platform/infrastructure/mongo/config.ts`            |

## Allowed and Forbidden Imports

For `platform/shared/`:

| Allowed                                                  | Forbidden                                                 |
|----------------------------------------------------------|-----------------------------------------------------------|
| `platform/shared/` (other modules)                       | Anything else in the repo                                 |
| Computation libraries (`zod`, `date-fns`, ...)           | Collaboration libraries                                   |
| (no I/O, no `process.env` reads)                         | Reading `process.env`                                     |

For `platform/infrastructure/`:

| Allowed                                                  | Forbidden                                                 |
|----------------------------------------------------------|-----------------------------------------------------------|
| `platform/shared/`                                       | `domain/`, `application/`, `infrastructure/`              |
| `platform/infrastructure/` (other modules)               | Reading `process.env` outside dedicated config helpers    |
| Collaboration + computation libraries                    | Calling application services                              |

`main/` is the only place that imports from `platform/infrastructure/` and from rings simultaneously to wire them together.
