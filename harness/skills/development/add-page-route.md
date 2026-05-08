# Add Page Route

Add a new page route in `routes/pages/` — the integration layer that wires server-side data loading to client-side rendering.

If your work crosses into a code category not covered by this skill (e.g. you need to add an API endpoint or a domain entity while setting up a route), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Prerequisites

Read these before starting:
- `harness/knowledge/repo-architecture/routes-architecture.md` — page route conventions, naming, allowed imports
- `harness/knowledge/repo-architecture/dependency-rules.md` — what routes may import
- `harness/knowledge/code-standards/ui/react-patterns.md` — component and hook patterns used in the component function

---

## Step 1 — Decide the Route Shape

Before writing code, decide:

1. **Route type**: layout route, content page, or dynamic param page?
2. **Data loading**: does the page need a loader (server-side data fetch)?
3. **Mutations**: does the page need an action (form submission, data mutation)?
4. **Auth**: what permissions are required? (most pages need `requireAuth` middleware)

---

## Step 2 — Name and Create the File

Page routes use React Router v7 flat-file routing. The filename determines the URL structure.

### Naming conventions

| Pattern | Filename | URL |
|---------|----------|-----|
| Layout | `libraries.tsx` | `/libraries` (wraps nested pages) |
| Nested page | `libraries.$libraryId.tsx` | `/libraries/:libraryId` |
| Dynamic param | `chats_.$chatId.tsx` | `/chats/:chatId` (no parent layout) |
| Public page | `login.tsx` | `/login` |

- Dots (`.`) create URL segments
- Underscore (`_`) before `$` breaks layout nesting while keeping the URL structure
- Dollar sign (`$`) denotes a dynamic parameter

Create the file in `app/routes/pages/`.

---

## Step 3 — Add Auth Middleware

Most pages require authentication. Export a `middleware` array that uses `requireAuth`:

```typescript
import { loginController } from '@backend-main/controller.instances';
import { requireAuth } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';

export const middleware = [requireAuth(loginController)];
```

Scholastic AI is single-tenant per user — there are no roles or permissions yet. `requireAuth` simply ensures the request has an authenticated user; per-aggregate scoping is then enforced by passing `ctx.user.id` into the controller.

Public pages (login, reset-password) skip this step entirely.

---

## Step 4 — Write the Loader

Loaders run server-side before render. They fetch data via controllers and return it to the component.

```typescript
import type { LoaderFunctionArgs } from 'react-router';
import { libraryController } from '@backend-main/controller.instances';
import { sessionContext } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';

export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(sessionContext);
  const libraries = await libraryController.listLibrariesForUser(ctx.user.id);
  return { libraries };
}
```

### Rules

- Access the authenticated user via `context.get(sessionContext)` — the middleware populates it.
- Import controllers from `@backend-main/controller.instances` only — never from application services, repositories, gateways, or domain directly.
- For dynamic params, use `requireParam` to validate and extract:

```typescript
import { requireParam } from '@backend-platform/infrastructure/route-utils/require-param';
import { librariesUrl } from '@shared/lib/navigation/url-utils';

const libraryId = requireParam(params, 'libraryId', librariesUrl);
```

`requireParam` redirects to the fallback URL if the param is missing.

- Use `Promise.all` when fetching independent data sources in parallel.

---

## Step 5 — Write the Action (if needed)

Actions handle form submissions and mutations. For page-level actions (non-API), use the standard React Router action pattern:

```typescript
import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { libraryController } from '@backend-main/controller.instances';
import { sessionContext } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';

export async function action({ request, context }: ActionFunctionArgs) {
  const ctx = context.get(sessionContext);
  const formData = await request.formData();
  const name = formData.get('name') as string;

  await libraryController.createLibrary(ctx.user.id, { name });
  return redirect('/libraries');
}
```

If the mutation is triggered by a client-side interaction (not a form submission), create an API route instead — see `harness/skills/development/add-api-endpoint.md`.

---

## Step 6 — Write the Component

The default export renders the page. Keep it thin — delegate to components from `ui.client/`.

```typescript
import { useLoaderData } from 'react-router';
import { LibrariesView } from '@components/domain/library/LibrariesView';

export default function LibrariesPage() {
  const { libraries } = useLoaderData<typeof loader>();
  return <LibrariesView libraries={libraries} />;
}
```

### Rules

- Use `useLoaderData<typeof loader>()` for type-safe access to loader data.
- Import components from `ui.client/components/` — page routes should not contain significant JSX.
- Import hooks from their co-located home: `ui.client/components/<category>/<context>/hooks/` for route-only domain hooks, the relevant component dir for hooks owned by a single component, or `ui.client/lib/hooks/` for cross-cutting infrastructure (and `lib/hooks/route-loaders/` for typed parent-route loader-data accessors). See [`repo-architecture/frontend/hooks.md`](../../knowledge/repo-architecture/frontend/hooks.md) for the full five-tier rule.
- Shared types, enums, and URL builders come from `shared/`.

---

## Step 7 — Add Meta (optional)

Set the page title and description:

```typescript
import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => {
  return [
    { title: 'Libraries | Scholastic AI' },
    { name: 'description', content: 'Browse and manage your personal libraries.' },
  ];
};
```

---

## Step 8 — Run Checks

Execute `harness/skills/testing/run-code-checks.md` to verify:
- `npm run typecheck` — catches type mismatches between loader return and component consumption
- `npm run build` — catches bundler-level boundary violations
- *(planned)* `npm run lint` — once ESLint is wired up, this will catch boundary violations (e.g. importing from services directly)

---

## Allowed Imports

| May import from | Purpose |
|----------------|---------|
| `@backend-main/controller.instances` | Access controllers in loaders/actions |
| `@backend-platform/infrastructure/route-utils/` | `requireAuth`, `sessionContext`, `requireParam`, async API handlers |
| `ui.client/components/` | Render React components and their co-located hooks |
| `ui.client/components/<category>/.../hooks/`, `ui.client/lib/hooks/` | Use client-side hooks (placement per [`frontend/hooks.md`](../../knowledge/repo-architecture/frontend/hooks.md)) |
| `shared/` | Types, enums, validation schemas, URL builders |

**Must NOT import from:** `backend.server/domain/`, `backend.server/application/`, `backend.server/infrastructure/repositories/`, `backend.server/infrastructure/gateways/`, `backend.server/infrastructure/api/` (controllers — go via `controller.instances`), `routes/api/`. Routes touch the controller graph from `main/`, not internals.

---

## Checklist

Before considering the page route complete:

- [ ] File placed in `routes/pages/` with correct flat-file naming
- [ ] Auth middleware exported with appropriate permissions (or skipped for public pages)
- [ ] Loader fetches data via controllers only (no application services, repositories, or gateways)
- [ ] Session accessed via `context.get(sessionContext)`, not manual auth calls
- [ ] Dynamic params validated with `requireParam`
- [ ] Component is thin — delegates rendering to `ui.client/` components
- [ ] `useLoaderData<typeof loader>()` used for type-safe data access
- [ ] No direct imports from backend internals (domain, application, infrastructure/repositories, infrastructure/gateways)
- [ ] All checks pass (`typecheck`, `build`)
