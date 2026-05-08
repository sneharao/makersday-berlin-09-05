# TypeScript & Zod Conventions

Rules for type annotations, interface definitions, Zod schemas, and TypeScript configuration.

## Function Typing

All functions must include type annotations for both parameters and return values:

```typescript
function filterReadyArtifacts(artifacts: Artifact[]): Artifact[] {
  return artifacts.filter(a => a.uploadStatus === 'ready');
}

async function fetchLibrary(userId: string, libraryId: string): Promise<Library | null> {
  return await libraryRepository.getById(userId, libraryId);
}
```

## Complex Type Annotations

```typescript
// Literal types for constrained values
function describeUploadStatus(status: 'uploaded' | 'processing' | 'ready' | 'failed' | 'removed'): string { /* ... */ }

// Function types for callbacks
function processData(data: string[], transform: (item: string) => string): string[] {
  return data.map(transform);
}

// Generic types for reusable functions
function createRepository<T>(model: new () => T): Repository<T> { /* ... */ }
```

## Interface Definitions

- Use descriptive field descriptions via JSDoc
- Provide optional properties where appropriate

```typescript
export interface ArtifactView {
  /** Artifact identifier (UUID v4) */
  id: string;
  /** Library this artifact belongs to */
  libraryId: string;
  /** Display title — defaults to source filename without extension */
  title: string;
  /** Total page count, set once processing completes */
  pageCount?: number;
  /** Whether the artifact is ready to be cited in chat */
  isReady: boolean;
}
```

## Zod Schema Conventions

Zod schemas provide runtime validation alongside TypeScript's compile-time types. Use them for all data that crosses a boundary (API requests/responses, form data, domain entities).

### When to Use

- Always provide a Zod schema for data that crosses boundaries
- Domain entities use Zod-first definitions where the type is inferred from the schema (see `repo-architecture/backend/domain-conventions.md`)
- API request/response types should have a corresponding schema

### Naming

- Domain schemas: export as `schema` (or `<Entity>Schema`) in the entity file (`backend.server/domain/<context>/<entity>.ts`, with no role suffix), and import with a descriptive alias:

```typescript
import { schema as MyEntitySchema } from "@backend-domain/my-context/my-entity";
```

- API/form schemas: use descriptive names like `UploadArtifactSchema`, `CreateChatSchema`.

### Patterns

```typescript
// Domain entity — Zod-first, type inferred
export const schema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean(),
});

export type Library = z.infer<typeof schema>;

// API request validation
export const UploadArtifactSchema = z.object({
  libraryId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  kind: z.string().min(1),
});

// Corresponding schema alongside its TS type (typically when sharing between FE and BE)
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  sequence: z.number().int().positive(),
  role: z.enum(['system', 'user', 'assistant']),
  body: z.object({
    format: z.literal('markdown'),
    text: z.string().min(1),
  }),
  citations: z.array(z.object({
    libraryId: z.string().uuid(),
    artifactId: z.string().uuid(),
    pageNumber: z.number().int().positive(),
    excerpt: z.string().optional(),
  })),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
```

### Rules

- Use `z.nativeEnum()` for TypeScript enums
- Use `satisfies` for type-safe request payloads
- Use `z.infer<typeof Schema>` to derive types from schemas — avoid duplicating the type manually

## TypeScript Configuration

Key `tsconfig.json` settings (Scholastic AI, current):
- `strict: true`
- `experimentalDecorators: true` (for Typegoose)
- `emitDecoratorMetadata: true`
- `module: ESNext` with `moduleResolution: Bundler`
- `noEmit: true` (Vite handles compilation)
- `target: ES2022`, `lib: ["DOM", "DOM.Iterable", "ES2022"]`
- Path aliases: `~/*`, `@backend-main/*`, `@backend-application/*`, `@backend-domain/*`, `@backend-infrastructure/*`, `@backend-platform/infrastructure/*`, `@backend-platform/shared/*`, `@components/*`, `@ui/*`, `@shared/*`

Rules:
- All code must pass type checking (`npm run typecheck` runs `react-router typegen && tsc --noEmit`).
- Never use `any` — define proper interfaces instead.
- Use `// @ts-expect-error` sparingly, always with an explanation.
- A test runner has not been chosen yet (see [`code-standards/backend/testing.md`](./backend/testing.md)). When one is added, document its config alongside `tsconfig.json` here.
