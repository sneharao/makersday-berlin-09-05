# Add API Endpoint

Add a new internal API endpoint following the new four-layer pattern: Application Service → Controller (driving adapter) → API Route → SDK.

The shape of this skill follows the onion + ports-and-adapters layout. Controllers are **driving adapters** under `infrastructure/api/`; they always call an application service and never reach into repositories or domain services directly.

If your work crosses into a code category not covered by this skill (e.g. you start touching UI while in an API skill), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Prerequisites

Read these before starting:
- `harness/knowledge/repo-architecture/routes-architecture.md` — route and SDK conventions, allowed imports
- `harness/knowledge/repo-architecture/dependency-rules.md` — what routes may import; the controller-graph rule
- `harness/knowledge/repo-architecture/backend/api-conventions.md` — controllers as driving adapters; HTTP-only schemas
- `harness/knowledge/repo-architecture/backend/application-conventions.md` — application services, DTOs, mappers
- `harness/knowledge/code-standards/backend/api-conventions.md` — naming, typing, and SDK patterns

---

## Step 1 — Determine the Endpoint Shape

Before writing code, decide:

1. **Bounded context and resource**: e.g. `library.libraries`, `library.artifacts`, `chat.chats`
2. **HTTP method**: `GET` (loader), `POST/PUT/DELETE` (action)
3. **Request payload**: what the client sends (query params for GET, JSON body for POST)
4. **Response payload**: which **DTO** the application service returns

The DTO is part of the application ring. The HTTP request/response **schema** is part of the controller (`infrastructure/api/`). They are different boundaries.

---

## Step 2 — Add or Extend the Application Service

Every endpoint calls an application service. Even trivial use cases get one — the seam is where transaction boundaries, authorization, and DTO translation will eventually need to live.

If the use case doesn't exist yet, create or extend `application/<context>/<usecase>.service.ts`. The service depends on **ports** (repositories, gateways), orchestrates domain logic, and returns DTOs.

```typescript
// app/backend.server/application/library/library.service.ts
import type { LibraryRepo } from '@backend-domain/library/library.repo';
import { type LibraryDto, toLibraryDto, type CreateLibraryRequest } from './library.dto';

export class LibraryService {
  constructor(private readonly libraryRepo: LibraryRepo) {}

  async listForUser(user_id: string): Promise<LibraryDto[]> {
    const libraries = await this.libraryRepo.findByUser(user_id);
    return libraries.map(toLibraryDto);
  }

  async create(user_id: string, input: CreateLibraryRequest): Promise<LibraryDto> {
    const library = { ...input, user_id };
    const saved = await this.libraryRepo.save(library);
    return toLibraryDto(saved);
  }
}
```

Co-located DTOs and mappers (`<context>.dto.ts`):

```typescript
// app/backend.server/application/library/library.dto.ts
import { z } from 'zod';
import type { Library } from '@backend-domain/library/library';

export const CreateLibraryRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateLibraryRequest = z.infer<typeof CreateLibraryRequestSchema>;

export interface LibraryDto {
  id: string;
  name: string;
  description?: string;
}

export const toLibraryDto = (library: Library): LibraryDto => ({
  id: library.id,
  name: library.name,
  description: library.description,
});
```

### Rules

- Application services contain **no business rules** — they orchestrate. Conditionals expressing policy belong in the domain.
- Domain entities **do not** cross the application-service boundary. Use DTOs at every boundary, even if the DTO mirrors the entity 1:1 today.
- Mappers between entities and DTOs are plain functions, not classes with injected dependencies.

---

## Step 3 — Create or Update the Controller (Driving Adapter)

Controllers live under `infrastructure/api/` — they are HTTP **driving adapters**. They translate HTTP request/response shapes to/from application DTOs and call an application service. Suffix: `.controller.ts`.

```typescript
// app/backend.server/infrastructure/api/library.controller.ts
import type { LibraryService } from '@backend-application/library/library.service';
import { CreateLibraryRequestSchema } from '@backend-application/library/library.dto';

export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  async list(user_id: string) {
    return this.libraryService.listForUser(user_id);
  }

  async create(user_id: string, body: unknown) {
    const input = CreateLibraryRequestSchema.parse(body);
    return this.libraryService.create(user_id, input);
  }
}
```

### Rules

- The controller depends on the **application service** — never on a repository, gateway, or domain service directly. Direct calls past the application service are architectural bugs, not shortcuts.
- HTTP-only request/response schemas live in `infrastructure/api/` when they differ from the DTO. DTOs themselves remain in `application/<context>/`.
- Controllers are **thin** — input validation, delegation, response shaping. Aim for ≲ 15 lines per method (an ESLint rule will enforce this once lint is wired up).
- Class name ends in `Controller`.

If the controller is new, wire it in `app/backend.server/main/controller.instances.ts`:

```typescript
// app/backend.server/main/controller.instances.ts
import { LibraryController } from '@backend-infrastructure/api/library.controller';
import { buildApplicationInstances } from './application.instances';
import { AppConfig } from './run-config';

const config = AppConfig.fromEnv();
const app = buildApplicationInstances(config);

export const libraryController = new LibraryController(app.libraryService);
```

`controller.instances.ts` is the **only** file routes import to access the controller graph (the controller-graph rule from `dependency-rules.md`).

---

## Step 4 — Create the API Route

