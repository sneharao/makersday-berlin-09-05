# Add UI Component

Add a new React component following the project's conventions for structure, typing, styling, and placement.

If your work crosses into a code category not covered by this skill (e.g. you start adding an API endpoint or domain logic while building a component), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Prerequisites

Read these before starting:
- `harness/knowledge/repo-architecture/frontend/component-conventions.md` — component categories and rules
- `harness/knowledge/repo-architecture/frontend/ui-overview.md` — UI directory structure and internal dependency rules
- `harness/knowledge/code-standards/ui/react-patterns.md` — component patterns, hooks, styling

---

## Step 1 — Choose the Category

Components live in one of three directories under `ui.client/components/`. Pick the right one:

| Category | Directory | When to use |
|----------|-----------|-------------|
| **Common** | `components/common/` | Generic, reusable primitives — no domain knowledge (Button, Modal, Table, SearchBar) |
| **Domain** | `components/domain/<context>/` | Tied to a business domain — knows about libraries, artifacts, chats, etc. |
| **Layout** | `components/layout/` | App shell structure — sidebar, navigation, menus |

If unsure: does the component know about a specific entity type (`Library`, `Artifact`, `Chat`, `ChatMessage`, `User`)? → `domain/`. Could it work in any app? → `common/`. Does it define the page frame? → `layout/`.

---

## Step 2 — Create the File Structure

Every component gets a named directory with `index.tsx` and `types.ts`:

```
components/<category>/LibraryCard/
├── index.tsx        # Component implementation and default export
└── types.ts         # Props interface and component-specific types
```

For complex components with sub-components, nest them:

```
components/domain/library/LibraryList/
├── index.tsx
├── types.ts
├── LibraryCard/
│   ├── index.tsx
│   └── types.ts
└── EmptyLibraryState/
    ├── index.tsx
    └── types.ts
```

---

## Step 3 — Define the Props Interface

Props interfaces live in `types.ts` with JSDoc on every prop.

```typescript
// components/domain/library/LibraryCard/types.ts
import type { Library } from '@shared/domain/library/library';

export interface LibraryCardProps {
  /** The library to display */
  library: Library;
  /** Callback when the card is clicked */
  onClick?: (libraryId: string) => void;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}
```

### Rules

- Use plain PascalCase — e.g. `LibraryCardProps`. Do not prefix interfaces with `I` (the lint rule will forbid `^I[A-Z]…` once ESLint is wired up).
- JSDoc every prop.
- Include `className?: string` for style composition.
- Domain components import shared types from `@shared/domain/...` (this folder will be created on first use); they must never import from `@backend-*/...`.

---

## Step 4 — Implement the Component

```typescript
// components/domain/library/LibraryCard/index.tsx
import { cn } from '~/utils/cn';
import type { LibraryCardProps } from './types';

export function LibraryCard({
  library,
  onClick,
  isLoading = false,
  className,
}: LibraryCardProps): JSX.Element {
  if (isLoading) {
    return <div className={cn('animate-pulse h-24 bg-surface-secondary rounded', className)} />;
  }

  return (
    <div
      className={cn('p-m border border-border-tertiary rounded-l hover:shadow-md transition-shadow', className)}
      onClick={() => onClick?.(library.id)}
      role="button"
      tabIndex={0}
      aria-label={`Library: ${library.name}`}
    >
      <h3 className="font-medium text-text-default">{library.name}</h3>
      {library.description && (
        <p className="text-s text-text-subtle">{library.description}</p>
      )}
    </div>
  );
}
```

### Rules

- Functional components only — no class components.
- Explicit `JSX.Element` return type.
- Default values for optional props in the destructuring.
- Handle loading and error states.
- Use `cn()` to merge className props with internal classes.
- Use Tailwind CSS for all styling — no inline styles, no CSS modules.
- Accessible: semantic HTML, `aria-label` on interactive elements, keyboard support.

---

## Step 5 — Respect Import Boundaries

Each component category has strict import rules:

### `common/` components

```
✅ design-system/         — tokens and styles
✅ co-located hooks       — component-local `useXxx.ts` or `common/.../hooks/`
✅ lib/hooks/             — cross-cutting infrastructure hooks
✅ shared/                — only non-domain shared types (effects, transport)
❌ domain/                — common must not know about business concepts
❌ backend.server/        — never
```

### `domain/` components

```
✅ common/                — reusable primitives
✅ design-system/         — tokens and styles
✅ co-located hooks       — component-local `useXxx.ts` or `domain/<context>/hooks/`
✅ lib/hooks/             — cross-cutting infrastructure hooks
✅ shared/domain/         — entity types, enums
✅ routes/api/*._sdk      — SDK functions for data fetching
❌ backend.server/        — never
❌ routes/pages/          — never
```

