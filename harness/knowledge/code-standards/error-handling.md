# Error Handling

Error handling patterns across the codebase. Jump to the section relevant to your current layer.

## Core Principles (All Layers)

### Provide Context with Exceptions

Every exception should carry enough information to determine the source and nature of the failure: what operation was attempted and why it failed.

### Don't Return Null

Returning null forces every caller to add a null check, and one missed check is a runtime crash. Return empty collections, use the Null Object pattern, or throw.

### Don't Pass Null

Don't accept null as an argument unless the API explicitly allows it. Forbid it and fail fast.

### Define Exception Classes by Caller Need

Don't create one exception per possible failure cause. Group them by how the *caller* needs to react (e.g., `NotFoundError`, `ValidationError`, `ConflictError`).

### Fail Fast at System Boundaries

Validate all input at entry points (API routes, message handlers). Once data crosses into the domain layer, it should already be valid and typed.

### Error Boundaries at Module Edges

Catch and translate errors at module boundaries. Internal domain errors should not leak their representation into API responses or other modules. Map them explicitly.

## Backend Error Handling

Scholastic AI uses **plain `Promise`s with thrown errors** plus **Zod parse errors at the boundary**. There is no Effect-TS, no `Result<T>` envelope. When a richer error model is adopted, this section is the single place to update.

### Custom Error Classes

Define one error class per *caller reaction*, not per failure cause. Co-locate them with the application or domain code that throws them.

```typescript
// application/library/library.errors.ts
export class LibraryNotFoundError extends Error {
  constructor(libraryId: string) {
    super(`Library with ID ${libraryId} not found`);
    this.name = 'LibraryNotFoundError';
  }
}

export class ArtifactNotFoundError extends Error {
  constructor(libraryId: string, artifactId: string) {
    super(`Artifact ${artifactId} not found in library ${libraryId}`);
    this.name = 'ArtifactNotFoundError';
  }
}

// application/chat/chat.errors.ts
export class ChatNotFoundError extends Error {
  constructor(chatId: string) {
    super(`Chat with ID ${chatId} not found`);
    this.name = 'ChatNotFoundError';
  }
}
```

### Promise + thrown errors (current pattern)

Application services and controllers `await` Promise-returning ports and let domain errors propagate. The route layer translates them into HTTP responses.

```typescript
async function listLibrariesForUser(userId: string): Promise<LibraryDto[]> {
  try {
    const libraries = await libraryService.listForUser(userId);
    return libraries.map(toLibraryDto);
  } catch (error) {
    console.error('Failed to list libraries for user:', userId, error);
    throw error; // route boundary maps to 500 / domain-specific status
  }
}
```

Translate domain errors at the route boundary:

```typescript
try {
  const dto = await libraryController.getById(userId, libraryId);
  return Response.json(dto);
} catch (error) {
  if (error instanceof LibraryNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  console.error('Unexpected error in GET /api/library/libraries/:id', error);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
```

### Validation Errors (Zod at the boundary)

Use Zod for input validation and return structured error responses:

```typescript
try {
  const validatedData = UploadArtifactSchema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    return Response.json(
      { errors: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  return Response.json(
    { errors: { _form: ['Unexpected error'] } },
    { status: 500 }
  );
}
```

### Logging

- Use `console.error` for error-level logging with context:
  ```typescript
  console.error('Error in [operation]:', error);
  ```
- Include operation context (what was being done) and the error object.
- Never swallow errors silently — always log or re-throw.
- A structured logger / observability backend (Datadog, Sentry, OpenTelemetry, …) has not been chosen for Scholastic AI yet; replace `console.error` with the chosen logger when one lands.

## Frontend Error Handling

### React Router Error Boundaries

Every route should export an `ErrorBoundary` component:

```typescript
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="error-container">
        <h1>{error.status} {error.statusText}</h1>
        <p>{error.data}</p>
      </div>
    );
  }

  return (
    <div className="error-container">
      <h1>Something went wrong</h1>
      <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  );
}
```

### Client-Side Error Handling

The client uses plain `fetch` (or a future `requestInternalAPI` wrapper) returning a Promise. Components handle errors with `try`/`catch` and surface them in UI state.

```typescript
try {
  const result = await callListLibrariesAPI();
  setLibraries(result);
} catch (error) {
  console.error('Failed to load libraries', error);
  setLoadError('Could not load your libraries. Please try again.');
}
```

### Frontend Monitoring

No frontend error monitoring (RUM, Sentry, etc.) is wired up yet. When one is adopted, document the integration here and link from `harness/knowledge/infra/infrastructure.md`.
