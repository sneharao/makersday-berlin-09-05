# Add to Shared

Add a type, enum, validation schema, or utility to `app/shared/` — the shared kernel that both frontend and backend depend on.

> **Status:** `app/shared/` does not exist yet in Scholastic AI. Create it on first use, mirroring the structure described in [`knowledge/repo-architecture/shared-kernel.md`](../../knowledge/repo-architecture/shared-kernel.md).

If your work crosses into a code category not covered by this skill (e.g. you start adding backend-specific logic while working in shared), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Prerequisites

Read these before starting:
- `harness/knowledge/repo-architecture/shared-kernel.md` — what belongs in shared, directory structure, split decision tree
- `harness/knowledge/repo-architecture/dependency-rules.md` — shared is the leaf; zero internal dependencies

---

## Step 1 — Confirm It Belongs in Shared

Apply the split decision tree before creating anything:

```
Is this code used by both frontend AND backend?
├── Yes → shared/ (continue to Step 2)
└── No
    ├── Backend only
    │   ├── Pure (no I/O, no SDK)        → backend.server/platform/shared/
    │   ├── Protocol-coupled (DB, SDK)   → backend.server/platform/infrastructure/
    │   └── Domain types                 → backend.server/domain/
    └── Frontend only                    → colocate with the component, or put in ui.client/
```

The key word is **minimal**. Not everything that _could_ be shared _should_ be shared. If only one side uses it today, put it on that side. Move it to shared later if the other side genuinely needs it.

### Things that do NOT belong in shared

| Code | Belongs in | Why |
|------|-----------|-----|
| Full entity definitions with all fields | `backend.server/domain/` | Frontend rarely needs every backend field |
| Repository ports | `backend.server/domain/` (or `application/` when no domain entity) | Only the backend uses repository abstractions |
| Gateway ports | `backend.server/application/` (default) | Only the backend orchestrates external systems |
| Typegoose/Mongoose models | `backend.server/infrastructure/repositories/` | Infrastructure concern |
| React components, hooks | `ui.client/` | Client-only code |
| Server route handlers and middleware | `backend.server/platform/infrastructure/route-utils/` | Server-only infrastructure |
| Backend-only env-var helpers | `backend.server/platform/shared/env/` | Backend-only pure helper |
| Mongo client / SDK wrappers | `backend.server/platform/infrastructure/<system>/` | Protocol-coupled backend code |

---

## Step 2 — Choose the Subdirectory

Each subdirectory in `shared/` has a specific purpose:

| Directory | What goes here | Examples |
|-----------|---------------|----------|
| `domain/<context>/` | Shared domain types, enums, validation schemas | `ArtifactStatus`, `ChatRole`, entity Zod schemas (`Library`, `Artifact`, `ChatMessage`) |
| `api/<context>/` | API contract types (request/response schemas) shared between route and SDK | `CreateLibraryRequest`, `ListLibrariesResponse`, `PostChatMessageRequest` |
| `platform/` | Cross-process pure helpers consumed by both backend and frontend (companion to `backend.server/platform/shared/`) | Pure env-shape helpers, shared pure utilities |
| `lib/transport/` | Client-server communication types | `ErrorPayload`, transport-level types |
| `lib/validation/` | Pure Zod utility helpers | Validation error formatters, schema composers |
| `lib/navigation/` | Route paths and URL builders | `librariesUrl`, `buildLibraryUrl(libraryId)`, `buildChatUrl(chatId)` |
| `utils/` | Tiny pure utility functions (keep minimal — prefer `shared/platform/` for new helpers) | Date formatting, string helpers |

**`shared/platform/` vs `backend.server/platform/shared/`:** if the helper is backend-only it lives in `backend.server/platform/shared/` and is imported as `@backend-platform/shared/...`. If the same helper is also imported by UI or routes it lives in `app/shared/platform/` and is imported as `@shared-platform/...`. Both tiers obey the same purity constraint — no protocol-coupled code, no framework imports. By construction there is no `app/shared/platform/infrastructure/`; anything cross-process must be pure because the frontend cannot run protocol-coupled backend code.

