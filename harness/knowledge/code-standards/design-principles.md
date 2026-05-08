# Design Principles

Foundational principles that guide design trade-offs across the entire codebase. Consult when choosing between approaches or evaluating whether code is well-structured.

## Code Quality Values

- **Readability over cleverness** — write code that is easy to understand and maintain
- **Functional programming preferred** — use functional approaches over mutation when possible
- **Type safety** — all functions must be fully typed for parameters and return values
- **Composition over inheritance** — prefer composition patterns for better modularity
- **ETC — Easy to Change** — the meta-principle behind all design guidance. When choosing between two approaches, pick the one that makes the system easier to change later

### Prefer `const` — No Reassignment

Use `const` by default. `let` is prohibited unless reassignment is genuinely unavoidable in tightly encapsulated infrastructure code (e.g. a database connection module). If you reach for `let`, restructure first — extract a function, use a ternary, or return early.

Enforced by ESLint `prefer-const: "error"`. Override with `// eslint-disable-next-line prefer-const` when the exception is justified.

```typescript
// Good — const with ternary or derived value
const label = isActive ? 'Active' : 'Inactive';
const sorted = [...items].sort(byDate);

// Good — extract a function instead of accumulating with let
const total = sumLineItems(order.items);

// Avoid — let for reassignment
let label = '';
if (isActive) {
  label = 'Active';
} else {
  label = 'Inactive';
}
```

The only acceptable exception is infrastructure plumbing where the variable genuinely must be reassigned and the scope is small and well-encapsulated (e.g. `let client: MongoClient | null = null` in a connection module).

## Functions & Methods

### Small Functions, One Level of Abstraction

Functions should do one thing. Statements within a function should all be at the same level of abstraction, reading top-to-bottom like a narrative (the "Step-Down Rule").

```typescript
// Good — each function operates at one abstraction level
async function uploadArtifact(input: UploadArtifactInput): Promise<Artifact> {
  const validated = validateUploadInput(input);
  const sourceFile = await persistSourceFile(validated.upload);
  return await registerArtifact(validated, sourceFile);
}

// Avoid — mixed abstraction levels
async function uploadArtifact(input: UploadArtifactInput): Promise<Artifact> {
  if (!input.title || input.title.length < 1) throw new Error('...');
  const sourceFile = await s3.putObject({ Bucket: 'pdfs', Body: input.bytes, Key: randomUUID() });
  const artifact = { ...input, id: generateId(), uploadedAt: new Date(), sourceFile };
  const doc = new ArtifactModel(artifact);
  await doc.save();
  return artifact;
}
```

### Name the Business Rule, Not the Mechanics

When code encodes a business rule — a guard, a predicate, a validation, a policy — the reader should recognise *which* rule is being enforced without tracing through the implementation. Extract the rule into a well-named function so the call site reads as the domain question, not the boolean algebra.

The litmus test: *can someone unfamiliar with the implementation read the call site and understand the domain intent?* If they have to open the method body to know what the code *decides*, the abstraction boundary is in the wrong place.

This principle ties together three existing rules:
- **Intention-Revealing Names** (naming-conventions) gives you the vocabulary.
- **One Level of Abstraction** (above) tells you to separate the data transformation from the domain judgment.
- **Transform Programming** (below) gives you the shape — `.map(transform).some(predicate)` instead of a loop that interleaves both.

```typescript
// Good — call site states the business question
const indexable = artifacts
  .map((a) => ArtifactService.withResolvedKind(a))
  .filter(ArtifactService.isReadyForIndexing);

// Avoid — business rule is buried in inline conditions
const indexable = artifacts.filter((a) => {
  const isReady = a.uploadStatus === 'ready';
  const hasPages = (a.pageCount ?? 0) > 0;
  const isPdf = a.sourceFile.mimeType === 'application/pdf';
  return isReady && hasPages && isPdf;
});
```

The "avoid" version isn't wrong — it produces the same result. But the reader has to mentally simulate three boolean conditions to discover the rule is "artifacts that are ready to be indexed for chat." The "good" version names that rule directly. The body of `isReadyForIndexing` still contains the booleans; readers who need the *how* can drill in. Everyone else stays at the *what*.

### Extract Till You Drop

If you can extract a meaningful sub-function, do. Short functions with descriptive names replace comments.

### Guard Clauses

Replace nested conditionals with early returns for special cases. Flatten the happy path.

```typescript
// Good — guard clauses
function getDiscount(customer: Customer): number {
  if (!customer.isActive) return 0;
  if (!customer.hasMembership) return 0;
  return calculateMemberDiscount(customer);
}

// Avoid — nested conditionals
function getDiscount(customer: Customer): number {
  if (customer.isActive) {
    if (customer.hasMembership) {
      return calculateMemberDiscount(customer);
    }
  }
  return 0;
}
```

### Introduce Parameter Object

When a function takes more than four parameters that logically belong together, wrap them in a single typed object. The `(a, b, c, options)` shape is fine; once you'd need a fifth positional slot, switch to an object.

