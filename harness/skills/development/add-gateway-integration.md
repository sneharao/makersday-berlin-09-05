# Add Gateway Integration

Wrap a new third-party service behind a port and adapter so that application code depends on an abstraction, not on the vendor SDK. Follows the ports-and-adapters pattern defined in [`repo-architecture/backend/gateways-conventions.md`](../../knowledge/repo-architecture/backend/gateways-conventions.md).

If your work crosses into a code category not covered by this skill (e.g. you need to add a domain entity or an API endpoint as part of this integration), stop and re-run `harness/enforcement/utils/list-harness.sh skills knowledge` for that area before continuing.

---

## Prerequisites

Read these before starting:

- `harness/knowledge/repo-architecture/dependency-rules.md` — ring boundaries, particularly the gateway placement rules in "Common Scenarios § I need to add a new external integration".
- `harness/knowledge/repo-architecture/backend/gateways-conventions.md` — gateway port and adapter patterns.
- `harness/knowledge/repo-architecture/backend/composition-root.md` — wiring in `main/`.
- `harness/knowledge/infra/infrastructure.md` — existing external integrations, so you understand what is already wired.

---

## Step 1 — Define the gateway port

A **gateway port** abstracts an external capability. Its interface must:

- Express what the system needs in domain terms, not what the third-party API provides.
- Use domain types for all parameters and return values — never SDK types.
- Live in `application/<context>/<purpose>.gateway.ts` by default. Move to `domain/<context>/` only when the abstraction is genuinely part of the ubiquitous language (rare).

```typescript
// app/backend.server/application/library/pdf-storage.gateway.ts
import type { ArtifactId } from '@backend-domain/library/artifact';

export interface PdfStorageGateway {
  upload(artifactId: ArtifactId, fileBytes: Buffer): Promise<void>;
  getDownloadUrl(artifactId: ArtifactId): Promise<string>;
  delete(artifactId: ArtifactId): Promise<void>;
}
```

Rules:
- Suffix: `.gateway.ts`. Interface named `<Purpose>Gateway`.
- Methods express intent (`upload`, `getDownloadUrl`), not protocol (`PUT /buckets/:name/objects/:key`).
- No SDK types, no `Promise<S3PutObjectResponse>`, no raw HTTP status codes in the return type.

---

## Step 2 — Write the fake adapter (for tests)

Before implementing the real adapter, create an in-memory fake that the application layer tests can use.

```typescript
// tests/backend.server/doubles/in-memory-pdf-storage.gateway.ts
import type { PdfStorageGateway } from '@backend-application/library/pdf-storage.gateway';
import type { ArtifactId } from '@backend-domain/library/artifact';

export class InMemoryPdfStorageGateway implements PdfStorageGateway {
  public uploads = new Map<string, Buffer>();

  async upload(artifactId: ArtifactId, fileBytes: Buffer): Promise<void> {
    this.uploads.set(artifactId, fileBytes);
  }

  async getDownloadUrl(artifactId: ArtifactId): Promise<string> {
    return `memory://${artifactId}`;
  }

  async delete(artifactId: ArtifactId): Promise<void> {
    this.uploads.delete(artifactId);
  }
}
```

Use the fake in application-layer tests. Test application behaviour; do not test whether the fake stores data correctly.

---

## Step 3 — Write the real adapter

The real adapter lives in `infrastructure/gateways/<context>/`. If it wraps a third-party SDK directly, prefer placing the raw SDK client initialisation in `platform/infrastructure/<vendor>/` and importing it into the adapter.

```typescript
// app/backend.server/infrastructure/gateways/library/s3-pdf-storage.adapter.ts
import type { PdfStorageGateway } from '@backend-application/library/pdf-storage.gateway';
import type { ArtifactId } from '@backend-domain/library/artifact';
import type { S3Client } from '@backend-platform/infrastructure/s3/client';

export class S3PdfStorageAdapter implements PdfStorageGateway {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async upload(artifactId: ArtifactId, fileBytes: Buffer): Promise<void> {
    await this.client.putObject({
      Bucket: this.bucket,
      Key: `artifacts/${artifactId}.pdf`,
      Body: fileBytes,
      ContentType: 'application/pdf',
    });
  }

  async getDownloadUrl(artifactId: ArtifactId): Promise<string> {
    return this.client.getSignedUrl({
      Bucket: this.bucket,
      Key: `artifacts/${artifactId}.pdf`,
      expiresInSeconds: 60 * 5,
    });
  }

  async delete(artifactId: ArtifactId): Promise<void> {
    await this.client.deleteObject({
      Bucket: this.bucket,
      Key: `artifacts/${artifactId}.pdf`,
    });
  }
}
```

Rules:
- Suffix: `.adapter.ts`. Named `<Vendor><Purpose>Adapter`.
- Must `implements <GatewayPort>`.
- Constructor receives the SDK client (or platform wrapper) by dependency injection.
- All collaboration library imports (e.g. `@aws-sdk/client-s3`, `openai`, vendor SDKs) are in this file only — never in `application/`, `domain/`, or `shared/`.

---

## Step 4 — Register in the composition root

Wire the adapter in `main/application.instances.ts`. Instantiate the SDK client (or use the platform wrapper), then pass it to the adapter constructor, then pass the adapter to the application service.

```typescript
import { S3Client } from '@backend-platform/infrastructure/s3/client';
import { S3PdfStorageAdapter } from '@backend-infrastructure/gateways/library/s3-pdf-storage.adapter';
import { UploadArtifactService } from '@backend-application/library/upload-artifact.service';

export function buildApplicationInstances(config: AppConfig) {
  const s3Client = new S3Client(config.s3);
  const pdfStorage = new S3PdfStorageAdapter(s3Client, config.s3.artifactsBucket);
  const uploadArtifactService = new UploadArtifactService(libraryRepository, pdfStorage);

  return { uploadArtifactService, ... };
}
```

---

## Step 5 — Document in infrastructure knowledge

Open `harness/knowledge/infra/infrastructure.md` and add an entry for the new integration. Include:
- What the integration is and what it does.
- Where the adapter and any platform SDK wrapper live.
- Any environment variables required (`config.s3`, `config.openai`, etc.).
- A link to the vendor's documentation.

---

## Step 6 — Add to the dependency-rules conformance checklist

When performing a Conformance Self-Review (per `harness/dev-workflow/002_build.md`), check that:
- The gateway port is in `application/` (or `domain/` if justified).
- The adapter is in `infrastructure/gateways/`.
- No application or domain code imports from the adapter directly.
- The adapter is only instantiated in `main/`.

---

## Step 7 — Run checks

Execute `harness/skills/testing/run-code-checks.md`:

- `npm run typecheck` — catches adapter shape mismatches against the port interface.
- `npm run build` — catches bundler-level boundary violations.
- *(planned)* `npm run lint` and `npm run test` — once ESLint and a test runner are wired up, add them here so ring violations and gateway behaviour are checked automatically.

---

## Checklist

Before marking the integration complete:

- [ ] Gateway port defined in `application/<context>/` with domain-only types
- [ ] Fake adapter in `tests/backend.server/doubles/` — implements the port, used in application tests
- [ ] Real adapter in `infrastructure/gateways/<context>/` — implements the port, no domain/application code
- [ ] SDK client/raw collaboration library imported only inside the adapter (or in `platform/infrastructure/`)
- [ ] Adapter instantiated only in `main/application.instances.ts`
- [ ] Application service depends on the port interface, not the concrete adapter
- [ ] Infrastructure knowledge file (`harness/knowledge/infra/infrastructure.md`) updated
- [ ] All checks pass (`typecheck`, `build`)
