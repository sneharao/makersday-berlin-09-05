// Per-layer rule overrides. One config object per architectural layer,
// each scoped with a `files` glob. Ordering within this array matches the
// original eslint.config.js to preserve flat-config last-wins semantics
// when multiple blocks set the same rule key (notably `no-restricted-*`).

import pluginUnicorn from "eslint-plugin-unicorn";

// ============================================================================
// Shared constants — referenced from every "purity" block below so the
// classification of third-party dependencies stays in lock-step across
// domain/, shared/, application/, and platform/shared/. Drift between four
// in-line copies was the most likely future source of bugs.
//
// Source: harness/knowledge/repo-architecture/backend/platform-conventions.md
//         §"Third-Party Dependency Classification" (collaboration libraries)
//         and harness/knowledge/repo-architecture/backend/domain-conventions.md
//         L141 (verbatim list of forbidden SDKs).
// ============================================================================
const COLLABORATION_LIBS = [
  "@typegoose/*", "mongoose", "mongoose/*", "mongodb", "mongodb/*",
  "express", "express/*",
  "@aws-sdk/*", "aws-sdk", "aws-sdk/*",
  "langchain", "langchain/*", "@langchain/*",
  "langgraph-sdk", "langgraph-sdk/*",
  "openai", "openai/*",
  "axios", "axios/*",
  "stytch", "stytch/*", "@stytch/*",
  "node-fetch", "node-fetch/*",
  "amqplib", "amqplib/*",
  "@sendgrid/*",
];

// Per domain-conventions.md L143: "React, JSX, anything browser-shaped" is
// forbidden in the inner-ring/leaf layers (domain + shared kernel).
const REACT_AND_BROWSER_LIBS = [
  "react", "react/*",
  "react-dom", "react-dom/*",
  "react-router", "react-router/*", "@react-router/*",
];

const COLLAB_LIBS_MESSAGE =
  "Collaboration libraries (databases, HTTP clients, LLM/auth SDKs) belong only inside infrastructure/ adapters or platform/infrastructure/ wrappers. See platform-conventions.md §Third-Party Dependency Classification.";

// Defence-in-depth entries used by both the global "process" block below AND
// every layer-specific `no-restricted-syntax` block. Flat-config blocks
// OVERWRITE (rather than merge) when multiple of them set the same rule key
// for overlapping files — so any block that sets `no-restricted-syntax` for
// backend.server/** or routes/** files MUST spread these entries in to keep
// the process ban active. Source: composition-root.md §Allowed/Forbidden
// imports for `main/` (only `run-config.ts` may read `process.env`).
const PROCESS_NO_SYNTAX_ENTRIES = [
  {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message: "Direct `process.env` access is forbidden outside main/run-config.ts and platform/shared/env/. Pass values through a config slice. See composition-root.md.",
  },
  {
    selector: "MemberExpression[object.name='globalThis'][property.name='process']",
    message: "Reaching the process object via globalThis bypasses the composition-root rule. See composition-root.md.",
  },
];

// Repeated from the standalone zod block at the top of `export default` so
// that any layer-specific `no-restricted-syntax` block also enforces it.
// Flat-config last-wins overwrites the broader zod block for overlapping
// files; spreading this entry in keeps the v4 deprecation ban active.
const ZOD_NATIVE_ENUM_ENTRY = {
  selector: "CallExpression[callee.object.name='z'][callee.property.name='nativeEnum']",
  message: "`z.nativeEnum(MyEnum)` is deprecated in zod v4. Use `z.enum(MyEnum)` instead.",
};

// Project-wide ban on importing from `app/shared/platform/infrastructure/`.
// By construction, there is no protocol-coupled layer in the cross-process
// kernel — anything cross-process is pure (it must be runnable from both
// backend and frontend). A directory of that name should not exist; this
// pattern catches any import attempt regardless of whether the directory
// has been created.
//
// Aliases come from tsconfig.json L49-L51 (the real ones — the previously
// speculated `@shared-platform-infrastructure/*` does not exist and would
// have silently no-op'd).
//
// This pattern is spread INTO every layer block that sets
// `no-restricted-imports` for `app/**` files (UI, shared kernel, SDK,
// domain, application, platform/shared, routes-only-controller-instances)
// so that flat-config last-wins doesn't drop it for layer files. The
// "Project-wide" block below catches the remaining files (app-root, main/,
// infrastructure/, platform/infrastructure/) that no layer block matches.
// Source: harness/knowledge/repo-architecture/backend/platform-conventions.md
//   "There is no `app/shared/platform/infrastructure/` — by construction,
//    anything cross-process is pure".
const SHARED_PLATFORM_INFRA_BAN_PATTERN = {
  group: [
    "@shared-platform/infrastructure/**",
    "~/shared/platform/infrastructure/**",
    "**/shared/platform/infrastructure/**",
  ],
  message: "app/shared/platform/infrastructure/ must not exist — anything cross-process is pure (cannot run protocol-coupled backend code from the frontend). See platform-conventions.md.",
};

