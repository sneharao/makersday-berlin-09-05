# Architecture Manifesto

Our stance on how we structure backend code. Not a tutorial. A statement of what we believe and why.

## The model

We use **onion architecture with ports and adapters**. Concentric rings. Dependencies point inward. Interfaces declared in inner rings, implementations provided by outer rings.

The two styles are not in tension for us. Onion gives us the layering vocabulary (domain, application, infrastructure). Hexagonal gives us the collaborator vocabulary (ports, adapters, driving vs. driven). We use both, deliberately.

## The rings

**Domain** — entities, value objects, domain services, domain events. Expresses what is true about the business. Knows nothing about HTTP, databases, message queues, agents, or the fact that a system exists.

**Application** — use case services. One per entry point. Orchestrates domain logic against the outside world. Owns transaction boundaries, use-case-level authorization, DTO translation at the application boundary.

**Infrastructure** — adapters. Everything that speaks a specific protocol: HTTP, Mongo, the chosen LLM/embeddings provider, the chosen auth provider, message buses, etc. Driving adapters push inward (API controllers, workers, CLIs). Driven adapters are pushed outward by the application (repositories, gateways).

Dependencies only point inward. An inner ring never imports from an outer ring. This is not negotiable.

## Ports

A port is an interface declared in an inner ring and implemented in an outer ring. Every port we define answers the question: *what does an inner ring need from the world that it refuses to know directly?*

- **Repository ports** — collection-like abstractions over aggregate persistence. Methods read like operations on a set (`get`, `save`, `find`), never like protocols (`send`, `invoke`). If the methods betray the mechanism, it isn't a repository.
- **Gateway ports** — abstractions over external capabilities. Classifiers, auth providers, agents, third-party APIs. Anything that is neither persistence nor pure domain.

Every repository is a port. Not every port is a repository. We use the precise word.

Driving adapters (APIs, workers, CLIs) call application services directly. The application service's public interface is its port; we do not extract a separate interface unless the use case has multiple implementations. Driven ports get explicit interfaces because the inner ring must forget which adapter exists; driving ports don't, because nothing in the inner rings depends back on the caller.

## Where ports live

Ports live in the ring that depends on them, not in a fixed "ports folder" by convention. A port consumed only by application services lives with the application. A port genuinely consumed by domain logic lives with the domain. We default to placing gateway ports in the application ring, because most external capabilities are orchestration concerns masquerading as domain concerns. We move a port into the domain only when the abstraction is part of the ubiquitous language. If a context has no domain entities and no pure business rules, it has no `domain/<context>/` folder at all; both its entities (none) and its ports live in `application/<context>/`. An external-only capability such as a future embeddings or PDF-storage gateway is the canonical example: no domain entities, ports + adapter only.

## Services — the word we are strict about

"Service" is overloaded in this space. We hold the following distinction:

**Domain services** encode business rules that span multiple entities. They take domain objects and return domain objects. They have empty or near-empty constructors. They do not depend on ports. If a "domain service" imports a repository or a gateway, it is an application service wearing the wrong label, and we move it.

**Application services** encode use cases. One per bounded context by default; multiple are allowed when a context grows enough that splitting clarifies responsibility. Application services are not required to be one-per-use-case. They depend on ports (repositories, gateways, unit of work, clock, event publisher). They orchestrate: load aggregates, invoke domain logic, persist results, publish events, return DTOs. They contain no business rules. Conditionals expressing policy inside an application service are a leak from the domain.

The split is: **application orchestrates; domain computes.** Application knows the system exists. Domain doesn't.

## Entry points

Every API endpoint, worker, and CLI command is a driving adapter. It translates from its transport (HTTP, queue message, argv) into an application service call, and translates the response back. Controllers are thin. They do not contain use case logic, and they do not call repositories or domain services directly.

**The API always calls an application service.** Narrow exceptions — health checks, pure metadata endpoints, CQRS read projections — are recognizable and rare. Direct repository or domain service calls from controllers are architectural bugs, not shortcuts.

