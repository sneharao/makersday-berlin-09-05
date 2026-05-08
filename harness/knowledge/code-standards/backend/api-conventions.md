# Internal API Conventions

This document defines the patterns for developing, exposing, and consuming internal APIs in the Scholastic AI application — i.e. the HTTP API code that lives at the route layer and the client-side SDKs that wrap it.

For the architectural rules around the controllers these routes call (driving adapters, request/response Zod schemas, where DTOs live), see [`repo-architecture/backend/api-conventions.md`](../../repo-architecture/backend/api-conventions.md). The two docs intentionally cross-link: this one covers HTTP API patterns at the route/SDK layer; the other covers driving-adapter conventions at the controller layer.

## Architecture

Internal APIs follow a four-layer architecture:

```
API Route (server)  →  Controller (driving adapter)  →  Application Service  →  Domain
                                ▲
                                │
SDK File (client)  ────────────┘ via HTTP
```

1. **API Route** — React Router route handler in `app/routes/api/api.*`. Imports the controller from `@backend-main/controller.instances` and route-utils from `@backend-platform/infrastructure/route-utils/...`. Translates HTTP into a controller call.
2. **Controller** — driving adapter in `backend.server/infrastructure/api/`. Validates request shape, delegates to an application service, returns a response shape.
3. **Application Service** — use-case service in `backend.server/application/`. Orchestrates domain logic and ports.
4. **SDK File** — type-safe client wrapper in `app/routes/api/api.*._sdk.ts`. Calls the API route from the browser.

## File Naming

### API Route Files
- Location: `app/routes/api/api.<context>.<resource>.<action>.ts`
- Examples: `api.library.libraries.ts`, `api.library.artifacts.upload.ts`, `api.chat.messages.append.ts`

### SDK Files
- Location: `app/routes/api/api.<context>.<resource>._sdk.ts`
- Always ends with `._sdk.ts`
- **One SDK file per resource** (not per action)
- Examples: `api.library.libraries._sdk.ts`, `api.library.artifacts._sdk.ts`, `api.chat.messages._sdk.ts`

## Server-Side Implementation

Routes use plain React Router loaders/actions plus a small route-utils helper for auth and Zod parsing. There is no Effect-TS in Scholastic AI. When a richer pattern (Effect, declarative `createResourceAction`, etc.) is adopted, this section is the single place to update.

```typescript
import type { ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { libraryController, loginController } from '@backend-main/controller.instances';
import { sessionContext } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';

const UploadArtifactSchema = z.object({
  libraryId: z.string().uuid(),
  title: z.string().min(1),
  kind: z.string().min(1),
});

export const action = async ({ request, context }: ActionFunctionArgs) => {
  await loginController.enforceAuth(request, context);
  const ctx = context.get(sessionContext);
  const body = UploadArtifactSchema.parse(await request.json());

  const dto = await libraryController.uploadArtifact({
    userId: ctx.user.id,
    libraryId: body.libraryId,
    title: body.title,
    kind: body.kind,
  });

  return Response.json(dto);
};
```

### Key Rules

- **Authenticate appropriately.** Every authenticated route calls `loginController.enforceAuth(request, context)` (or uses the shared auth middleware) and reads the session via `context.get(sessionContext)`. Scholastic AI is single-user-per-session today, so authorisation reduces to scoping every operation to `ctx.user.id`.
- **Define and export request schemas / interfaces** with descriptive names.
- **Keep routes thin** — delegate all logic to controllers/services.
- **POST/PUT/PATCH** parse JSON: `const body = UploadArtifactSchema.parse(await request.json());`.
- **GET with query params** parse URL search: `const query = Object.fromEntries(new URL(request.url).searchParams);`.

## Client-Side SDK Implementation

```typescript
import type { ArtifactDto, UploadArtifactRequest } from '@shared/api/library/artifacts';

export async function callUploadArtifactAPI(
  request: UploadArtifactRequest,
): Promise<ArtifactDto> {
  const response = await fetch('/api/library/artifacts/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as ArtifactDto;
}
```

### Function Naming
- Pattern: `call<Action><Resource>API`
- Examples: `callUploadArtifactAPI`, `callListLibrariesAPI`, `callCreateChatAPI`, `callAppendChatMessageAPI`.

### Type Safety
1. Import request/response types from `@shared/api/...` so route and SDK share the same type.
2. When `app/shared/` does not yet exist, place the type next to the SDK in a tiny `<resource>.types.ts` and migrate to `app/shared/api/` when shared types are first needed cross-process.
3. Validate the response with Zod when correctness matters more than minimal client bundle size.

> **Note:** Request/response types shared between route and SDK should live in `shared/api/`. SDK files must never import from non-SDK route files.

## Component Usage

```typescript
import { callUploadArtifactAPI } from '~/routes/api/api.library.artifacts._sdk';

useEffect(() => {
  callUploadArtifactAPI(request)
    .then(setArtifact)
    .catch((error) => {
      console.error('Upload failed', error);
      setUploadError('Upload failed. Please try again.');
    });
}, [request]);
```

## Core Implementation Files (planned)

These files will be added when the corresponding patterns land. They are listed so agents pick the right names from day one:

- `app/backend.server/platform/infrastructure/route-utils/auth-middleware.server.ts` — auth middleware factory (`requireAuth`, `sessionContext`).
- `app/backend.server/platform/infrastructure/route-utils/require-param.ts` — type-safe param extraction (`requireParam`).
- `app/backend.server/main/controller.instances.ts` — composition-root export of controller instances.
- `app/ui.client/lib/api-client/request-internal-api.ts` — client-side API wrapper (when shared fetch + Zod logic is needed).
- `app/shared/lib/transport/error-payload.ts` — standardised error shape returned by API routes.
