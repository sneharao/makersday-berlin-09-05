# Routes Architecture

The routes directory (`app/routes/`) is the **integration layer** — it connects the backend (via the controller graph in `main/`) to the frontend (via UI components) and exposes API endpoints for client-side communication. Routes are split into two subdirectories: `pages/` and `api/`.

## Golden Rule

**Routes are consumers, not providers.** No other directory may import from route files — except `ui.client/` importing `*._sdk.ts` files for type-safe API calls. Routes import from `backend.server/main/controller.instances.ts` (for server logic) and `ui.client/` (for components), but never the reverse.

Routes are also **transport-thin**: they translate from React Router primitives (`LoaderFunctionArgs`, `ActionFunctionArgs`, form data) into a controller call and translate the response back. They do not contain business logic, do not call application services or repositories directly, and do not instantiate adapters.

## Directory Structure

```
routes/
├── pages/                   # Page routes — SSR, loaders, actions, rendering
│   ├── _index.tsx           # Root redirect (e.g. → /libraries)
│   ├── login.tsx            # Public login page
│   ├── libraries.tsx        # Library list (post-login landing)
│   ├── libraries.$libraryId.tsx        # Library detail (artifacts list)
│   ├── chats.tsx            # Chat history (sidebar / overview)
│   ├── chats.$chatId.tsx    # Single chat view
│   └── ...
│
├── api/                     # API routes + SDK files
│   ├── api.health.ts
│   ├── api.library.libraries.ts        # Server endpoint (loader/action)
│   ├── api.library.libraries._sdk.ts   # Client SDK (type-safe wrapper)
│   ├── api.library.artifacts.upload.ts
│   ├── api.library.artifacts._sdk.ts
│   ├── api.chat.chats.ts
│   ├── api.chat.chats._sdk.ts
│   ├── api.chat.messages.ts
│   ├── api.chat.messages._sdk.ts
│   └── ...
```

## Page Routes (`pages/`)

Page routes handle SSR, data loading, and rendering. Each file represents a URL in the application.

### What page routes do

1. **Loader** (server-side) — fetch data from controllers for initial page render
2. **Action** (server-side) — handle form submissions and mutations via controllers
3. **Component** (client-side) — render UI using components from `ui.client/`

### Allowed imports

| May import from                                                              | Purpose                                                |
|------------------------------------------------------------------------------|--------------------------------------------------------|
| `backend.server/main/controller.instances.ts` (alias `@backend-main/controller.instances`) | Access controllers in loaders/actions      |
| `backend.server/platform/infrastructure/route-utils/` (alias `@backend-platform/infrastructure/route-utils`) | Auth middleware, session context, handlers |
| `ui.client/components/`                                                      | Render React components                                |
| `ui.client/components/<category>/.../hooks/`, `ui.client/lib/hooks/`         | Use client-side hooks (placement per [frontend/hooks.md](./frontend/hooks.md)) |
| `shared/`                                                                    | Types, enums, validation schemas, route path constants |

**Must NOT import from:** `backend.server/domain/`, `backend.server/application/`, `backend.server/infrastructure/repositories/`, `backend.server/infrastructure/gateways/`, `backend.server/infrastructure/api/` (controllers). The only backend surface available to a route is the controller graph exported from `main/controller.instances.ts` plus the helpers under `platform/infrastructure/route-utils/`.

### Pattern

```typescript
// routes/pages/libraries.tsx
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { loginController, libraryController } from '@backend-main/controller.instances';
import { requireAuth, sessionContext } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';
import { LibrariesView } from '@components/domain/library/LibrariesView';

export const middleware = [requireAuth(loginController)];

export async function loader({ context }: LoaderFunctionArgs) {
  const ctx = context.get(sessionContext);
  const libraries = await libraryController.listLibrariesForUser(ctx.user.id);
  return { libraries };
}

export default function LibrariesPage() {
  const { libraries } = useLoaderData<typeof loader>();
  return <LibrariesView libraries={libraries} />;
}
```

### Naming conventions (flat-file routing)

- Top-level pages: `libraries.tsx`, `chats.tsx`
- Nested pages: `libraries.$libraryId.tsx` (dots = URL segments, `$` = param)
- Layouts (when needed): `app.tsx`, `app.libraries.tsx`
- Public pages: `login.tsx`, `logout.tsx`

## API Routes (`api/`)

API routes handle client-initiated HTTP requests — operations triggered by user interactions that can't go through a full page navigation (search, file upload, async actions).

For implementation patterns and code examples, see [`code-standards/backend/api-conventions.md`](../code-standards/backend/api-conventions.md). For the architectural rules around controllers (the things these routes call), see [`backend/api-conventions.md`](./backend/api-conventions.md).

### Allowed imports

| May import from                                                              | Purpose                                                |
|------------------------------------------------------------------------------|--------------------------------------------------------|
| `backend.server/main/controller.instances.ts` (alias `@backend-main/controller.instances`) | Access controllers                          |
| `backend.server/platform/infrastructure/route-utils/` (alias `@backend-platform/infrastructure/route-utils`) | `createResourceAction`, `requireParam`, effect handlers, `runEffectToResponse`, `requireAuth` middleware |
| `shared/`                                                                    | Request/response types, validation schemas             |

**Must NOT import from:** `backend.server/domain/`, `backend.server/application/`, `backend.server/infrastructure/repositories/`, `backend.server/infrastructure/gateways/`, `backend.server/infrastructure/api/` directly, `ui.client/`.

### Auth Middleware

Page routes and API routes use per-route middleware for authentication. Export a `middleware` array from the route file:

```typescript
import { loginController } from '@backend-main/controller.instances';
import { requireAuth } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';

export const middleware = [requireAuth(loginController)];
```

The middleware calls `loginController.enforceAuth()`, sets the session context, and refreshes the session cookie on the response. Loaders and actions access the authenticated user via `context.get(sessionContext)` and scope every operation to `ctx.user.id`. There is no role/permission model in Scholastic AI today (single-user app); when one is added, pass it as a second arg to `requireAuth`.

### Naming conventions

- Domain grouping: `api.<context>.<resource>.ts` (e.g., `api.library.libraries.ts`, `api.chat.messages.ts`)
- Shared resources: `api.shared.<resource>.ts` (e.g., `api.shared.auth.logout.ts`)
- Sub-actions: `api.<context>.<resource>.<action>.ts` (e.g., `api.library.artifacts.upload.ts`)

## SDK Files (`*._sdk.ts`)

SDK files are **type-safe client wrappers** for API routes. They run on the client and are imported by UI components and hooks. The `._sdk` suffix uses the pathless route convention to prevent the file from becoming a route itself.

For implementation patterns and code examples, see [`code-standards/backend/api-conventions.md`](../code-standards/backend/api-conventions.md).

### Allowed imports

| May import from                       | Purpose                                                |
|---------------------------------------|--------------------------------------------------------|
| `ui.client/lib/api-client/`           | Base fetch wrappers                                    |
| `shared/`                             | Request/response types, Zod schemas                    |
| `shared/api/`                         | API contract types shared between route and SDK        |

**Must NOT import from:** `backend.server/` (SDK files run on the client).

### Naming conventions

- File: `api.<context>.<resource>._sdk.ts` — matches the API route it wraps
- Functions: `call<Action><Resource>API` (e.g., `callCreateLibraryAPI`, `callListLibrariesAPI`, `callUploadArtifactAPI`, `callAppendChatMessageAPI`)
- One SDK per API resource — all client-callable actions for that resource are grouped in the SDK