export default [
  // ==========================================================================
  // File-name casing — enforced per layer to match each layer's convention.
  // The unicorn plugin's `filename-case` rule cannot express different cases
  // per glob in a single block, so we add one block per case + scope. Source:
  // harness/knowledge/code-standards/naming-conventions.md and the existing
  // file-naming patterns visible in each layer.
  //
  // Routes (`app/routes/**`) are intentionally NOT included: React Router's
  // file-based routing uses `$param`, `_layout`, dot-segments and other
  // non-kebab characters that aren't covered by any standard `filename-case`
  // mode. Storybook stories (`*.stories.tsx`) are also skipped because the
  // story file mirrors its component (PascalCase) by convention.
  // ==========================================================================
  {
    files: [
      "app/backend.server/**/*.{ts,tsx}",
      "app/shared/**/*.{ts,tsx}",
      "app/shared/agents/**/*.{ts,tsx}",
      "app/ui.client/components/**/*.{ts,tsx}",
      "app/ui.client/lib/**/*.{ts,tsx}",
      "app/ui.client/design-system/**/*.{ts,tsx}",
    ],
    ignores: [
      "**/*.stories.tsx",
    ],
    plugins: { unicorn: pluginUnicorn },
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          // `kebabCase` covers `enterprise-mongo-repo.ts`, `auth-middleware.server.ts`;
          // `pascalCase` covers component file siblings like `Toast.tsx` should
          // any be added (today most components live in PascalCase folders with
          // `index.tsx` + `types.ts`, both of which match `kebabCase`).
          cases: { kebabCase: true, pascalCase: true },
          // Don't flag dot-segmented compound filenames like `*.server.ts`,
          // `*.client.ts`, or test files — `unicorn/filename-case` checks each
          // dot-separated segment independently.
          ignore: ["\\.server\\.", "\\.client\\.", "\\.test\\.", "\\.unit\\.", "\\.e2e\\.", "\\.eval\\."],
        },
      ],
    },
  },

  // Hooks: `useXxxx.ts` — camelCase per React convention.
  // Hooks live in two places after the co-location migration:
  //   - `app/ui.client/lib/hooks/**` for cross-cutting infrastructure and
  //     typed parent-route loader-data accessors (e.g. `route-loaders/`).
  //   - `app/ui.client/components/**/use*.{ts,tsx}` for hooks co-located
  //     with the component dir or category that owns them.
  {
    files: ["app/ui.client/lib/hooks/**/*.{ts,tsx}", "app/ui.client/components/**/use*.{ts,tsx}"],
    plugins: { unicorn: pluginUnicorn },
    rules: {
      "unicorn/filename-case": ["error", { cases: { camelCase: true } }],
    },
  },

  // Tests: kebab-case with dot-segmented suffixes (`xxx.unit.test.ts`).
  // Same `kebabCase` rule with the test-segment ignore list so the dot-stages
  // (`unit`, `test`, `e2e`, `eval`) don't get flagged.
  {
    files: ["tests/**/*.{ts,tsx}"],
    plugins: { unicorn: pluginUnicorn },
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          cases: { kebabCase: true },
          ignore: ["\\.test\\.", "\\.unit\\.", "\\.e2e\\.", "\\.eval\\.", "\\.spec\\."],
        },
      ],
    },
  },

  // ==========================================================================
  // Zod usage — `z.nativeEnum` is deprecated in zod v4 in favour of
  // `z.enum(SomeEnum)` which now accepts native TypeScript enums directly.
  // Applied across all source files so domain schemas, route SDK schemas,
  // and shared validation all converge on the v4 API.
  // ==========================================================================
  {
    files: ["app/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ZOD_NATIVE_ENUM_ENTRY,
      ],
    },
  },

  // ==========================================================================
  // Global `process` ban for all backend code and routes. Only two files may
  // touch `process.env`: `main/run-config.ts` (the composition root's env
  // entry-point) and `platform/shared/env/env-utils.ts` (the mechanical
  // reader it delegates to).
  // Source:
  //   - composition-root.md L27 ("the only file allowed to read process.env")
  //     and the Allowed/Forbidden table for main/.
  //   - architecture-overview.md ("main reads process.env via
  //     platform/shared/env/env-utils.ts").
  //   - api-conventions.md (controllers "never read process.env").
  // Defence-in-depth: any layer-specific block that also sets
  // `no-restricted-syntax` MUST spread `PROCESS_NO_SYNTAX_ENTRIES` in (see
  // domain, application, and infrastructure new-ban blocks below).
  // ==========================================================================
  {
    files: ["app/backend.server/**/*.ts", "app/routes/**/*.{ts,tsx}"],
    ignores: [
      "app/backend.server/main/run-config.ts",
      "app/backend.server/platform/shared/env/**",
    ],
    rules: {
      "no-restricted-globals": ["error",
        {
          name: "process",
          message: "process.env may only be read in main/run-config.ts (the composition root) via platform/shared/env/env-utils.ts. Every other consumer goes through a config slice or the run-config aggregator. See composition-root.md.",
        },
      ],
      "no-restricted-syntax": ["error",
        ...PROCESS_NO_SYNTAX_ENTRIES,
        // Re-included so the ban remains active for files in this scope —
        // this block overwrites the broader zod block above for overlapping
        // files due to flat-config last-wins.
        ZOD_NATIVE_ENUM_ENTRY,
      ],
    },
  },

  // ==========================================================================
  // Project-wide ban on `app/shared/platform/infrastructure/` imports.
  // By construction there is no protocol-coupled layer in the cross-process
  // kernel — anything cross-process is pure. This block is placed BEFORE
  // every layer-specific `no-restricted-imports` block so that those blocks
  // (which override for files matching their globs) can keep enforcing
  // their layer-specific patterns; each layer block also spreads
  // `SHARED_PLATFORM_INFRA_BAN_PATTERN` in to keep this ban active.
  // Files not matched by any layer block (app-root, main/, infrastructure/,
  // platform/infrastructure/) get the ban from this block.
  // The matching path-existence assertion lives outside the linter (run via
  // `test ! -d app/shared/platform/infrastructure` as a prelint or by hand).
  // Source: harness/knowledge/repo-architecture/backend/platform-conventions.md
  //   "There is no `app/shared/platform/infrastructure/`".
  // ==========================================================================
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [SHARED_PLATFORM_INFRA_BAN_PATTERN],
      }],
    },
  },

  // ==========================================================================
  // Domain — purity: no infrastructure imports, no console, no fetch/process.
  // Source: harness/knowledge/repo-architecture/backend/domain-conventions.md
  // ==========================================================================
  {
    files: ["app/backend.server/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: COLLABORATION_LIBS, message: COLLAB_LIBS_MESSAGE },
          {
            group: REACT_AND_BROWSER_LIBS,
            message: "Domain must not depend on React/JSX or any browser-shaped code. See domain-conventions.md L143.",
          },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
      "no-restricted-globals": ["error",
        { name: "fetch", message: "Domain must not make HTTP calls. Network access belongs in infrastructure/gateways/ behind a gateway port." },
        // `process` repeated from the global backend+routes block above
        // because flat-config OVERWRITES `no-restricted-globals` for files
        // that match a later, more-specific block. Without this entry the
        // global ban would not apply to domain files.
        { name: "process", message: "Domain must not access process/env. process.env is read only in main/run-config.ts. See domain-conventions.md and composition-root.md." },
      ],
      "no-restricted-syntax": ["error",
        {
          selector: "CallExpression[callee.object.name='console']",
          message: "Domain must not use console. Logging belongs behind a logger gateway port; collaboration libraries live in infrastructure/.",
        },
        // Spread the global-block entries so this block (which overrides
        // for domain files due to flat-config last-wins) keeps them active.
        ZOD_NATIVE_ENUM_ENTRY,
        ...PROCESS_NO_SYNTAX_ENTRIES,
      ],
    },
  },

  // ==========================================================================
  // UI — no .server imports. Enforced alongside the boundaries plugin so the
  // error message catches both module-path and layer violations.
  // Source: harness/knowledge/repo-architecture/dependency-rules.md
  // ==========================================================================
  {
    files: ["app/ui.client/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["*.server", "*.server.*", "**/*.server", "**/*.server.*"],
            message: "UI must not import server-only modules. See dependency rules in harness repo architecture knowledge.",
          },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
    },
  },

  // ==========================================================================
  // Shared kernel — no framework imports. Shared is the dependency-tree leaf.
  // Source: harness/knowledge/repo-architecture/shared-kernel.md
  // ==========================================================================
  {
    files: ["app/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: COLLABORATION_LIBS, message: COLLAB_LIBS_MESSAGE },
          {
            group: REACT_AND_BROWSER_LIBS,
            message: "Shared must not depend on UI frameworks. Client-only code belongs in ui.client/. See shared kernel conventions in harness repo architecture knowledge.",
          },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
    },
  },

  // ==========================================================================
  // shared/agents — published-language schemas for external agent platforms.
  // Same purity constraints as the shared kernel (no collaboration libs, no
  // React) — these files must run on both backend and frontend.
  // Source: harness/knowledge/repo-architecture/shared-kernel.md §shared/agents
  // ==========================================================================
  {
    files: ["app/shared/agents/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: COLLABORATION_LIBS, message: COLLAB_LIBS_MESSAGE },
          {
            group: REACT_AND_BROWSER_LIBS,
            message: "shared/agents must not depend on UI frameworks — these schemas must be importable from both backend and frontend. See shared-kernel.md §shared/agents.",
          },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
    },
  },

  // ==========================================================================
  // SDK files — no server-only APIs. SDKs run on the client.
  // Source: harness/knowledge/repo-architecture/routes-architecture.md
  // ==========================================================================
  {
    files: ["app/routes/api/*._sdk.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@react-router/node", "@react-router/node/*"],
            message: "SDK files run on the client — no server-only imports. See routes architecture in harness repo architecture knowledge.",
          },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
    },
  },

  // ==========================================================================
  // Application services — purity: no collaboration libraries, no direct
  // network access. Application orchestrates ports; concrete IO happens in
  // infrastructure/ adapters injected via main/.
  // Source: harness/knowledge/repo-architecture/backend/application-conventions.md
  //   L13:  "It does not import collaboration libraries..."
  //   L41:  "SDK calls (mongodb, langchain, openai, ...) — those go behind ports"
  //   L196: "SDK imports (mongodb, langchain, openai, ...)"
  // `process` is covered at a wider scope by the global process ban below.
  // ==========================================================================
  {
    files: ["app/backend.server/application/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: COLLABORATION_LIBS, message: COLLAB_LIBS_MESSAGE },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
      "no-restricted-globals": ["error",
        { name: "fetch", message: "Application services must not make HTTP calls. Wrap external systems in a gateway port and inject via main/. See application-conventions.md." },
        // `process` repeated from the global backend+routes block above —
        // this block overwrites `no-restricted-globals` for application
        // files (flat-config last-wins). See composition-root.md.
        { name: "process", message: "Application services must not read process.env. Configuration enters via constructor injection from main/run-config.ts. See application-conventions.md and composition-root.md." },
      ],
    },
  },

  // ==========================================================================
  // platform/shared — purity: pure in-process backend computation. Cannot
  // import collaboration libraries and cannot import the cross-process
  // kernel `app/shared/`.
  // Source: harness/knowledge/repo-architecture/backend/platform-conventions.md
  //   "Allowed and Forbidden Imports" table for platform/shared/:
  //     Allowed:   platform/shared/ (other modules), computation libs.
  //     Forbidden: anything else in the repo, collaboration libs.
  // `process` is exempted from the wider backend ban below — env-utils.ts
  // is the legitimate sole reader.
  // ==========================================================================
  {
    files: ["app/backend.server/platform/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: COLLABORATION_LIBS,
            message: "platform/shared is pure in-process computation; collaboration libraries belong in platform/infrastructure or infrastructure/. See platform-conventions.md.",
          },
          {
            // Aliases are taken from tsconfig.json L49-L51. The `~/shared/`
            // form catches the project-internal path-alias spelling; the
            // bare `**/shared/**` form catches any pathological deep-relative
            // import. The cross-process kernel ban subsumes the
            // shared-platform-infrastructure ban below; it is still spread
            // in for symmetry across blocks.
            group: [
              "@shared/*", "@shared/**",
              "@shared-domain/*", "@shared-domain/**",
              "@shared-platform/*", "@shared-platform/**",
              "~/shared/**",
              "**/shared/**",
            ],
            message: "platform/shared (the most-isolated tier) cannot import the cross-process kernel app/shared/. See platform-conventions.md 'Allowed and Forbidden Imports' for platform/shared/.",
          },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
    },
  },

  // ==========================================================================
  // Application services — dependency-injection discipline. No direct
  // instantiation of repositories or integration clients; concrete wiring
  // belongs in main/application.instances.ts (the composition root).
  // Source: harness/knowledge/repo-architecture/backend/application-conventions.md
  // ==========================================================================
  {
    files: ["app/backend.server/application/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: "NewExpression[callee.name=/Repo$|Repository$|MongoRepo$/]",
          message: "Application services must not instantiate repositories directly. Use constructor injection against the repository port — wiring belongs in main/application.instances.ts. See application conventions in harness repo architecture knowledge.",
        },
        {
          selector: "NewExpression[callee.name=/Agent$|Client$|Adapter$/]",
          message: "Application services must not instantiate gateway adapters or integration clients directly. Use constructor injection against the gateway port — wiring belongs in main/application.instances.ts. See application conventions in harness repo architecture knowledge.",
        },
        // Spread the global-block entries so this block (which overrides
        // for application files due to flat-config last-wins) keeps them
        // active.
        ZOD_NATIVE_ENUM_ENTRY,
        ...PROCESS_NO_SYNTAX_ENTRIES,
      ],
    },
  },

  // ==========================================================================
  // Infrastructure (driving + driven adapters) — wider DI discipline.
  // No `new *Repo|Repository|Adapter|Client|Agent` outside main/. The
  // application block above carries a richer DI-specific message; this
  // block widens the ban to controllers, repositories, and gateways.
  // Scope is `infrastructure/**` only — DELIBERATELY excluding:
  //   - `platform/infrastructure/**` (legitimate place for SDK wrappers,
  //     e.g. `new MongoClient(config)`; see composition-root.md example).
  //   - `domain/` (collaboration-libs ban already prevents the imports
  //     needed to write the `new` expression).
  // Source: composition-root.md L9 ("no ring below the root ever calls
  //   `new` on an infrastructure class"); dependency-rules.md ("no direct
  //   `new *Repo()` / `new *Client()` outside `main/`").
  // ==========================================================================
  {
    files: ["app/backend.server/infrastructure/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: "NewExpression[callee.name=/Repo$|Repository$|MongoRepo$/]",
          message: "Concrete repositories are instantiated only in main/application.instances.ts. See composition-root.md.",
        },
        {
          selector: "NewExpression[callee.name=/Adapter$|Client$|Agent$/]",
          message: "Concrete gateway adapters / integration clients are instantiated only in main/application.instances.ts. See composition-root.md.",
        },
        // Spread the global-block entries so this block (which overrides
        // for infrastructure files due to flat-config last-wins) keeps
        // them active.
        ZOD_NATIVE_ENUM_ENTRY,
        ...PROCESS_NO_SYNTAX_ENTRIES,
      ],
    },
  },

  // ==========================================================================
  // Controllers (driving adapters) — thin delegation heuristic (line-count
  // warning), class-name suffix, and the "no port imports" ban.
  //
  // Why a separate ban here: the boundaries plugin (see
  // `repo-architecture/boundaries.js`) classifies elements by directory
  // pattern — `*.repo.ts` ports under `domain/` are part of the
  // `backend-domain` element and `*.gateway.ts` ports under `application/`
  // are part of the `backend-application` element. Controllers are
  // ALLOWED to type-import from `backend-domain` (for enums/value objects
  // used in DTO mappers) and to value-import from `backend-application`
  // (services). Boundaries cannot express "all of element X except files
  // matching pattern Y", so a controller can sneak past the matrix with
  // `import type { UserRepo } from "@backend-domain/.../user.repo"` —
  // structurally a type-only import from `backend-domain`, but
  // semantically an architectural bug per api-conventions.md L42:
  //   "Controllers do not import repository or gateway ports, do not
  //    import domain services, and do not call them transitively."
  // The path-based ban below catches the loophole at lint time.
  //
  // Flat-config last-wins: this block overwrites the project-wide
  // `no-restricted-imports` block (the cross-process kernel ban) for
  // controller files, so we re-spread `SHARED_PLATFORM_INFRA_BAN_PATTERN`
  // to keep that ban active here too.
  // Source: harness/knowledge/repo-architecture/backend/api-conventions.md
  //   §"Controllers Always Call an Application Service" (L34-L42).
  // ==========================================================================
  {
    files: ["app/backend.server/infrastructure/api/**/*.ts"],
    rules: {
      "max-lines-per-function": ["warn", { max: 15, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "class", format: ["PascalCase"], suffix: ["Controller"] },
      ],
      "no-restricted-imports": ["error", {
        patterns: [
          {
            // Repository ports live in `domain/**/*.repo.ts`; gateway ports
            // in `application/**/*.gateway.ts`. Controllers must not depend
            // on either — even type-only — because once the import compiles
            // the path of least resistance becomes "just call the port
            // method directly" and the seam where authorization, DTO
            // translation, and transaction boundaries belong gets bypassed.
            // The patterns match both relative paths and the `@backend-*`
            // tsconfig aliases (L42-L60 of tsconfig.json) since both
            // resolve to the literal import string before this rule sees
            // it.
            group: [
              "**/*.repo",
              "**/*.repo.ts",
              "**/*.gateway",
              "**/*.gateway.ts",
            ],
            message: "Controllers must call an application service — never import a repository or gateway port (not even `import type`). See api-conventions.md §Controllers Always Call an Application Service.",
          },
          SHARED_PLATFORM_INFRA_BAN_PATTERN,
        ],
      }],
    },
  },

  // ==========================================================================
  // Application services — class-name suffix enforcement.
  // Source: harness/knowledge/code-standards/naming-conventions.md
  //         harness/knowledge/repo-architecture/dependency-rules.md (file-naming table)
  // ==========================================================================
  {
    files: ["app/backend.server/application/**/*.ts"],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "class", format: ["PascalCase"], suffix: ["Service"] },
      ],
    },
  },

  // ==========================================================================
  // Repositories (driven adapters) — class-name suffix enforcement
  // (`Repo` or `Repository`). The `*.model.ts` files contain Typegoose entity
  // classes (e.g. `ReportModel`) whose name must end in `Model` for typegoose's
  // `getModelForClass` discovery to work; they are not repository classes and
  // are excluded here.
  // Source: harness/knowledge/repo-architecture/backend/repositories-conventions.md
  //         harness/knowledge/code-standards/naming-conventions.md
  // ==========================================================================
  {
    files: ["app/backend.server/infrastructure/repositories/**/*.ts"],
    ignores: [
      "app/backend.server/infrastructure/repositories/**/*-model.ts",
      "app/backend.server/infrastructure/repositories/**/*-models.ts",
      "app/backend.server/infrastructure/repositories/**/*.model.ts",
    ],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "class", format: ["PascalCase"], suffix: ["Repo", "Repository"] },
      ],
    },
  },

  // ==========================================================================
  // Gateway adapters (driven adapters) — class-name suffix enforcement
  // (`Adapter`). Gateway ports live in inner rings and end in `.gateway.ts`;
  // their concrete adapters live here under infrastructure/gateways/.
  // Source: harness/knowledge/repo-architecture/backend/gateways-conventions.md
  // ==========================================================================
  {
    files: ["app/backend.server/infrastructure/gateways/**/*.ts"],
    ignores: [
      "app/backend.server/infrastructure/gateways/**/config.ts",
      "app/backend.server/infrastructure/gateways/**/types.ts",
      "app/backend.server/infrastructure/gateways/**/*.types.ts",
    ],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "class", format: ["PascalCase"], suffix: ["Adapter"] },
      ],
    },
  },

  // ==========================================================================
  // Routes — only the composition root's controller graph is importable
  // from `@backend-main/...`. The boundaries plugin already prevents routes
  // from reaching anything else under `app/backend.server/`; this block
  // adds explicit, friendly error messages for the three known sibling
  // entry-point modules that exist under `main/` today.
  // If a new file lands under `app/backend.server/main/`, add its alias to
  // the `paths:` list. The trade-off is honesty over a brittle wildcard
  // pattern-negation that depends on alias-resolver evaluation order.
  // Source: composition-root.md L168 ("the controller graph"); the
  // routes-architecture.md "Allowed imports" tables for both page and API
  // routes list `backend.server/main/controller.instances.ts` specifically.
  // ==========================================================================
  {
    files: ["app/routes/pages/**/*.{ts,tsx}", "app/routes/api/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@backend-main/application.instances",
            message: "Routes must only import @backend-main/controller.instances. application.instances is wiring-only — see composition-root.md.",
          },
          {
            name: "@backend-main/run-config",
            message: "Routes must not read configuration directly. Configuration enters via main/ and is injected into controllers. See composition-root.md.",
          },
          {
            name: "@backend-main/entry-point",
            message: "Routes must not import the entry-point file. See composition-root.md.",
          },
        ],
        patterns: [SHARED_PLATFORM_INFRA_BAN_PATTERN],
      }],
    },
  },
];
