# API Conventions (Driving Adapters)

Controllers, middleware, and HTTP-only request/response schemas live in `app/backend.server/infrastructure/api/`. They are **driving adapters**: they translate from HTTP into application-service calls and back.

This document is about the architectural conventions for that layer (where files live, what they may import, what shapes go where). For the patterns and conventions used inside HTTP API code itself (response envelopes, error handling, SDK files), see [`code-standards/backend/api-conventions.md`](../../code-standards/backend/api-conventions.md). The two docs intentionally cross-link — different concerns, same word in the title.

For the *why*, see [architecture-manifesto.md](./architecture-manifesto.md). For the broader layout, see [architecture-overview.md](./architecture-overview.md).

## Structure

```
infrastructure/api/
├── <context>-controller.ts                 # single file when surface is small
└── <context>/                              # folder when surface grows
    ├── <context>.controller.ts             # main controller
    ├── <subcontroller>.controller.ts       # optional sub-controllers
    ├── request-schemas.ts                  # HTTP request Zod schemas
    └── response-schemas.ts                 # HTTP response Zod schemas
```

File suffix is `.controller.ts`; class name is `<Context>Controller`.

Driving adapters that are not HTTP — workers and CLIs — live as siblings of `api/` when introduced:

```
infrastructure/
├── api/
├── workers/
└── cli/
```

Cross-context shared infrastructure code lives in `infrastructure/shared/`. Create the folder only when something actually belongs there.

## Controllers Always Call an Application Service

Every controller method calls an application service. The recognised exceptions — health checks, pure metadata endpoints, CQRS read projections — are **explicitly narrow and rare**.

> "The API always calls an application service. Narrow exceptions — health checks, pure metadata endpoints, CQRS read projections — are recognizable and rare. **Direct repository or domain service calls from controllers are architectural bugs, not shortcuts.**" — [architecture-manifesto.md](./architecture-manifesto.md)

> "Even trivial use cases get an application service. The seam is where transaction boundaries, authorization, and DTO translation will eventually need to live. **Writing it correctly the first time is cheaper than retrofitting it when the shortcut breaks.**" — [architecture-manifesto.md](./architecture-manifesto.md)

The previous "read-only repository access from controllers" allowance is **removed**. Controllers do not import repository or gateway ports, do not import domain services, and do not call them transitively.

```ts
// infrastructure/api/library.controller.ts
import { z } from "zod";
import type { LibraryService } from "@backend-application/library/library.service";

const ListLibrariesQuerySchema = z.object({
  userId: z.string().uuid(),
});

export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  async list(rawQuery: unknown) {
    const query = ListLibrariesQuerySchema.parse(rawQuery);
    const result = await this.library.listLibrariesForUser(query.userId);
    return { libraries: result };
  }
}
```

## HTTP-Only Schemas vs DTOs

HTTP-only request/response Zod schemas live **here** (`infrastructure/api/`). Application DTOs live in `application/<context>/`.

> "If any of those shapes look like application DTOs, they are in the wrong place." — [`repo-architecture` non-negotiables]

Rule of thumb:

- A shape that describes "the JSON the wire produces or accepts" → `infrastructure/api/`.
- A shape that describes "the use-case input/output independent of transport" → `application/<context>/<context>.dto.ts`.

If the two happen to overlap structurally, that is a deliberate cost (see [application-conventions.md](./application-conventions.md#dtos-at-every-boundary)) — keep them as two separate types.

## Auth and Other Middleware

Middleware is reusable backend-generic framework glue, so it lives in `platform/infrastructure/route-utils/` (e.g. `auth-middleware.server.ts`, `create-resource-action.ts`, `require-param.ts`). Page and API routes import from `@backend-platform/infrastructure/route-utils/...`; controllers may import from there as well.

```ts
// app/routes/api/api.library.libraries.ts
import { requireAuthenticatedSession } from "@backend-platform/infrastructure/route-utils/auth-middleware.server";
import { libraryController } from "@backend-main/controller.instances";
```

## Workers and CLIs

When introduced, workers and CLIs follow the same convention:

- Live under `infrastructure/workers/<context>/` or `infrastructure/cli/<context>/`.
- Translate from their transport (queue message, argv) into an application-service call.
- Wired in `main/entry-point.ts` (or a dedicated `main/<adapter>.entry.ts`).

## Configuration

Controllers receive any HTTP-relevant config (e.g. base URLs, CORS origins) as constructor arguments. They never read `process.env`. Their config slice lives in `infrastructure/api/config.ts` if it has more than a handful of values; otherwise it is an inline `controller.instances.ts` argument.

## Tests

Controller tests are **thin integration tests** living in `tests/backend.server/infrastructure/api/<context>-controller.integration.test.ts`. They mock the application service (the controller's only collaborator) and assert that:

- Request payloads are validated and rejected on schema failure.
- Authorized callers reach the application service with correctly mapped arguments.
- Response payloads match the published HTTP schema.

See [`code-standards/backend/testing.md`](../../code-standards/backend/testing.md) for framework specifics.

## File Naming

| Role                   | Suffix                  | Example                                               |
|------------------------|-------------------------|-------------------------------------------------------|
| Controller             | `.controller.ts`        | `library.controller.ts`, `chat.controller.ts`         |
| HTTP request schemas   | (none)                  | `request-schemas.ts` inside the controller folder     |
| HTTP response schemas  | (none)                  | `response-schemas.ts` inside the controller folder    |
| Sub-controller         | `.controller.ts`        | `artifact-upload.controller.ts`                       |
| Config slice           | `config.ts` (no prefix) | `infrastructure/api/config.ts`                        |

## Allowed and Forbidden Imports

| Imports allowed                                                                  | Imports forbidden                                                          |
|----------------------------------------------------------------------------------|----------------------------------------------------------------------------|
| `@backend-application/...` (application services, DTOs)                          | `@backend-domain/...` services, repositories                                |
| `@backend-domain/...` types only (when needed for response shaping)              | `@backend-infrastructure/repositories/...`                                  |
| `@backend-platform/infrastructure/route-utils/...`                                        | `@backend-infrastructure/gateways/...`                                      |
| `@backend-platform/shared/...`                                                   | Reading `process.env`                                                       |
| Computation libraries (`zod`, `date-fns`, ...)                                    | Collaboration libraries (`mongodb`, `openai`, `axios`, `@aws-sdk/*`, ...)    |

## Cross-Reference

- The complementary file [`code-standards/backend/api-conventions.md`](../../code-standards/backend/api-conventions.md) covers HTTP API patterns at the route level (response envelopes, error handling, SDK files).
- Routes themselves are documented in [../routes-architecture.md](../routes-architecture.md).