### `layout/` components

```
✅ common/                — reusable primitives
✅ design-system/         — tokens and styles
✅ co-located hooks       — component-local `useXxx.ts` or `layout/.../hooks/`
✅ lib/hooks/             — cross-cutting infrastructure hooks
❌ domain/                — layout should not contain domain logic
❌ backend.server/        — never
```

---

## Step 6 — Add a Custom Hook (if needed)

If the component fetches data or manages complex state, extract a hook and **co-locate it with its callers**. There is no top-level `ui.client/hooks/` folder — pick a home using the five-tier decision in [`repo-architecture/frontend/hooks.md`](../../knowledge/repo-architecture/frontend/hooks.md). For a hook used by exactly one component dir (the most common case below), the hook lives inside that component dir.

```typescript
// ui.client/components/domain/library/LibraryList/useLibraries.ts
import { useState, useEffect } from 'react';
import { callListLibrariesAPI } from '~/routes/api/api.library.libraries._sdk';
import type { Library } from '@shared/domain/library/library';

export interface UseLibrariesReturn {
  libraries: Library[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLibraries(): UseLibrariesReturn {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLibraries = async () => {
    setIsLoading(true);
    try {
      const result = await callListLibrariesAPI();
      setLibraries(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch libraries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLibraries(); }, []);

  return { libraries, isLoading, error, refetch: fetchLibraries };
}
```

### Rules

- Return a typed interface (`Use<Name>Return`).
- Include `isLoading`, `error`, and data states.
- Provide a `refetch` function.
- Pick the hook's home via the five-tier decision in [`repo-architecture/frontend/hooks.md`](../../knowledge/repo-architecture/frontend/hooks.md): typed parent-route loader-data accessor → `lib/hooks/route-loaders/`; generic infra (DOM, viewport, debounce) → `lib/hooks/`; route-only consumer → `components/<category>/<context>/hooks/`; single-component-dir → inside that dir at the LCA of all callers; multi-component within one category → `<category>/<sub>/hooks/`.

---

## Step 7 — Connect to a Page Route

Page routes in `routes/pages/` consume components. There are two data-loading patterns:

### Server-side via loader (preferred for initial page data)

```typescript
// routes/pages/libraries.tsx
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { loginController, libraryController } from '@backend-main/controller.instances';
import { requireAuth, sessionContext } from '@backend-platform/infrastructure/route-utils/auth-middleware.server';
import { LibraryList } from '@components/domain/library/LibraryList';

export const middleware = [requireAuth(loginController)];

export async function loader({ context }: LoaderFunctionArgs) {
  const ctx = context.get(sessionContext);
  const libraries = await libraryController.listLibrariesForUser(ctx.user.id);
  return { libraries };
}

export default function LibrariesPage() {
  const { libraries } = useLoaderData<typeof loader>();
  return <LibraryList libraries={libraries} />;
}
```

### Client-side via SDK (for dynamic interactions)

```typescript
// Inside a component
import { callSearchLibrariesAPI } from '~/routes/api/api.library.libraries._sdk';

const handleSearch = async (query: string) => {
  const results = await callSearchLibrariesAPI(query);
  setLibraries(results);
};
```

---

## Step 8 — Run Checks

Execute `harness/skills/testing/run-code-checks.md` to verify:
- `npm run typecheck` — catches type mismatches in props and imports
- `npm run build` — catches bundler-level boundary violations
- *(planned)* `npm run lint` — once ESLint is wired up, this will catch boundary violations (e.g. common importing domain types)

---

## Checklist

Before considering the component complete:

- [ ] Placed in the correct category (`common/`, `domain/`, or `layout/`)
- [ ] Directory structure: `ComponentName/index.tsx` + `types.ts`
- [ ] Props interface uses bare PascalCase (no `I` prefix) and JSDoc on every prop
- [ ] `className` prop accepted and merged with `cn()`
- [ ] Loading and error states handled
- [ ] Accessible: semantic HTML, aria labels, keyboard support
- [ ] Import boundaries respected (no backend imports, correct category rules)
- [ ] Domain types imported from `@shared/domain/...`, not `@backend-domain/`
- [ ] Hook extracted and placed per the five-tier rule (component-local, `<category>/hooks/`, or `lib/hooks/`) if the component manages async data
- [ ] Tailwind CSS used for all styling
- [ ] All checks pass (`typecheck`, `build`)
