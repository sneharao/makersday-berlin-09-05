# Gateway Conventions

Gateway **adapters** live under `app/backend.server/infrastructure/gateways/<context>/`. They implement gateway **ports** declared (by default) in `application/<context>/`. Gateways are the abstraction over **external capabilities** that are neither persistence nor pure domain — embeddings/LLM providers, PDF parsers, object storage, auth providers, third-party APIs.

For the *why*, see [architecture-manifesto.md](./architecture-manifesto.md). For the broader layout, see [architecture-overview.md](./architecture-overview.md).

## Ports vs Adapters

> "A port is an interface declared in an inner ring and implemented in an outer ring." — [architecture-manifesto.md](./architecture-manifesto.md)

A **gateway port** is the interface the application service depends on; it speaks the inner ring's vocabulary and knows nothing about the technology that fulfils it.

A **gateway adapter** is the concrete implementation that mediates the conversation with the external system; it is the only place the third-party SDK is imported.

```
application/library/pdf-storage.gateway.ts                          ← port
infrastructure/gateways/library/s3-pdf-storage.adapter.ts           ← adapter
```

## Where Ports Live

**Default: gateway ports live in `application/<context>/`.**

> "We default to placing gateway ports in the application ring, because most external capabilities are orchestration concerns masquerading as domain concerns. We move a port into the domain only when the abstraction is part of the ubiquitous language." — [architecture-manifesto.md](./architecture-manifesto.md)

A bounded context with no domain entities (a future PDF-storage- or embeddings-only context) keeps **all** of its ports — including gateway ports — in `application/<context>/`. In Scholastic AI today the relevant gateways live alongside the consuming context (`application/library/`, `application/chat/`).

```ts
// application/library/pdf-storage.gateway.ts

export interface PersistedSourceFile {
  storageUri: string;
  byteSize: number;
  mimeType: string;
  sha256Hash: string;
}

export interface PdfStorageGateway {
  persist(upload: { bytes: Uint8Array; filename: string; mimeType: string }): Promise<PersistedSourceFile>;
  read(storageUri: string): Promise<Uint8Array>;
  remove(storageUri: string): Promise<void>;
}
```

```ts
// application/library/embeddings.gateway.ts

export interface EmbeddingVector {
  vector: number[];
  model: string;
}

export interface EmbeddingsGateway {
  embed(texts: string[]): Promise<EmbeddingVector[]>;
}
```

```ts
// application/chat/llm-completions.gateway.ts

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  text: string;
}

export interface LlmCompletionsGateway {
  complete(messages: LlmMessage[], options?: { maxTokens?: number }): Promise<{ text: string }>;
}
```

## Adapter Structure

```
infrastructure/gateways/<context>/
├── <tech>-<purpose>.adapter.ts         # primary adapter (default form)
├── <noun>.adapter.ts                   # noun-class form when one noun dominates
├── config.ts                           # adapter config slice
└── types.ts                            # adapter-internal types (when needed)
```

File-naming relaxation: an adapter that expresses a primary noun may carry that noun in both file and class. **Adapter file names always carry the technology name** so swapping providers is a visible rename.

```ts
// infrastructure/gateways/library/s3-pdf-storage.adapter.ts
import type { PdfStorageGateway, PersistedSourceFile } from "@backend-application/library/pdf-storage.gateway";
import { S3Client } from "@backend-platform/infrastructure/s3/client";
import { PdfStorageConfig } from "./config";

export class S3PdfStorageAdapter implements PdfStorageGateway {
  constructor(
    private readonly s3: S3Client,
    private readonly config: PdfStorageConfig,
  ) {}

  async persist(upload: { bytes: Uint8Array; filename: string; mimeType: string }): Promise<PersistedSourceFile> { /* ... */ }
  async read(storageUri: string): Promise<Uint8Array> { /* ... */ }
  async remove(storageUri: string): Promise<void> { /* ... */ }
}
```

## Adapter Class Names Don't Repeat the Role Word

> "Adapters implementing a port do not repeat the role word; they are named for the technology. The adapter that implements `AuthenticationGateway` is named for the auth provider, not `AuthenticationGatewayAdapter`."