Even trivial use cases get an application service. The seam is where transaction boundaries, authorization, and DTO translation will eventually need to live. Writing it correctly the first time is cheaper than retrofitting it when the shortcut breaks.

## DTOs at the boundary

Domain entities and value objects do not cross the API boundary. Application services accept request DTOs and return response DTOs; controllers translate between transport-specific shapes (HTTP schemas, queue payloads) and those application DTOs.

This produces some structural overlap between entities and DTOs in the short term. We accept it deliberately. The DTO layer is what lets the domain evolve without breaking API contracts, prevents accidental exposure of internal fields, and keeps entities shaped by business invariants rather than by the needs of external consumers. The overlap is not duplication — it is two separate contracts that currently happen to resemble each other and will diverge over time.

DTOs live with the use case that produces them. Mappers between entities and DTOs are mechanical functions, not classes with injected dependencies; if a mapper needs to fetch or compute, that work belongs in the application service, not the mapper.

DTOs are introduced at every application service boundary up front, not lazily on first divergence. Even where the DTO mirrors the entity 1:1 today, the type is duplicated so the boundary exists. The structural overlap stated above is the cost we accept for that contract surface.

## Composition

Composition happens at a single root, close to the process entry point. Concrete classes are instantiated there and nowhere else. No ring below the root ever calls `new` on an infrastructure class. Application and domain code declares what it needs via ports; the composition root fulfills those declarations.

This is the only place in the codebase where concrete types from multiple rings are named together. That concentration is the point.

Config follows the same inward rule. Each ring owns the config slice it consumes (application services declare what application config they need, infrastructure adapters declare their connection/credential config, platform/infrastructure modules declare their client config). The composition root aggregates these slices into a single record at process start; no ring below the root reads from `process.env`.

## Platform

`platform/` contains reusable backend-generic code that is not specific to this application's domain and is a candidate for extraction into a standalone package.

Platform splits into two tiers by the same rule we apply to third-party dependencies: **pure in-process computation** (env parsing, type helpers, functional primitives) is importable by any ring; **protocol-coupled infrastructure** (database clients, framework middleware, external-service SDK wrappers) is importable only by the infrastructure ring. The split exists because "reusable" and "technology-coupled" are different properties, and conflating them either forces ring-crossing or forces duplication of trivial utilities.

Extraction readiness is a property of this folder, not a new layer in the architecture. The inward-only dependency rule still applies — no tier of platform imports from the rest of the repo.

`platform/shared/` (backend-only pure code) has a cross-process companion at `app/shared/platform/` for pure code consumed by both backend and frontend. Decision rule: if the helper is backend-only it lives in `backend.server/platform/shared/`; if it is also imported by UI or routes it lives in `app/shared/platform/`. Both tiers obey the same purity constraint — no protocol-coupled code, no framework imports.

## Domain events

Entities and domain services produce domain events as return values. They do not publish them. Publishing is an orchestration concern and belongs to application services, which hand the event to an event publisher port. The domain does not know there is a message bus.

## Tests

The shape of the layering shows in the tests.

- Domain code is unit-tested without mocks — construct objects, call methods, assert on results.
- Application services are unit-tested with fake or in-memory port implementations. No database, no network.
- Adapters are integration-tested against the real external system (a test Mongo, a sandbox LLM/embeddings provider, etc.).

If domain code needs mocks to test, it has dependencies it shouldn't have. If application services require a real database to test, their ports are too thin or misused.

## Non-negotiables

1. Dependencies point inward. Always.
2. No infrastructure imports in domain or application code.
3. No business rules in application services.
4. No orchestration in domain services.
5. No `new` on infrastructure classes outside the composition root.
6. No HTTP shapes in the application layer. No domain entities in API responses — the boundary is crossed by DTOs, always.
7. The API calls an application service. Not a repository. Not a domain service.
8. `platform/` splits by whether its contents mediate conversations with external systems. Pure computation is importable by any ring; protocol-coupled code is not. Neither tier imports from the rest of the repo.

These rules are not style preferences. They are what keeps the rings meaningful over time. When we violate them, we do it explicitly and with a reason, not by accident.