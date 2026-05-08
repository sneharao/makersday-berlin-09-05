# Naming Conventions

Rules for naming variables, functions, files, classes, and organising imports. Applies across the entire codebase.

## Intention-Revealing Names

Names should answer why something exists, what it does, and how it's used. If a name requires a comment to explain, it doesn't reveal its intent.

```typescript
// Good — intention is clear
const readyArtifacts = artifacts.filter(a => a.uploadStatus === 'ready');
const groundedAnswer = generateAnswer(question, libraryEmbeddings);

// Bad — requires mental mapping
const d = getData();
const res = classify(inp);
const list2 = filter(list1);
```

## Consistent Vocabulary

Pick one word per abstract concept and stick with it across the codebase. Don't mix `fetch`, `retrieve`, and `get` for the same operation. If repositories use `find`, services should not introduce `get` for the same concept.

## Solution vs Problem Domain Names

Use CS terms (`factory`, `visitor`, `queue`, `repository`) when the concept is technical. Use domain terms (`library`, `artifact`, `chatMessage`, `citation`) when the concept is domain-specific. Readers should be able to tell whether they're looking at infrastructure or business logic from the names alone.

## Avoid Noise Words

Don't add meaningless suffixes like `Data`, `Info`, or `Manager` unless they carry real semantic weight. `Library` is better than `LibraryData` when the type already represents the library.

## Casing Rules

### Variables and Functions
- Use `camelCase` for variables, functions, and methods
- Use descriptive names that clearly indicate purpose

### Classes and Interfaces
- Use `PascalCase` for class names and interfaces
- Do not prefix interfaces with `I` — use plain PascalCase (e.g., `LibraryProps`, not `ILibraryProps`). The lint rule (when ESLint is wired up) actively forbids `^I[A-Z]…` interface names.
- Suffixes like `Props`, `Args`, `Config`, `Options`, `Schema`, `State` are recommended for intent-revealing types.
- Domain models should be descriptive and domain-specific.

```typescript
export interface UploadResult {
  artifactId: string;
  storageUri: string;
}

export class CitationResolutionService {
  resolveCitations(answer: string, library: Library): Citation[] { /* ... */ }
}
```

### Constants and Enums
- Use `UPPER_SNAKE_CASE` for constants
- Use `PascalCase` for enum names, descriptive values for enum members

```typescript
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_EMBEDDINGS_MODEL = "text-embedding-3-small";

export enum UploadStatus {
  UPLOADED = "uploaded",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed",
  REMOVED = "removed",
}
```

### Files and Directories
- Use `kebab-case` for file names (e.g., `upload-artifact.service.ts`)
- Use `PascalCase` for React component directories (e.g., `LibraryCard/`)
- Use `camelCase` for utility functions and hooks

### Role Suffixes (Backend)

Backend file names encode the architectural role of the contained module. The suffix tells a reader which ring the file belongs to and how it participates in the onion + ports/adapters layout. The canonical table lives in [`harness/knowledge/repo-architecture/dependency-rules.md` § File-Naming Quick Reference](../repo-architecture/dependency-rules.md#file-naming-quick-reference); a quick recap:

| Role                        | Suffix                       | Example                                                |
|-----------------------------|------------------------------|--------------------------------------------------------|
| Entity / value object       | (none)                       | `library.ts`, `artifact.ts`, `chat-message.ts`         |
| Domain service              | `.service.ts`                | `citation-resolution.service.ts`                       |
| Application service         | `.service.ts`                | `upload-artifact.service.ts`, `create-chat.service.ts` |
| Repository port             | `.repo.ts`                   | `library.repo.ts`, `chat.repo.ts`                      |
| Repository adapter          | `.repo.ts` (tech-prefixed)   | `library-mongo.repo.ts`                                |
| ORM model                   | `.model.ts` (tech-prefixed)  | `library-mongo.model.ts`                               |
| Gateway port                | `.gateway.ts`                | `embeddings.gateway.ts`, `pdf-storage.gateway.ts`      |
| Adapter                     | `.adapter.ts`                | `openai-embeddings.adapter.ts`                         |
| DTO + co-located mappers    | `.dto.ts`                    | `library.dto.ts`, `chat.dto.ts`                        |
| Controller (driving adapter)| `.controller.ts`             | `library.controller.ts`                                |
| Domain event                | `.event.ts`                  | `artifact-uploaded.event.ts`                           |
| Per-context config          | `config.ts` (no prefix)      | `infrastructure/gateways/<context>/config.ts`          |

Notes:
- There is no generic `.port.ts` suffix — every port is either `.repo.ts` or `.gateway.ts`.
- Mappers between domain entities and DTOs are plain functions co-located with the DTO; there is no `.mapper.ts` suffix.
- The legacy `<thing>-config.ts` (dash-prefixed) form is **deprecated** in favour of `config.ts` co-located with the module that needs it.

### Private Methods
- Use the `private` keyword for private methods in classes

```typescript
export class UploadArtifactService {
  public async upload(dto: UploadArtifactRequest): Promise<ArtifactDto> {
    return this.persist(dto);
  }

  private async persist(dto: UploadArtifactRequest): Promise<ArtifactDto> {
    // ...
  }
}
```

## Import Organisation

### Path Aliases
Always use configured path aliases for imports. The architecture defines one alias per ring; the full alias table lives in `harness/knowledge/repo-architecture/overview.md` § Path Aliases. The canonical aliases are: `@backend-domain/*`, `@backend-application/*`, `@backend-infrastructure/*`, `@backend-platform/{shared,infrastructure}/*`, `@backend-main/*`, `@shared-domain/*`, `@shared-platform/*`, and `@components/*` for UI.

```typescript
// Good — ring-aliased imports
import { UploadArtifactService } from '@backend-application/library/upload-artifact.service';
import { LibraryCard } from '@components/domain/library/LibraryCard';

// Bad — relative imports across rings
import { UploadArtifactService } from '../../../backend.server/application/library/upload-artifact.service';
```

### Import Order
Organise imports in this order:
1. React and external libraries
2. React Router imports
3. Internal imports using path aliases
4. Relative imports (avoid when possible)

```typescript
// External libraries
import React, { useState, useEffect } from 'react';
import { z } from 'zod';

// React Router imports
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

// Internal imports (ring-aliased)
import { UploadArtifactService } from '@backend-application/library/upload-artifact.service';
import { Artifact } from '@backend-domain/library/artifact';
import { LibraryCard } from '@components/domain/library/LibraryCard';

// Relative imports (avoid when possible)
import './library-styles.css';
```