```typescript
// Good — parameter object
interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
  timezone: string;
  kind: ArtifactKind;
}
function filterByDateRange(artifacts: Artifact[], filter: DateRangeFilter): Artifact[] { /* ... */ }

// Avoid — long parameter lists
function filterByDateRange(artifacts: Artifact[], start: Date, end: Date, tz: string, kind: ArtifactKind): Artifact[] { /* ... */ }
```

## Structural Principles

### Orthogonality — Shy Code

Modules should reveal as little as possible and depend on as few things as possible. A change in one module should not force changes in unrelated modules.

#### Private by Default, Readonly by Default

Minimise the surface area of every class and module:

- **Class members**: declare `private readonly` unless there is a proven need for wider access or mutability. Widen to `protected`, `public`, or drop `readonly` only when a concrete consumer requires it.
- **Methods**: class methods not called from outside the class should be `private`. Module-level functions not used outside their file should not be exported.
- **Exports**: don't export a symbol "in case something needs it later" — that's speculative generality (see YAGNI below).

```typescript
// Good — tight encapsulation, explicit access; ports injected at the composition root
class UploadArtifactService {
  private readonly libraries: LibraryRepository;
  private readonly pdfStorage: PdfStorageGateway;

  constructor(libraries: LibraryRepository, pdfStorage: PdfStorageGateway) {
    this.libraries = libraries;
    this.pdfStorage = pdfStorage;
  }

  public async getLibrary(userId: string, libraryId: string): Promise<Library | null> {
    return await this.libraries.getById(userId, libraryId);
  }

  private buildFilter(criteria: FilterInput): ArtifactFilter {
    return { ...criteria, isActive: true };
  }
}
```

The class above lives in `application/library/` and is wired with concrete adapters only in `main/application.instances.ts` — the single composition root. See [`harness/knowledge/repo-architecture/backend/composition-root.md`](../repo-architecture/backend/composition-root.md).

### YAGNI

Don't build abstractions, hooks, or parameters "in case we need them someday." If there's no current use, don't add it. Speculative generality is one of the most common sources of unnecessary complexity.

### Comments as Deodorant

A comment explaining confusing code is a signal to rewrite the code, not to document the confusion. Good code is its own documentation. Comments should explain *why*, not *what*.

### Design by Contract

Functions should define clear preconditions (what the caller must guarantee), postconditions (what the function guarantees on completion), and invariants (what remains true throughout). In TypeScript this translates to strict input types, documented expectations, and runtime guards at boundaries.

### Transform Programming

Think of programs as pipelines that transform data from input to output. Each step takes input, produces output, and the next step takes over. This produces cleaner, more composable code than deeply nested control flow.

```typescript
// Good — pipeline of transformations
const result = artifacts
  .filter(isReady)
  .map(enrichWithLibrary)
  .sort(byUploadedAt);

// Avoid — imperative with nested control flow
const result: ArtifactView[] = [];
for (const a of artifacts) {
  if (a.uploadStatus === 'ready') {
    const enriched = { ...a, library: lookupLibrary(a.libraryId) };
    result.push(enriched);
  }
}
result.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
```

### Replace Conditional with Polymorphism

Complex switch/if-else chains on type discriminators should become polymorphic types with per-variant behaviour. Especially relevant in TypeScript discriminated unions.

### Encapsulate Record / Collection

Don't expose raw data structures. Wrap them so you control access and can change the internal representation without cascading changes.

### Cohesion

Methods in a class should use most of the class's instance variables. If a subset of methods only touches a subset of variables, that's a separate class trying to get out.

## Boundaries & Third-Party Code

### Wrap Third-Party Interfaces (Ports & Adapters)

Don't scatter direct calls to third-party libraries throughout the codebase. Define a **gateway port** in the inner ring (`application/<context>/<thing>.gateway.ts`) and an **adapter** in the outer ring (`infrastructure/gateways/<context>/<tech>-<purpose>.adapter.ts`). Inner-ring code depends on the port; the adapter wraps the third-party SDK; the composition root wires them together. This is what makes collaboration libraries swappable, mockable, and contained from breaking changes.

```typescript
// Good — application code depends on a port; adapter wraps the SDK
// application/notifications/notification.gateway.ts
export interface NotificationGateway {
  send(notification: Notification): Promise<void>;
}

// infrastructure/gateways/notifications/resend-notification.adapter.ts
import { Resend } from 'resend';
export class ResendNotificationAdapter implements NotificationGateway { /* ... */ }

// Avoid — third-party library called directly throughout application/domain code
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({ /* ... */ });
```

For the full classification of *which* third-party libraries must hide behind a port (collaboration vs computation libraries) see [`dependency-rules.md` § Third-Party Dependencies](../repo-architecture/dependency-rules.md#third-party-dependencies).

## Code Layout

### Vertical Ordering

Higher-level functions appear first, called functions appear below. Read a file top-to-bottom like a newspaper article: headline first, details deeper.

### Vertical Proximity

Concepts that are closely related should be vertically close in the source file. Don't force the reader to jump around.
