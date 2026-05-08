# UI Architecture Overview

All client-side code lives within `app/ui.client/`. The `.client` suffix signals to React Router that this code is client-only and must never be imported by server code.

## Golden Rule

**UI code must never import from `backend.server/`.** The only way the UI communicates with the backend is through SDK files (`routes/api/*._sdk.ts`), which make HTTP calls to API routes. The UI also imports from `shared/` for types, enums, and validation schemas.

For the complete import rules, see [dependency-rules.md](../dependency-rules.md).

## Directory Structure

```
ui.client/
├── components/              # All UI components AND their co-located hooks
│   ├── common/              # Generic, domain-agnostic components (+ co-located hooks)
│   ├── domain/              # Domain-specific components (+ co-located hooks)
│   │   └── <context>/       # one of `library/`, `chat/`, `user/`
│   │       └── hooks/       # Domain-shared or route-only hooks
│   └── layout/              # App shell and navigation (+ co-located hooks)
│
├── design-system/           # Tokens, styles, visual foundation
│   ├── tokens/
│   ├── styles/
│   └── primitives/
│
├── lib/                     # (planned) Client-only utilities
│   ├── api-client/          # Base fetch wrappers
│   └── hooks/               # Cross-cutting infrastructure hooks
│       └── route-loaders/   # Typed parent-route loader-data accessors
│
└── instances.client.ts      # (planned) Client-side singleton instances
```

> **Status:** today `ui.client/` only contains `components/` and `design-system/`. The `lib/` tree and `instances.client.ts` will be created on first use; they are kept in this overview so new code lands in the right place from day one.

Hooks are placed by scope, not collected in a sibling silo. See [Hooks](./hooks.md) for the five-tier placement rule.

## Internal Dependency Rules

| UI directory | May import from |
|-------------|----------------|
| `components/common/` | `design-system/`, co-located hooks (component-local or `<category>/hooks/`), `lib/hooks/`, `shared/` |
| `components/domain/` | `components/common/`, `design-system/`, co-located hooks (component-local or `<category>/hooks/`), `lib/hooks/`, `shared/domain/`, `routes/api/*._sdk.ts` |
| `components/layout/` | `components/common/`, `design-system/`, co-located hooks (component-local or `<category>/hooks/`), `lib/hooks/` |
| `lib/hooks/` | `shared/`, `lib/`, `routes/api/*._sdk.ts` |
| `design-system/` | External CSS/styling libs only |
| `lib/` | `shared/`, external libs (Zod, etc.) |

**Must NEVER import from:** `backend.server/` (anything `.server`), `routes/pages/`.

## Client Composition Root (`instances.client.ts`) *(planned)*

When client-side singletons (an API client wrapper, a logger, a future analytics service, etc.) are added, they will be instantiated in `ui.client/instances.client.ts`. It mirrors the backend pattern of `backend.server/main/application.instances.ts`.

### Who may import from `instances.client.ts`

| Consumer | Allowed? |
|----------|----------|
| `app/root.tsx` | Yes — the app root layout owns client-side lifecycle |
| `routes/pages/` (layout routes) | Yes — route layout files may inject singleton capabilities into the component tree |
| `components/`, `lib/`, `design-system/` (including hooks under any of these) | No — if a hook or component needs a singleton capability, it should be injected via props or React context from the route/root layer |

This rule will be enforced by convention and review.

## Client Utilities (`lib/`) *(planned)*

Client-only utilities will live in `ui.client/lib/` once the first one is needed:

```
lib/
├── api-client/          # HTTP request wrappers
│   └── request-internal-api.ts
└── hooks/               # Cross-cutting infrastructure hooks
    ├── useMobileDetection.ts
    └── route-loaders/   # Typed parent-route loader-data accessors
        ├── useRootLoaderData.ts
        └── useCurrentSessionUser.ts
```

`lib/` may import from `shared/` and external libraries. It must not import from `backend.server/`, `routes/`, or other `ui.client/` directories (components, design-system). The `lib/hooks/` sub-tree is the documented home for cross-cutting hooks (generic infra) and typed parent-route loader-data accessors — see [Hooks](./hooks.md).

### API Client

The API client provides type-safe HTTP wrappers used by SDK files and hooks. SDK files (`routes/api/*._sdk.ts`) import these wrappers to make type-safe API calls. UI components and hooks never call `fetch` directly — they use SDK functions which use the API client under the hood.

## Further Reading

| Document | Covers |
|----------|--------|
| [Component Conventions](./component-conventions.md) | File structure, component categories (common/domain/layout), rules |
| [Hooks](./hooks.md) | Custom React hooks — placement, dependencies, guidelines |
| [Design System](../../code-standards/ui/design-system.md) | Design tokens, styles, visual foundation |
