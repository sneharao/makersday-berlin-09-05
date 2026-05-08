# Composition Root

`app/backend.server/main/` is the **composition root**. It is the only place in the backend where concrete classes from multiple rings are named together; the only place `new` is called on infrastructure classes; the only place `process.env` is read.

For the *why*, see [architecture-manifesto.md](./architecture-manifesto.md). For the broader layout, see [architecture-overview.md](./architecture-overview.md).

## Why a Single Root

> "Composition happens at a single root, close to the process entry point. Concrete classes are instantiated there and nowhere else. No ring below the root ever calls `new` on an infrastructure class. Application and domain code declares what it needs via ports; the composition root fulfills those declarations." — [architecture-manifesto.md](./architecture-manifesto.md)

> "This is the only place in the codebase where concrete types from multiple rings are named together. **That concentration is the point.**" — [architecture-manifesto.md](./architecture-manifesto.md)

## Staged Composition Files

Composition is split across the following files. Note the **dot-style** naming (`application.instances.ts`, not `application-instances.ts`) — the dot signals "this is the X-instances composition file", not a regular module.

```
main/
├── run-config.ts                # AppConfig.fromEnv() — only file that reads process.env
├── application.instances.ts     # composes adapters + application services in dependency order
├── controller.instances.ts      # composes controllers from application services + primitive args
└── entry-point.ts               # workers / CLIs (empty in the SSR React Router app)
```

### `main/run-config.ts`

Aggregates per-ring config slices into a single `AppConfig` via `fromEnv()`. **The only file allowed to read `process.env`** (delegating to `platform/shared/env/env-utils.ts`).

```ts
// main/run-config.ts
import { MongoClientConfig } from "@backend-platform/infrastructure/mongo/config";

export class AppConfig {
  constructor(
    readonly mongo: MongoClientConfig,
    // future slices land here as they are needed:
    //   readonly auth: AuthProviderConfig,
    //   readonly embeddings: EmbeddingsConfig,
    //   readonly pdfStorage: PdfStorageConfig,
  ) {}

  static fromEnv() {
    return new AppConfig(
      MongoClientConfig.fromEnv(),
    );
  }
}
```

### `main/application.instances.ts`

Composes adapters (repositories, gateways, clients) and application services in dependency order. **Owns all `new` of infrastructure classes.**

```ts
// main/application.instances.ts
import { MongoClient } from "@backend-platform/infrastructure/mongo/client";
import { LibraryMongoRepository } from "@backend-infrastructure/repositories/library/library-mongo.repo";
import { ChatMongoRepository } from "@backend-infrastructure/repositories/chat/chat-mongo.repo";
import { LibraryService } from "@backend-application/library/library.service";
import { ChatService } from "@backend-application/chat/chat.service";
import { AppConfig } from "./run-config";

export function buildApplicationInstances(config: AppConfig) {
  // platform/infrastructure clients
  const mongo = new MongoClient(config.mongo);

  // driven adapters
  const libraryRepo = new LibraryMongoRepository();
  const chatRepo = new ChatMongoRepository();

  // application services
  const libraryService = new LibraryService(libraryRepo);
  const chatService = new ChatService(chatRepo, libraryRepo);

  return { libraryService, chatService, mongo };
}
```

### `main/controller.instances.ts`

Composes controllers from application services and primitive config args.

```ts
// main/controller.instances.ts
import { LibraryController } from "@backend-infrastructure/api/library.controller";
import { ChatController } from "@backend-infrastructure/api/chat.controller";
import { buildApplicationInstances } from "./application.instances";
import { AppConfig } from "./run-config";

const config = AppConfig.fromEnv();
const app = buildApplicationInstances(config);

export const libraryController = new LibraryController(app.libraryService);
export const chatController = new ChatController(app.chatService);
```

### `main/entry-point.ts`

Reserved for **non-route entry points** — workers, CLIs, scheduled jobs. **Empty in the SSR React Router app**, where the framework's `app/routes/**` files are the entry points. When workers or CLIs are introduced, they are instantiated and started here.

## Configuration Follows the Inward Rule

Each consumer ring declares its own config-slice type and exposes a `static fromEnv()` factory. The composition root aggregates these into `AppConfig`; the consumer receives its slice via the constructor.

> "Each ring owns the config slice it consumes (application services declare what application config they need, infrastructure adapters declare their connection/credential config, platform/infrastructure modules declare their client config). The composition root aggregates these slices into a single record at process start; **no ring below the root reads from `process.env`.**" — [architecture-manifesto.md](./architecture-manifesto.md)

| Slice                     | Owner location                                                              |
|---------------------------|-----------------------------------------------------------------------------|
| `MongoClientConfig`       | `platform/infrastructure/mongo/config.ts`                                   |
| `EmbeddingsConfig` *(planned)*  | `application/library/config.ts` (when the embeddings gateway is added) |
| `PdfStorageConfig` *(planned)*  | `infrastructure/gateways/library/pdf-storage/config.ts`               |
| `AuthProviderConfig` *(planned)* | `infrastructure/gateways/user/auth/config.ts`                        |

`run-config.ts` aggregates these. It does not own them.

## Config File Naming

Config files are named **`config.ts`** (no prefix). The folder they live in supplies the disambiguation.

The legacy form `<thing>.config.ts` (dash-prefixed) is **deprecated**. Existing files using the old form should be renamed when touched.

## Routes Import the Controller Graph from `main/`

Page and API routes (`app/routes/**`) import controllers from `@backend-main/controller.instances`. This replaces every `application/controller-instances.server.ts` reference across the codebase.

```ts
// app/routes/api/api.library.libraries.ts
import { libraryController } from "@backend-main/controller.instances";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await libraryController.list(query));
};
```

## Framework Entry-File Boundary

`app/entry.server.tsx`, `app/entry.client.tsx`, and `app/root.tsx` are **React Router framework-owned files**. They sit outside `backend.server/main/` because the framework controls their location and signature.

These files may import from `@backend-main/...` (e.g. to mount the controller graph or run a startup hook). They themselves never read `process.env` and never instantiate adapters — the composition root rule is preserved by routing all bootstrap work through `main/`.

```ts
// app/entry.server.tsx (illustrative)
import { onServerStart } from "@backend-main/application.instances"; // optional startup hook
onServerStart();
// remainder is React Router's standard entry-server template
```

## Allowed and Forbidden Imports

For files in `main/`:

| Allowed                                                           | Forbidden                                              |
|-------------------------------------------------------------------|--------------------------------------------------------|
| Anything in the repo (rings, both platform tiers)                 | (none — `main/` is the apex)                           |
| Reading `process.env` (only inside `run-config.ts`, via `env-utils`) | Business logic; HTTP request handling; persistence calls |
| `new` on any class                                                | (this is the only place that does so for infrastructure) |

For everything else: do not import from `main/` — that would invert the dependency direction. The only exceptions are framework entry files (`app/entry.server.tsx`, etc.) and files under `app/routes/**` importing the controller graph.
