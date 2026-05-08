# Hooks

Custom React hooks are **co-located with their callers**, not collected in a sibling silo organised by file kind. There is no top-level `ui.client/hooks/` folder. Pick the hook's home by walking the five-tier decision below — always choose the lowest scope that contains every caller (including type-only sibling imports).

```
ui.client/
├── components/
│   ├── common/                   # generic primitives + their hooks
│   ├── layout/
│   │   └── <ComponentDir>/
│   │       └── useXxx.ts         # single-component-dir hooks live here
│   └── domain/
│       └── <context>/
│           ├── <ComponentDir>/
│           │   └── useXxx.ts     # single-component-dir hooks live here
│           └── hooks/            # category-shared OR route-only hooks for this domain
│               └── useXxx.ts
└── lib/
    └── hooks/
        ├── useXxx.ts             # cross-cutting infrastructure (DOM, viewport, debounce, …)
        └── route-loaders/        # typed parent-route loader-data accessors
            └── useXxxLoaderData.ts
```

## Where does my hook go? (five-tier decision)

Walk the questions in order; the **first** match wins.

1. **Is it a typed wrapper around `useRouteLoaderData(...)` for a parent route's loader data?** → `ui.client/lib/hooks/route-loaders/`. There is **exactly one such hook per parent route** and the convention has **zero exceptions**, even for the framework-owned `app/root.tsx`. See "Loader-data accessor hooks" below.
2. **Is it generic infrastructure** (DOM, browser, viewport, debounce, click-outside, media-query, …) **with zero domain or layout coupling?** → `ui.client/lib/hooks/`. This *generic-infra override* intentionally beats the "lowest scope" rule so infrastructure hooks aren't reflexively shoved into the first feature folder that uses them. A hook qualifies for the override only if you can describe what it does without naming any domain term, layout concept, or product concept.
3. **Is it consumed only by route page(s)?** → `components/<category>/<context>/hooks/` matching the route's domain (e.g. a hook called only from `libraries.$libraryId.tsx` lives in `components/domain/library/hooks/`). Routes are not component dirs, so there is no in-dir spot to co-locate; the matching domain folder is the lowest scope that owns the concept.
4. **Is it used by exactly one component dir?** → place it inside that component dir at the lowest common ancestor of all callers. **Sibling type-only imports count** — if `UsersTable/types.ts` imports a type the hook exports, the LCA is `UsersTable/`, not the deeper `UsersTable/UserRow/`.
5. **Is it used only within one components category subtree** (one domain context, or within `layout/`, or within `common/`)? → `components/<category>/<sub>/hooks/`.

If none of the above fit, the hook probably belongs in `shared/` or is really two hooks — reconsider before introducing a new top-level folder.

## Dependencies

- Hooks may import from `shared/` for types
- Hooks may import from SDK files (`routes/api/*._sdk.ts`) for data fetching
- Hooks may import from `lib/` for client utilities
- Hooks must not import from `backend.server/`

## Guidelines

- **One concern per hook** — each hook encapsulates a single piece of reusable stateful logic
- **Prefix with `use`** — standard React convention (`useMobileDetection`, not `mobileDetection`)
- **Keep hooks pure of UI** — hooks return data and callbacks, not JSX. If a hook needs to render something, it belongs as a component
- **Filenames stay camelCase** (`useFooBar.ts`). The lint rule covers both `app/ui.client/lib/hooks/**` and `app/ui.client/components/**/use*.{ts,tsx}`.

## Loader-data accessor hooks

When a hook or component needs data from a parent route's loader (most commonly the root route's session), it must read it through a typed accessor hook in `ui.client/lib/hooks/route-loaders/` — never call `useRouteLoaderData<T>(routeId)` directly with a hand-written `T`. React Router does not check that `T` matches the loader's actual return type, so a rename in the loader silently turns the call into `undefined` with no compile error and consumers fall through to default values.

The canonical accessors for the root route are:

- `useRootLoaderData()` — returns the full `RootLoaderDto` (defined in `shared/api/user/auth.dto.ts` so both the server loader and client hooks import the same type; `app/shared/` does not exist yet — create it on first use).
- `useCurrentSessionUser()` — returns `SessionUserDto | null`; prefer this when you only need the session user.

The route-id literal (`"root"`) and the type assertion live in exactly one hook (`useRootLoaderData.ts`) per parent route. Even `app/root.tsx`'s `Layout` consumes `useRootLoaderData()` rather than calling `useRouteLoaderData("root")` directly — the convention has zero exceptions.

When a new parent route exposes data that multiple consumers need, add a sibling accessor hook in `route-loaders/` following the same shape, and put its loader-return type in `shared/api/<context>/`.
