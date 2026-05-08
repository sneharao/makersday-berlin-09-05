# Backend Architecture

This document is the entry point for everything backend-side. The companion document [architecture-manifesto.md](./architecture-manifesto.md) states the *why*; this document and its siblings state the *what* and the *how*.

The backend is **onion architecture with ports and adapters**. Three rings of business code (`domain`, `application`, `infrastructure`), supported by a `platform/` library tier and assembled in a `main/` composition root.

## Five-piece model

```
                    ┌────────────────────────────────────────┐
                    │                  main/                 │  composition root
                    │  (only place new + process.env exist)  │
                    └──────────────────┬─────────────────────┘
                                       │ instantiates & wires
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
        ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │ infrastructure/ │  │   application/   │  │     domain/      │
        │    (adapters)   │──▶  (use cases,    ──▶ (entities, VOs,  │
        │                 │  │  DTOs, ports)    │  │ domain services)│
        │  api/           │  └────────┬─────────┘  └──────────────────┘
        │  repositories/  │           │ depends on ports
        │  gateways/      │           │
        └────────┬────────┘           │
                 │ implements ports   │
                 ▼                    │
                 ◀────────────────────┘  driven adapters fulfil ports

                              ┌──────────────────────────┐
                              │        platform/         │
                              │ ┌──────────┐ ┌────────┐  │
                              │ │  shared/ │ │ infra/ │  │
                              │ └──────────┘ └────────┘  │
                              └──────────────────────────┘
```

- **Rings** (`domain`, `application`, `infrastructure`) carry business code. Inner rings know nothing about outer rings.
- **`platform/`** is the reusable library tier — backend-generic, extraction-ready. Split into `shared/` (pure, importable everywhere) and `infrastructure/` (protocol-coupled, importable only from `infrastructure/` and `main/`).
- **`main/`** is the composition root. The single place concrete classes are named together and `process.env` is read.

## Directory Layout

```
app/backend.server/
├── domain/                                 # innermost ring
│   └── <context>/                          # e.g. user, library, chat
│       ├── <entity>.ts                     # entities & value objects (no suffix)
│       ├── <name>.service.ts               # domain services (rules across multiple entities)
│       ├── <event>.event.ts                # domain events (when introduced)
│       └── <port>.repo.ts                  # repository ports (when in ubiquitous language)
│
├── application/                            # use case ring
│   └── <context>/
│       ├── <usecase>.service.ts            # application services
│       ├── <context>.dto.ts                # DTOs + co-located mappers
│       ├── config.ts                       # application config slice
│       └── <port>.gateway.ts               # gateway ports (default location)
│
├── infrastructure/                         # adapter ring
│   ├── api/                                # driving adapters (HTTP)
│   │   └── <context>-controller.ts         # or folder <context>/ when surface grows
│   ├── repositories/                       # driven adapters: persistence
│   │   └── <context>/
│   │       ├── <entity>-mongo.model.ts     # Typegoose models
│   │       └── <entity>-mongo.repo.ts      # adapter extending Repository<T,E>
│   ├── gateways/                           # driven adapters: external systems
│   │   └── <context>/
│   │       ├── <tech>-<purpose>.adapter.ts
│   │       └── config.ts
│   ├── workers/                            # (when introduced) driving adapters: queues
│   └── cli/                                # (when introduced) driving adapters: CLIs
│
├── platform/                               # reusable backend-generic code
│   ├── shared/                             # pure in-process utilities
│   │   └── env/env-utils.ts
│   └── infrastructure/                     # protocol-coupled libs
│       ├── mongo/{client.ts, repository.ts, config.ts}
│       ├── route-utils/                    # framework middleware helpers
│       └── <system>/                       # SDK wrappers (e.g. embeddings, llm, pdf-storage)
│
└── main/                                   # composition root
    ├── run-config.ts                       # AppConfig.fromEnv()
    ├── application.instances.ts            # adapters + application services
    ├── controller.instances.ts             # controllers wired from app services
    └── entry-point.ts                      # workers/CLIs (empty in SSR app)
```

## Layer Responsibilities

| Layer                         | Purpose                                                                                                                                     | Allowed imports                                          | Forbidden                                                              |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|------------------------------------------------------------------------|
| `domain`                      | Pure business logic — entities, value objects, domain services, domain events, repository ports (when in ubiquitous language).              | `domain/`, `platform/shared/`, computation libraries     | I/O, frameworks, ORM, SDKs, gateway ports for non-domain concerns      |
| `application`                 | Use case orchestration — application services, DTOs, mappers, gateway ports (default home), unit-of-work / clock / event-publisher ports.   | `domain/`, `application/`, `platform/shared/`            | Business rules, HTTP, SDKs, `process.env`, infrastructure imports      |
| `infrastructure/api`          | Driving adapters — HTTP controllers, middleware, request/response Zod schemas. Each controller calls an application service.                | `application/`, `domain/` (types only), `platform/*`     | Direct repository/gateway/domain-service calls; `process.env`           |
| `infrastructure/repositories` | Driven adapters — persistence implementations of repository ports. Extend `Repository<TDocument, TEntity>` from `platform/infrastructure/mongo`. | `application/`, `domain/`, `platform/*`              | HTTP transport concerns; calling domain or application services         |
| `infrastructure/gateways`     | Driven adapters — implementations of gateway ports for external systems (auth, agents, third-party APIs).                                   | `application/`, `domain/` (types only), `platform/*`     | HTTP transport handlers; calling other adapters directly                |
| `platform/shared`             | Pure in-process utilities (env parsing, type helpers, functional primitives). Backend-generic and extraction-ready.                         | `platform/shared/`, computation libraries                | Anything else in the repo; collaboration libraries                     |
| `platform/infrastructure`     | Protocol-coupled library code (DB clients, framework middleware, SDK wrappers). Backend-generic.                                            | `platform/shared/`, `platform/infrastructure/`           | Importing rings; reading `process.env` outside dedicated config helpers |
| `main`                        | Composition root — wires adapters, services, controllers; reads `process.env` via `platform/shared/env/env-utils.ts`.                       | Anything                                                 | (none — but only one `main/` exists)                                   |