Create the server-side route handler in `app/routes/api/`. Routes are framework-owned driving adapters and import only from `@backend-main/controller.instances` and `@backend-platform/infrastructure/route-utils/`.

### File naming

`api.<context>.<resource>.ts` — e.g. `api.library.libraries.ts`, `api.chat.chats.send-message.ts`.

### Loader (GET)

```typescript
// app/routes/api/api.library.libraries.ts
import type { LoaderFunctionArgs } from 'react-router';
import { loginController, libraryController } from '@backend-main/controller.instances';
import { requireAuth, sessionContext } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';

export const middleware = [requireAuth(loginController)];

export async function loader({ context }: LoaderFunctionArgs) {
  const ctx = context.get(sessionContext);
  const libraries = await libraryController.list(ctx.user.id);
  return { libraries };
}
```

### Action (POST/PUT/DELETE)

```typescript
// app/routes/api/api.library.libraries.ts
import { loginController, libraryController } from '@backend-main/controller.instances';
import { createResourceAction } from '@backend-platform/infrastructure/route-utils/create-resource-action';
import { CreateLibraryRequestSchema, type CreateLibraryRequest } from '@backend-application/library/library.dto';
import type { SessionContext } from '@shared/domain/user/session-context';

export const action = createResourceAction({
  enforceAuth: (req) => loginController.enforceAuth(req),
  POST: {
    schema: CreateLibraryRequestSchema,
    handler: async (input: CreateLibraryRequest, ctx: SessionContext) => {
      return libraryController.create(ctx.user.id, input);
    },
  },
});
```

### Rules

- Route loaders/actions import controllers from `@backend-main/controller.instances` only — never from application services, repositories, gateways, or domain directly.
- Route utilities (`requireAuth`, `sessionContext`, `createResourceAction`, async API handlers) come from `@backend-platform/infrastructure/route-utils/`.
- Request/response types shared between route and SDK live in `app/shared/api/<context>/`. The application DTO and the shared API contract may be the same shape today; if they diverge, route files perform the translation.
- Keep route handlers thin — auth + parse + delegate.
- Scholastic AI does not yet have roles or permissions — `requireAuth` simply ensures an authenticated user; per-aggregate scoping is enforced by passing `ctx.user.id` into the controller.

---

## Step 5 — Create the SDK File

The SDK is the client-side type-safe wrapper. Sibling file with the `._sdk.ts` suffix so React Router does not treat it as a route.

```typescript
// app/routes/api/api.library.libraries._sdk.ts
import { z } from 'zod';
import { requestInternalAPI } from '@ui/lib/api-client/request-internal-api';
import { CreateLibraryRequestSchema, type CreateLibraryRequest } from '@shared/api/library/libraries';

const LibraryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
type LibraryResponse = z.infer<typeof LibraryResponseSchema>;

export function callListLibrariesAPI() {
  return requestInternalAPI<void, LibraryResponse[]>(
    '/api/library/libraries',
    'GET',
    z.array(LibraryResponseSchema),
  );
}

export function callCreateLibraryAPI(input: CreateLibraryRequest) {
  return requestInternalAPI<CreateLibraryRequest, LibraryResponse>(
    '/api/library/libraries',
    'POST',
    LibraryResponseSchema,
    input,
  );
}
```

### Rules

- SDK files run on the **client** — they may not import from `backend.server/`. (Type-only imports of application DTOs are tolerated by the lint config; prefer pulling shared shapes from `@shared/api/...`.)
- Function naming: `call<Action><Resource>API`.
- Always provide a Zod schema for response validation.
- One SDK file per API resource, grouping all actions.

---

## Step 6 — Consume in a Component, Hook, or Loader

```typescript
// In a component / hook
import { callListLibrariesAPI } from '~/routes/api/api.library.libraries._sdk';

const libraries = await callListLibrariesAPI();
```

For initial page data, prefer page-route loaders (which call controllers directly, bypassing the SDK round-trip). See `harness/skills/development/add-page-route.md`.

---

## Step 7 — Run Checks

Execute `harness/skills/testing/run-code-checks.md` to verify:
- `npm run typecheck` — catches mismatches in DTOs, controller signatures, and SDK schemas
- `npm run build` — catches bundler-level boundary violations
- *(planned)* `npm run lint` — once ESLint is wired up, this will catch ring violations (e.g. controller importing a repository, SDK importing backend code, route reaching past `controller.instances`)

---

## Checklist

Before considering the endpoint complete:

- [ ] Application service exists and orchestrates the use case (no business rules in it)
- [ ] DTOs and mappers in `application/<context>/<context>.dto.ts`
- [ ] Domain entities **never** appear in the controller or route signature
- [ ] Controller in `infrastructure/api/<context>.controller.ts` calls the application service only
- [ ] Controller class name ends in `Controller`
- [ ] Controller wired in `main/controller.instances.ts` (if new)
- [ ] API route created with correct naming (`api.<context>.<resource>.ts`)
- [ ] Route imports controllers from `@backend-main/controller.instances` and route-utils from `@backend-platform/infrastructure/route-utils/`
- [ ] Auth handled via `createResourceAction` (actions) or `requireAuth` middleware (loaders)
- [ ] SDK file created (`api.<context>.<resource>._sdk.ts`) with Zod response validation
- [ ] SDK imports from `@shared/...` (no `backend.server/` imports)
- [ ] All checks pass (`typecheck`, `build`)
