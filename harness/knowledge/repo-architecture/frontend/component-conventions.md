# Component Conventions

All React components live in `ui.client/components/`, organised into three categories: `common/`, `domain/`, and `layout/`.

## File Structure

Each component lives in a named directory with an `index.tsx` entry point and a `types.ts` file:

```
SearchBar/
├── index.tsx        # Component implementation and export
└── types.ts         # Props interface and component-specific types
```

For complex components that have sub-components, nest them:

```
LibrariesView/
├── index.tsx
├── types.ts
├── LibraryGrid/
│   ├── index.tsx
│   └── types.ts
└── LibraryCard/
    ├── index.tsx
    └── types.ts
```

## `common/` — Generic, Reusable Primitives

Domain-agnostic components that could work in any application. They know nothing about libraries, chats, artifacts, or any business concept.

Examples: `Button`, `Toast`, `SearchBar`, `ErrorPage`, `Modal`, `AlertDialog`, `Select`, `Table`.

Rules:
- Must not import from `domain/` components
- Must not import domain-specific types from `shared/domain/`
- May import from `design-system/` for tokens and styles
- May import co-located hooks (component-local or `<category>/hooks/`) and `lib/hooks/` for cross-cutting infrastructure hooks (see [Hooks](./hooks.md))

## `domain/` — Business-Specific Components

Components tied to a specific bounded context. Organised by domain area, mirroring the backend's bounded context structure.

```
components/domain/
├── library/
│   ├── LibrariesView/   # List of libraries (post-login landing)
│   ├── LibraryDetail/   # Single-library view with artifact list
│   ├── ArtifactList/    # Per-library list of uploaded PDFs
│   └── common/          # Shared library components (e.g. UploadStatusChip)
├── chat/
│   ├── ChatPanel/       # Chat transcript + composer
│   ├── MessageBubble/
│   ├── CitationLink/
│   └── ChatHistoryList/
├── user/                # Login form, session/account UI
└── ...per bounded context
```

Examples: `LibraryCard`, `ArtifactList`, `UploadStatusChip`, `ChatPanel`, `MessageBubble`.

Rules:
- May import from `common/` components
- May import from `shared/domain/` for domain types and enums
- May import from SDK files (`routes/api/*._sdk.ts`) for data fetching
- Should not import from other domain areas unless explicitly composing a cross-domain view

## `layout/` — App Shell and Navigation

Structural components that define the application's frame: sidebar, navigation, menus, responsive wrappers. These are consumed by route page files to build the page shell.

```
components/layout/
├── Sidebar/
├── MobileMenu/
├── NavGroup/
├── NavItem/
└── ResponsiveNavigation/
```

Rules:
- May import from `common/` components
- May import co-located hooks (component-local or `<category>/hooks/`) and `lib/hooks/` for cross-cutting infrastructure hooks (see [Hooks](./hooks.md))
- May import from `design-system/`
- Should not contain domain-specific logic