The complete dependency matrix lives in [../dependency-rules.md](../dependency-rules.md).

## Context Organization

Inside `domain/`, `application/`, and `infrastructure/<role>/`, code is grouped by **bounded context** at the second level:

```
domain/<context>/
application/<context>/
infrastructure/api/<context>-controller.ts        (or a folder when it grows)
infrastructure/repositories/<context>/
infrastructure/gateways/<context>/
```

**Context names are identical across rings.** If the domain calls it `library`, every ring calls it `library` — never `libraries` in one ring and `library` in another.

Some contexts have no domain entities at all. A future **embeddings-gateway** context — owning the port and adapter that talk to an LLM/embeddings provider — would be the canonical example: it would have no `domain/embeddings-gateway/` folder; the gateway port would live in `application/embeddings-gateway/` (or, more commonly, the port lives in the `library` or `chat` context's `application/` folder, and there is no separate context at all). Do not create empty `domain/<context>/` folders to maintain symmetry.

Cross-context shared code lives in `<ring>/shared/` (e.g. `application/shared/`, `infrastructure/shared/`). Create the folder only when something actually belongs there; empty `shared/` folders are not maintained proactively.

## Composition Root

`main/` is the only place concrete classes from multiple rings are named together — the only place `new` is called on infrastructure classes, the only place `process.env` is read. Staged composition splits across `main/run-config.ts`, `main/application.instances.ts`, `main/controller.instances.ts`, and `main/entry-point.ts`.

Routes (`app/routes/**`) import the controller graph from `@backend-main/controller.instances`. Full rules in [composition-root.md](./composition-root.md).

## Tests

Tests live in a parallel `tests/` tree at the repo root that mirrors `app/` (e.g. `tests/backend.server/domain/...`, `tests/backend.server/application/...`, `tests/backend.server/infrastructure/{api,repositories,gateways}/...`). The `tests/` tree does not exist yet — the test runner has not been chosen — so this is the planned layout, not the current one.

Test dependencies follow the same ring rules as source. Domain tests import only domain code and test utilities. Application tests use fake or in-memory port implementations — no real databases, no network. Adapter tests are integration tests that touch real external systems (e.g. test Mongo, sandbox LLM/embeddings provider) and are named with the `.integration.test.ts` suffix to distinguish them from unit tests.

Test framework conventions (commands, fakes, mocks, evaluation) are documented in [`code-standards/backend/testing.md`](../../code-standards/backend/testing.md).

## Non-negotiables

(Quoted verbatim from [architecture-manifesto.md](./architecture-manifesto.md) and companion conventions.)

1. **Context names are identical across rings.**
2. **Dependency rules from the dependency matrix are enforced.** Violations fail review.
3. **File suffixes match the role table.** Files without a suffix are entities or value objects.
4. **DTOs live in `application/`**, never in `infrastructure/api/`.
5. **Concrete instantiation of cross-ring classes happens only in `main/`.**
6. **`platform/shared/` contains only pure in-process computation. `platform/infrastructure/` is imported only by `infrastructure/` and `main/`.** Neither tier imports from the rest of the repo.
7. **Nothing in `infrastructure/api/` (or any driving adapter) calls a repository, gateway, or domain service directly.** It calls an application service.
8. **Collaboration libraries (DB drivers, LLM SDKs, HTTP clients, external-service SDKs) are imported only inside `infrastructure/` or `platform/infrastructure/`.** Computation libraries may be imported from any ring.

## Further Reading

| Document                                         | Topic                                                                                |
|--------------------------------------------------|--------------------------------------------------------------------------------------|
| [architecture-manifesto.md](./architecture-manifesto.md)         | The *why*: stance on onion + ports/adapters, services, DTOs, composition, tests       |
| [domain-conventions.md](./domain-conventions.md)                 | Entities, value objects, domain services, domain events, repository ports             |
| [application-conventions.md](./application-conventions.md)       | Use case services, DTOs, mappers, gateway/UoW/clock/event-publisher ports             |
| [api-conventions.md](./api-conventions.md)                       | HTTP controllers as driving adapters; HTTP-only schemas; auth middleware              |
| [repositories-conventions.md](./repositories-conventions.md)     | Mongo adapters extending `Repository<T,E>`; model/adapter naming                      |
| [gateways-conventions.md](./gateways-conventions.md)             | Gateway ports + adapters; SDK wrappers in `platform/infrastructure/`                  |
| [platform-conventions.md](./platform-conventions.md)             | `platform/shared/` vs `platform/infrastructure/`; cross-process pairing               |
| [composition-root.md](./composition-root.md)                     | `main/` staged files; `process.env` boundary; framework entry-files                   |
| [../dependency-rules.md](../dependency-rules.md)                 | Top-level + 6×6 ring dependency matrix; third-party library classification            |
| [../routes-architecture.md](../routes-architecture.md)           | How `app/routes/**` connects to the controller graph                                  |
| [../../code-standards/backend/testing.md](../../code-standards/backend/testing.md) | Test framework, ring-specific patterns, commands                                     |