### Organisation within `domain/`

Mirror the bounded context structure used in `backend.server/domain/`:

```
shared/domain/
├── library/           # matches backend.server/domain/library/
│   ├── library.ts
│   ├── artifact.ts
│   └── artifact-status.ts
├── chat/              # matches backend.server/domain/chat/
│   ├── chat.ts
│   ├── chat-message.ts
│   └── chat-role.ts
└── user/              # matches backend.server/domain/user/
    └── user.ts
```

### Organisation within `api/`

Mirror the API route naming:

```
shared/api/
├── library/
│   └── libraries.ts   # types for api.library.libraries.ts and api.library.libraries._sdk.ts
└── chat/
    └── chats.ts       # types for api.chat.chats.ts and api.chat.chats._sdk.ts
```

---

## Step 3 — Create the File

### Enums

```typescript
// shared/domain/library/artifact-status.ts
export enum ArtifactStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}
```

### Zod schemas with inferred types

```typescript
// shared/domain/library/library.ts
import { z } from 'zod';

export const LibrarySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  created_at: z.string(),
});

export type Library = z.infer<typeof LibrarySchema>;
```

### API contract types

```typescript
// shared/api/library/libraries.ts
import { z } from 'zod';

export const CreateLibraryRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export type CreateLibraryRequest = z.infer<typeof CreateLibraryRequestSchema>;
```

---

## Step 4 — Verify Import Discipline

Shared has the strictest import rule in the codebase: **zero internal dependencies**.

### Allowed imports

- `zod` — validation schemas
- `uuid` — ID generation
- Pure external utility libraries with no side effects

### Forbidden imports

- `backend.server/` — anything (including domain, services, repos, lib)
- `ui.client/` — anything (including components, hooks, lib)
- `routes/` — anything
- `react`, `react-dom` — shared must not depend on React
- `express`, `@react-router/node` — shared must not depend on server frameworks
- `typegoose`, `mongoose` — shared must not depend on database libraries

If you find yourself needing any of these, the code does not belong in shared.

---

## Step 5 — Run Checks

Execute `harness/skills/testing/run-code-checks.md` to verify:
- `npm run typecheck` — catches type errors in schemas and exported types
- `npm run build` — catches forbidden imports that the bundler would reject
- *(planned)* `npm run lint` — once ESLint is wired up, this will catch forbidden imports (React, Express, backend internals, etc.) directly

---

## Common Patterns

### Shared subset of a backend entity

The backend owns the full entity. Shared exports only the subset both sides need:

- Full entity (all fields, server-only concerns) → `backend.server/domain/`
- Shared subset (status enum, public fields, Zod schema) → `shared/domain/`

The frontend imports the shared subset. The backend imports both.

### API contract types shared between route and SDK

When an API route and its SDK need to agree on request/response shapes:

1. Define the Zod schema and inferred type in `shared/api/<domain>/`
2. The API route imports the schema for validation
3. The SDK imports the type for the request payload

This avoids the SDK importing directly from the route file for type definitions that should be shared.

---

## Checklist

Before considering the addition complete:

- [ ] Confirmed the code is genuinely needed by both frontend and backend
- [ ] Placed in the correct subdirectory (`domain/`, `api/`, `platform/`, `lib/`, `utils/`)
- [ ] `domain/` files mirror the bounded context structure from `backend.server/domain/`
- [ ] `api/` files mirror the API route naming
- [ ] Pure cross-process helpers placed in `shared/platform/` (not `utils/`) and importable as `@shared-platform/...`
- [ ] Only external library imports (Zod, uuid) — no internal dependencies
- [ ] No React, Express, Typegoose, or other framework-specific imports
- [ ] Zod schemas export both the schema and the inferred type
- [ ] All checks pass (`typecheck`, `build`)
