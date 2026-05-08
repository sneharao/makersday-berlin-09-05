// Error & logging discipline — backs `code-standards/error-handling.md`:
//   * Logging: prefer `console.error` (and `console.warn`) over chatty
//     `console.log` / `console.info` / `console.debug`. Encourages routing
//     observability through Datadog RUM / structured logs instead of `stdout`.
//   * Don't swallow failures: `no-empty` (already on via recommended) is
//     re-asserted with `allowEmptyCatch: false`.
//   * Don't return null in the backend domain layer: the domain should never
//     hand a `null` back to its callers — return empty collections, throw a
//     domain error, or use the Null Object pattern. Scoped narrowly so the
//     rule lands as `error` without forcing a sweep through the auth/service
//     layers that currently rely on `T | null` returns.

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // Allow `info`/`warn`/`error` — these map to standard log levels and
      // back the doc's "Use `console.error` for error-level logging" guidance
      // while leaving room for lifecycle/operational logs (Mongo connect,
      // RUM init, etc.) at `info`. `console.log` and `console.debug` are
      // banned: prefer an explicit level so future log-shipping configuration
      // can route by severity.
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },

  // Storybook config + this enforcement folder itself are tooling files; CLI
  // scripts and configs need `console.log` to communicate with humans.
  {
    files: [
      ".storybook/**/*.{ts,tsx,js}",
      "harness/enforcement/**/*.js",
      "*.config.{js,ts,mjs,cjs}",
    ],
    rules: {
      "no-console": "off",
    },
  },

  // Backend domain layer — pure business logic. Returning `null` here forces
  // every service caller to remember a null-check; instead throw a domain
  // error or return an empty collection / Null Object.
  {
    files: ["app/backend.server/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ReturnStatement[argument.type='Literal'][argument.value=null]",
          message:
            "Don't return null from the domain layer. Throw a domain error, return an empty collection, or use the Null Object pattern (see code-standards/error-handling.md → 'Don't Return Null').",
        },
      ],
    },
  },
];
