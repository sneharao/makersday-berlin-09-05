# Shared Kernel

The shared directory (`app/shared/`) is the **leaf of the dependency tree** — it has zero internal dependencies. Both `backend.server/` and `ui.client/` depend on shared, but shared depends on neither.

> **Status:** `app/shared/` does not yet exist in the codebase. The first agent that needs to share a type or schema between `backend.server/` and `ui.client/` should create the folder following the layout below — do not invent a different location.

## Golden Rule

**Shared must never import from `backend.server/`, `ui.client/`, or `routes/`.** If you need to import from any of these directories, the code does not belong in shared. Move it to the appropriate owner.

Shared may only depend on external libraries: Zod (validation), uuid (ID generation), and pure utility libraries with no side effects.

## Purpose

Shared exists to centralise types, enums, validation schemas, and pure utilities that are genuinely needed by both the frontend and backend. It is the **shared kernel** in DDD terminology — the minimal set of concepts that both sides agree on.

The key word is **minimal**. Not everything that _could_ be shared _should_ be shared. If a type is only used on the backend, it belongs in `backend.server/domain/`. If a type is only used by the UI, it belongs alongside the UI component.

## Directory Structure

```
shared/
├── domain/                  # Shared domain types, enums, validation schemas
│   ├── library/
│   │   ├── library.ts       # Library entity schema (subset shared with UI)
│   │   ├── artifact.ts      # Artifact internal-entity schema
│   │   └── upload-status.ts # UploadStatus enum
│   ├── chat/
│   │   ├── chat.ts          # Chat aggregate schema (subset shared with UI)
│   │   ├── chat-message.ts  # ChatMessage internal-entity schema
│   │   ├── citation.ts      # Citation value object schema
│   │   └── message-role.ts  # MessageRole enum
│   ├── user/
│   │   └── user.ts          # User entity schema (subset shared with UI)
│   └── ...per bounded context
│
├── api/                     # API contract types (request/response schemas)
│   ├── library/
│   │   ├── libraries.ts     # ListLibrariesRequest/Response
│   │   └── artifacts.ts     # UploadArtifactRequest/Response
│   └── chat/
│       ├── chats.ts         # CreateChatRequest/Response
│       └── messages.ts      # AppendMessageRequest/Response
│
├── platform/                # Cross-process pure helpers (companion to backend.server/platform/shared/)
│   └── env/                 # e.g. shared env-shape helpers consumed by both UI and routes
│
├── lib/                     # Shared technical building blocks
│   ├── transport/           # Request/response types, error payloads
│   └── validation/          # Shared Zod utility helpers
│
└── utils/                   # Pure shared utilities (keep minimal)
```

## What Belongs in Shared

### `shared/domain/` — Shared domain types

Types and enums that both the frontend and backend need to agree on. These typically represent:

- **Status enums** — `UploadStatus`, `MessageRole` — used by both sides to render UI state and enforce business rules.
- **Validation schemas** — Zod schemas for data that crosses the network boundary (form field validation, API request/response shapes).
- **Lightweight value types** — `Citation` `(library_id, artifact_id, page_number, excerpt?)` shared between chat backend and chat UI.
- **Permission definitions** — when a non-trivial authorisation model lands; absent from Scholastic AI today (single-user per session).

Organisation: mirrors the bounded context structure used in `backend.server/domain/`. Each bounded context that has shared types gets a subdirectory.

### `shared/api/` — API contract types

Request and response types (Zod schemas and their inferred TypeScript types) for API endpoints that need to be shared between server-side route files and client-side SDK files. Organised by domain, mirroring the API route naming.

### `shared/lib/transport/` — Transport types

Types used for client-server communication:
- `ErrorPayload` — standardised error shape returned by API routes.
- Common request/response envelope types when needed.

### `shared/lib/validation/` — Validation utilities

Pure Zod utility helpers used by both frontend and backend for schema validation. No business logic — just helpers for formatting validation errors, composing schemas, etc.

### `shared/platform/` — Cross-process pure helpers

The cross-process companion to `backend.server/platform/shared/`. Pure in-process helpers consumed by **both** backend and frontend (or by `app/routes/**`) live here. Same purity constraints as `platform/shared/` — no protocol-coupled code, no framework imports, no I/O.

Decision rule:

| Helper                                                           | Lives in                                  | Alias                          |
|------------------------------------------------------------------|-------------------------------------------|--------------------------------|
| Pure, backend-only                                               | `backend.server/platform/shared/`         | `@backend-platform/shared/...` |
| Pure, used by both backend and frontend (or by `app/routes/**`) | `app/shared/platform/`                    | `@shared-platform/...`         |

By construction there is no `app/shared/platform/infrastructure/` — anything cross-process must be pure, because the frontend cannot run protocol-coupled backend code.

See [backend/platform-conventions.md](./backend/platform-conventions.md) for the full backend-side rules.

### `shared/utils/` — Pure utilities

Tiny, pure utility functions needed on both sides (e.g., date formatting, string helpers). Keep this minimal — most utilities belong in `backend.server/platform/shared/` (backend-only) or `ui.client/lib/` (client-only). New cross-process pure helpers should go in `shared/platform/` rather than expanding `shared/utils/`.

## What Does NOT Belong in Shared

| Code | Belongs in | Why |
|------|-----------|-----|
| Full entity definitions with all fields | `backend.server/domain/` | Frontend rarely needs every backend field |
| Repository ports | `backend.server/domain/` (or `application/` when no domain entity) | Only the backend uses repository abstractions |
| Gateway ports | `backend.server/application/` (default) | Only the backend orchestrates external systems |
| Typegoose models | `backend.server/infrastructure/repositories/` | Infrastructure concern |
| React components, hooks | `ui.client/` | Client-only code |
| Server route handlers and middleware | `backend.server/platform/infrastructure/route-utils/` | Server-only infrastructure |
| Backend-only env-var helpers | `backend.server/platform/shared/env/` | Backend-only pure helper |
| Cross-process pure env-var helpers | `app/shared/platform/env/` | Cross-process pure helper |
| Mongo client / SDK wrappers | `backend.server/platform/infrastructure/<system>/` | Protocol-coupled backend code |

## The Split Decision

When you have a type and aren't sure where it goes, use this decision tree:

```
Is this type used by both frontend AND backend?
├── Yes → shared/domain/ (or shared/agents/ for agent types)
└── No
    ├── Backend only → backend.server/domain/
    └── Frontend only → colocate with the component or put in ui.client/
```

For entities, a common pattern is:
- Full entity (all fields, server-only concerns) → `backend.server/domain/`
- Shared subset (status enum, public fields) → `shared/domain/`

The frontend imports the shared subset. The backend imports both.

## Shared Domain vs Backend Domain

Both directories contain domain types, but they serve different audiences:

| `shared/domain/` | `backend.server/domain/` |
|-----------------|-------------------------|
| Types needed by both FE and BE | Types needed by BE only |
| Enums, lightweight value types | Full entities, value objects, domain services, domain events |
| No infrastructure dependencies | No infrastructure dependencies |
| Imported by `ui.client/`, `app/routes/**`, and `backend.server/` | Imported by `backend.server/` only |
| No ports | Ports — repository or gateway, depending on where the abstraction lives (`domain/` or `application/`) |

`backend.server/domain/` may import from `shared/domain/` to reuse shared enums and types. The reverse is never allowed — `shared/domain/` must not import from `backend.server/domain/`.