| Port                     | Adapter (illustrative)                                        |
|--------------------------|---------------------------------------------------------------|
| `PdfStorageGateway`      | `S3PdfStorageAdapter` (in `s3-pdf-storage.adapter.ts`)        |
| `EmbeddingsGateway`      | `OpenAiEmbeddingsAdapter` (in `openai-embeddings.adapter.ts`) |
| `LlmCompletionsGateway`  | `OpenAiCompletionsAdapter` (in `openai-completions.adapter.ts`) |
| `AuthenticationGateway`  | `<Provider>AuthAdapter` (file named for the provider, e.g. `clerk-auth.adapter.ts`) |

## SDK Wrappers

Raw SDK clients (e.g. an `S3Client`, raw OpenAI client) are **not** gateway adapters — they are protocol-coupled library code. They live under `platform/infrastructure/<system>/` (e.g. `platform/infrastructure/s3/client.ts`, `platform/infrastructure/openai/client.ts`).

Gateway adapters import these wrappers via `@backend-platform/infrastructure/...`. This separates "we wrap a third-party SDK" from "we implement an application port using that wrapper".

See [platform-conventions.md](./platform-conventions.md) for the full split between `platform/shared/` and `platform/infrastructure/`.

## Configuration

Each adapter has a per-adapter `config.ts` (no prefix). The config class exposes a `static fromEnv()` method and is the only thing that touches `process.env` indirectly — via `platform/shared/env/env-utils.ts`.

```ts
// infrastructure/gateways/library/config.ts
import { envString } from "@backend-platform/shared/env/env-utils";

export class PdfStorageConfig {
  constructor(
    readonly bucketName: string,
    readonly region: string,
  ) {}

  static fromEnv() {
    return new PdfStorageConfig(
      envString("PDF_STORAGE_BUCKET"),
      envString("PDF_STORAGE_REGION"),
    );
  }
}
```

The composition root (`main/run-config.ts`) calls `fromEnv()` and aggregates these slices into `AppConfig`. See [composition-root.md](./composition-root.md).

## Tests

Gateway adapter tests are **integration tests** that touch the real external system (e.g. a test S3 bucket, the chosen LLM provider's sandbox). They live in `tests/backend.server/infrastructure/gateways/<context>/<tech>-<purpose>.adapter.integration.test.ts` and use the `.integration.test.ts` suffix.

Application services that depend on a gateway port are tested with **fakes** in `tests/backend.server/application/...` — the gateway adapter integration test confirms the adapter speaks the protocol correctly; the application test confirms the use case orchestrates the port correctly.

See [`code-standards/backend/testing.md`](../../code-standards/backend/testing.md) for framework specifics.

## File Naming

| Role            | Suffix                          | Example                                                  |
|-----------------|---------------------------------|----------------------------------------------------------|
| Gateway port    | `.gateway.ts`                   | `pdf-storage.gateway.ts`, `embeddings.gateway.ts`        |
| Gateway adapter | `.adapter.ts`                   | `s3-pdf-storage.adapter.ts`, `openai-embeddings.adapter.ts` |
| Adapter (noun-class form) | (none — noun-named)   | `<noun>-client.ts` (when the noun dominates)             |
| Config slice    | `config.ts` (no prefix)         | `infrastructure/gateways/<context>/config.ts`            |
| Adapter-internal types | `types.ts`               | `infrastructure/gateways/<context>/types.ts`             |

Class naming:

| File                                  | Class                                |
|---------------------------------------|--------------------------------------|
| `pdf-storage.gateway.ts` (port)       | `interface PdfStorageGateway`        |
| `s3-pdf-storage.adapter.ts`           | `class S3PdfStorageAdapter`          |
| `openai-embeddings.adapter.ts`        | `class OpenAiEmbeddingsAdapter`      |
| `config.ts`                           | `class PdfStorageConfig`             |

## Allowed and Forbidden Imports

| Imports allowed                                            | Imports forbidden                                              |
|------------------------------------------------------------|----------------------------------------------------------------|
| `@backend-application/<context>/...gateway.ts` (the port)  | `@backend-infrastructure/api/...`                               |
| `@backend-domain/...` types only (when needed for shapes)  | `@backend-infrastructure/repositories/...`                      |
| `@backend-platform/infrastructure/<system>/...` (SDK wrappers) | Calling application services                                |
| `@backend-platform/shared/env/env-utils` (in `config.ts`)  | Reading `process.env` directly outside `config.ts`              |
| Computation libraries (`zod`, `date-fns`, ...)             | (anything that crosses ring boundaries inward at runtime)       |
