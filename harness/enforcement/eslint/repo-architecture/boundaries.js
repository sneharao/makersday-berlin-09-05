import pluginBoundaries from "eslint-plugin-boundaries";

// Architectural boundary enforcement via eslint-plugin-boundaries.
// Source: harness/knowledge/repo-architecture/dependency-rules.md (the 6×6
// ring matrix) and harness/knowledge/repo-architecture/overview.md.
//
// The backend is onion + ports/adapters. Element types declare each ring (and
// the two platform tiers) as a glob; the `boundaries/dependencies` rule then
// allows or disallows imports between them, mirroring the dependency matrix.
// `allow` rules establish the default permissions per ring; `disallow` rules
// add explicit blocks with richer diagnostic messages.

export default [
  {
    files: ["app/**/*.{ts,tsx}"],
    plugins: {
      boundaries: pluginBoundaries,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
      "boundaries/root-path": ".",
      "boundaries/elements": [
        // Backend rings (innermost → outermost)
        { type: "backend-domain", pattern: "app/backend.server/domain/**", mode: "full" },
        { type: "backend-application", pattern: "app/backend.server/application/**", mode: "full" },
        { type: "backend-infrastructure-api", pattern: "app/backend.server/infrastructure/api/**", mode: "full" },
        { type: "backend-infrastructure-repositories", pattern: "app/backend.server/infrastructure/repositories/**", mode: "full" },
        { type: "backend-infrastructure-gateways", pattern: "app/backend.server/infrastructure/gateways/**", mode: "full" },
        // Backend platform tiers — split per dependency-rules.md:
        //   platform/shared        — pure in-process; importable by any ring
        //   platform/infrastructure — protocol-coupled; importable only by infrastructure/* and main/
        { type: "backend-platform-shared", pattern: "app/backend.server/platform/shared/**", mode: "full" },
        // ORDERING INVARIANT: this element MUST stay declared before
        // `backend-platform-infrastructure`. eslint-plugin-boundaries matches
        // elements in declaration order and applies the FIRST pattern that
        // matches a file — there is no specificity sort. Re-sorting will
        // silently widen the platform/infrastructure rules to cover route-utils
        // files. Route-utils files type-import SessionContext (from
        // application/) and Permissions (from domain/) — capabilities the
        // generic platform/infrastructure element does not grant.
        { type: "backend-route-utils", pattern: "app/backend.server/platform/infrastructure/route-utils/**", mode: "full" },
        { type: "backend-platform-infrastructure", pattern: "app/backend.server/platform/infrastructure/**", mode: "full" },
        // Composition root
        { type: "backend-main", pattern: "app/backend.server/main/**", mode: "full" },
        // Cross-process kernel & UI
        // ORDERING INVARIANT: shared-agents must be declared BEFORE shared so
        // eslint-plugin-boundaries (first-match wins) classifies agent protocol
        // schema files as the narrower shared-agents element rather than shared.
        { type: "shared-agents", pattern: "app/shared/agents/**", mode: "full" },
        { type: "shared", pattern: "app/shared/**", mode: "full" },
        // ORDERING INVARIANT: this element MUST stay declared before `ui`.
        // eslint-plugin-boundaries matches elements in declaration order. SDKs
        // (routes-sdk) are allowed to value-import only the api-client wrappers,
        // not arbitrary UI components/hooks/design-system code.
        { type: "ui-api-client", pattern: "app/ui.client/lib/api-client/**", mode: "full" },
        { type: "ui", pattern: "app/ui.client/**", mode: "full" },
        // Routes (driving adapters via React Router)
        { type: "routes-sdk", pattern: "app/routes/api/*._sdk.ts", mode: "full" },
        { type: "routes-api", pattern: "app/routes/api/**", mode: "full" },
        { type: "routes-pages", pattern: "app/routes/pages/**", mode: "full" },
        { type: "app-root", pattern: "app/*.{ts,tsx}", mode: "full" },
      ],
    },
    rules: {
      "boundaries/no-unknown": "error",
      "boundaries/element-types": "off",
      "boundaries/entry-point": "off",
      "boundaries/no-unknown-files": "off",
      "boundaries/dependencies": ["error", {
        default: "disallow",
        message: "{{from.type}} is not allowed to import from {{to.type}}. See dependency rules in harness repo architecture knowledge.",
        rules: [
          // ---------------------------------------------------------------
          // Cross-process kernel & top-level isolation
          // ---------------------------------------------------------------
          {
            from: { type: "shared" },
            allow: { to: [{ type: "shared" }] },
          },
          // shared-agents: published-language schemas for external agent platforms.
          // May import shared (domain types, platform helpers); never imported by
          // shared or backend-domain (those must stay free of agent-protocol vocabulary).
          {
            from: { type: "shared-agents" },
            allow: { to: [{ type: "shared" }, { type: "shared-agents" }] },
          },
          {
            from: { type: "ui" },
            allow: { to: [{ type: "shared" }, { type: "shared-agents" }, { type: "routes-sdk" }, { type: "ui" }, { type: "ui-api-client" }] },
          },
          {
            // ui-api-client is a sub-element of ui (carved out so SDKs can
            // value-import only the api-client wrappers, not arbitrary
            // components/hooks/design-system code). It needs the same UI
            // capabilities so the wrappers can call shared kernel helpers
            // (logging, ids, DTOs) and reach the SDK functions.
            from: { type: "ui-api-client" },
            allow: { to: [{ type: "shared" }, { type: "routes-sdk" }, { type: "ui" }, { type: "ui-api-client" }] },
          },

          // ---------------------------------------------------------------
          // Routes (integration layer): may import only the composition root's
          // controller graph (`@backend-main/controller.instances`) and the
          // route-utils middleware (which itself type-imports app/domain).
          // See routes-architecture.md "Allowed imports" tables for both page
          // and API routes — backend.server/{domain,application,infrastructure}
          // are explicitly forbidden.
          // ---------------------------------------------------------------
          {
            from: { type: "routes-pages" },
            allow: {
              to: [
                { type: "backend-main" },
                { type: "backend-route-utils" },
                { type: "ui" },
                { type: "shared" },
                { type: "shared-agents" },
              ],
            },
          },
          {
            from: { type: "routes-api" },
            allow: {
              to: [
                { type: "backend-main" },
                { type: "backend-route-utils" },
                { type: "shared" },
              ],
            },
          },
          {
            // SDK files run on the client. routes-architecture.md SDK
            // "Allowed imports" lists only ui.client/lib/api-client/, shared/,
            // and shared/api/. No backend.server/ imports of any kind — not
            // even type-only.
            from: { type: "routes-sdk" },
            allow: { to: [{ type: "shared" }, { type: "ui-api-client" }] },
          },
          {
            // app/root.tsx is the SSR root: it may import the composition
            // root (e.g. an `onServerStart` hook from `@backend-main/...`)
            // and any UI/shared/route code. Per composition-root.md
            // "Framework Entry-File Boundary", entry files import via
            // @backend-main/... — never directly into application/.
            from: { type: "app-root" },
            allow: {
              to: [
                { type: "shared" }, { type: "ui" },
                { type: "backend-main" },
                { type: "routes-pages" },
                { type: "app-root" },
              ],
            },
          },

          // ---------------------------------------------------------------
          // Route-utils (lives at platform/infrastructure/route-utils/**).
          // Both auth-middleware.server.ts and create-resource-action.ts use
          // `import type` against SessionContext (application/) and
          // Permissions (domain/), matching the type-only-from-inner-rings
          // adapter pattern in gateways-/repositories-conventions.md.
          // The lint exception (type-only access into application/ and
          // domain/) is documented in dependency-rules.md.
          // ---------------------------------------------------------------
          {
            from: { type: "backend-route-utils" },
            allow: {
              to: [
                { type: "backend-route-utils" },
                { type: "backend-platform-shared" },
                { type: "shared" },
              ],
            },
          },
          {
            from: { type: "backend-route-utils" },
            allow: { to: { type: "backend-application" }, dependency: { kind: "type" } },
          },
          {
            from: { type: "backend-route-utils" },
            allow: { to: { type: "backend-domain" }, dependency: { kind: "type" } },
          },

          // ---------------------------------------------------------------
          // Backend rings — mirrors the 6×6 dependency matrix in
          // harness/knowledge/repo-architecture/dependency-rules.md.
          // ---------------------------------------------------------------

          // domain → domain, platform/shared, shared
          {
            from: { type: "backend-domain" },
            allow: {
              to: [
                { type: "backend-domain" },
                { type: "backend-platform-shared" },
                { type: "shared" },
              ],
            },
          },

          // application → domain, application, platform/shared, shared, shared-agents
          // (Application services orchestrating agent boundaries may import agent
          // published-language schemas, e.g. CasesService building IntakeAgentContext.)
          {
            from: { type: "backend-application" },
            allow: {
              to: [
                { type: "backend-domain" },
                { type: "backend-application" },
                { type: "backend-platform-shared" },
                { type: "shared" },
                { type: "shared-agents" },
              ],
            },
          },

          // infrastructure/repositories (driven adapter) → platform/shared,
          // platform/infrastructure, shared (value); domain + application are
          // type-only (the adapter implements a port — it depends on the
          // interface, not on application services or domain factories).
          // See repositories-conventions.md ("Allowed/Forbidden Imports"
          // table — "Calling application services" is forbidden) and the
          // canonical example (`import type { Device } from
          // "@backend-domain/devices/device"`).
          {
            from: { type: "backend-infrastructure-repositories" },
            allow: {
              to: [
                { type: "backend-infrastructure-repositories" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "shared" },
              ],
            },
          },
          {
            from: { type: "backend-infrastructure-repositories" },
            allow: { to: { type: "backend-application" }, dependency: { kind: "type" } },
          },
          {
            from: { type: "backend-infrastructure-repositories" },
            allow: { to: { type: "backend-domain" }, dependency: { kind: "type" } },
          },

          // infrastructure/gateways (driven adapter) → same shape as
          // repositories, plus shared-agents (gateways translate agent
          // context/state between our adapters and external platforms like LangGraph).
          {
            from: { type: "backend-infrastructure-gateways" },
            allow: {
              to: [
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "shared" },
                { type: "shared-agents" },
              ],
            },
          },
          {
            from: { type: "backend-infrastructure-gateways" },
            allow: { to: { type: "backend-application" }, dependency: { kind: "type" } },
          },
          {
            from: { type: "backend-infrastructure-gateways" },
            allow: { to: { type: "backend-domain" }, dependency: { kind: "type" } },
          },

          // infrastructure/api (driving adapter) → application, platform/*,
          // shared, shared-agents (controllers may expose agent context types
          // as return types), plus type-only imports of domain.
          {
            from: { type: "backend-infrastructure-api" },
            allow: {
              to: [
                { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "shared" },
                { type: "shared-agents" },
              ],
            },
          },
          {
            from: { type: "backend-infrastructure-api" },
            allow: { to: { type: "backend-domain" }, dependency: { kind: "type" } },
          },

          // platform/shared → platform/shared only.
          // It cannot import the cross-process kernel `app/shared/`. See
          // platform-conventions.md "Allowed and Forbidden Imports" for
          // platform/shared/ ("Forbidden: Anything else in the repo").
          {
            from: { type: "backend-platform-shared" },
            allow: {
              to: [
                { type: "backend-platform-shared" },
              ],
            },
          },

          // platform/infrastructure → platform/shared, platform/infrastructure, shared
          {
            from: { type: "backend-platform-infrastructure" },
            allow: {
              to: [
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "shared" },
              ],
            },
          },

          // main (composition root) → everything.
          // `backend-route-utils` is listed explicitly: although its files
          // physically live under `platform/infrastructure/`, they are
          // classified as a distinct lint element by eslint-plugin-boundaries
          // (sub-path matched first), so the `backend-platform-infrastructure`
          // entry does not cover them.
          {
            from: { type: "backend-main" },
            allow: {
              to: [
                { type: "backend-domain" },
                { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "backend-route-utils" },
                { type: "backend-main" },
                { type: "shared" },
                { type: "shared-agents" },
              ],
            },
          },

          // ---------------------------------------------------------------
          // Disallow rules with richer diagnostic messages.
          // ---------------------------------------------------------------

          {
            from: { type: "ui" },
            disallow: {
              to: [
                { type: "backend-domain" }, { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "backend-main" },
              ],
            },
            message: "UI must never import backend code. Use SDK route files for API access. See dependency rules in harness repo architecture knowledge.",
          },
          {
            from: { type: "backend-application" },
            disallow: { to: [{ type: "backend-infrastructure-repositories" }] },
            message: "Application services must depend on repository ports declared in domain/ (or application/), not concrete adapters. Inject via main/application.instances.ts. See application conventions in harness repo architecture knowledge.",
          },
          {
            from: { type: "backend-application" },
            disallow: { to: [{ type: "backend-infrastructure-gateways" }], dependency: { kind: "value" } },
            message: "Application services must not value-import gateway adapters. Use 'import type' against the gateway port and inject via main/application.instances.ts. See application conventions in harness repo architecture knowledge.",
          },
          {
            from: { type: "backend-infrastructure-api" },
            disallow: { to: { type: "backend-domain" }, dependency: { kind: "value" } },
            message: "Controllers may only use 'import type' from domain — no value imports. See api conventions in harness repo architecture knowledge.",
          },
          {
            from: [
              { type: "backend-infrastructure-repositories" },
              { type: "backend-infrastructure-gateways" },
            ],
            disallow: { to: { type: "backend-application" }, dependency: { kind: "value" } },
            message: "Adapters depend on the port (interface), not on application services. Use `import type` for the gateway/repository port. If a value is genuinely needed, the orchestration belongs in main/, not in the adapter. See gateways-conventions.md / repositories-conventions.md.",
          },
          {
            from: [
              { type: "backend-infrastructure-repositories" },
              { type: "backend-infrastructure-gateways" },
            ],
            disallow: { to: { type: "backend-domain" }, dependency: { kind: "value" } },
            message: "Adapters import domain shapes via `import type` only. If you need a domain value (factory/static method), the conversion belongs in a domain service or in `toEntity` on the base `Repository<TDocument, TEntity>` class — see repositories-conventions.md §Models implements the Domain Entity.",
          },
          {
            from: { type: "backend-infrastructure-api" },
            disallow: {
              to: [
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
              ],
            },
            message: "Controllers (driving adapters) must always call an application service — never a repository or gateway directly. See api conventions in harness repo architecture knowledge.",
          },
          {
            from: { type: "backend-domain" },
            disallow: {
              to: [
                { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-infrastructure" },
                { type: "backend-main" },
              ],
            },
            message: "Domain must have zero infrastructure dependencies and may import only from itself, platform/shared, and shared/. See domain conventions in harness repo architecture knowledge.",
          },
          {
            from: { type: "routes-sdk" },
            disallow: {
              to: [
                { type: "backend-domain" },
                { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-route-utils" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "backend-main" },
              ],
            },
            message: "SDK files run on the client and must not import backend code (not even type-only). DTOs that need to cross the wire belong in app/shared/api/. See routes-architecture.md SDK 'Allowed imports' table.",
          },
          {
            from: [{ type: "routes-pages" }, { type: "routes-api" }],
            disallow: {
              to: [
                { type: "backend-domain" },
                { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
              ],
            },
            message: "Routes must access backend only through @backend-main/controller.instances and the route-utils middleware. Domain enums/DTOs that need to cross the wire belong in app/shared/. See routes-architecture.md 'Allowed imports' tables.",
          },
          {
            from: { type: "shared" },
            disallow: {
              to: [
                { type: "backend-domain" }, { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-shared" },
                { type: "backend-platform-infrastructure" },
                { type: "backend-main" },
                { type: "ui" }, { type: "routes-pages" }, { type: "routes-api" },
                { type: "routes-sdk" },
                { type: "shared-agents" },
              ],
            },
            message: "Shared is the dependency-tree leaf — it must not import from backend, ui, routes, or shared-agents. See shared-kernel.md in harness repo architecture knowledge.",
          },
          {
            from: { type: "backend-domain" },
            disallow: { to: [{ type: "shared-agents" }] },
            message: "Domain must not import agent published-language schemas (shared-agents). Agent-protocol types are outer-of-hexagon DTOs that depend on domain, not the reverse. See dependency-rules.md §shared/agents.",
          },
          {
            from: { type: "backend-platform-shared" },
            disallow: {
              to: [
                { type: "backend-domain" }, { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-route-utils" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-platform-infrastructure" },
                { type: "backend-main" },
              ],
            },
            message: "platform/shared is pure in-process computation — it must not import from any other backend ring (including platform/infrastructure). See platform conventions in harness repo architecture knowledge.",
          },
          {
            from: { type: "backend-platform-shared" },
            disallow: { to: [{ type: "shared" }] },
            message: "platform/shared is the most-isolated tier — pure in-process backend computation. It cannot import the cross-process kernel app/shared/. See platform-conventions.md 'Allowed and Forbidden Imports' for platform/shared/.",
          },
          {
            from: { type: "backend-platform-infrastructure" },
            disallow: {
              to: [
                { type: "backend-domain" }, { type: "backend-application" },
                { type: "backend-infrastructure-api" },
                { type: "backend-infrastructure-repositories" },
                { type: "backend-infrastructure-gateways" },
                { type: "backend-main" },
              ],
            },
            message: "platform/infrastructure is reusable backend-generic library code — it must not import application-specific rings. See platform conventions in harness repo architecture knowledge.",
          },
        ],
      }],
    },
  },
];
