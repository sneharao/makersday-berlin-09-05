# Run Checks

Run all local verification checks to confirm the code compiles. This skill is referenced by the build stage (`002_build.md`) and the fix stage (`004_apply_fixes.md`).

---

## Check Suite (current)

Run all three before considering code verified.

### 1. Type Checking

```bash
npm run typecheck
```

Runs `react-router typegen` followed by `tsc --noEmit` against the project's `tsconfig.json`. Must exit with code 0 and produce no errors.

Common failures:
- Missing imports after adding new files.
- Mismatched types between Zod schemas and TypeScript interfaces.
- Stale references to renamed or deleted exports.

### 2. Build Verification

```bash
npm run build
```

Runs the React Router production build (Vite/Rollup). Must exit with code 0.

This catches failure classes that `tsc` does not: unresolved import aliases, dynamic imports that can't be statically analysed, SSR/client boundary violations, env vars required at build time, and circular dependencies that break tree-shaking. A failing `build` blocks deploy, so it must pass on every PR.

### 3. Tests

```bash
npm run test
```

Runs the [Vitest](https://vitest.dev/) suite once. Picks up `tests/**/*.test.ts` and `tests/**/*.integration.test.ts`. Must exit with code 0.

For TDD work, use `npm run test:watch`. For coverage, use `npm run test:coverage` (V8 reporter).

### 4. Smoke Run (optional)

```bash
npm run dev
```

Starts the React Router dev server. Useful as a smoke check before committing — confirm the app boots without runtime errors. See [`skills/development/run-app-in-browser.md`](../development/run-app-in-browser.md) for the full browser flow.

---

## Planned (added when adopted)

These commands are not present in `package.json` today. They will be added — and this document expanded — once the relevant tooling is chosen:

- **Formatting** (e.g. Prettier) — `npm run format`, `npm run format:check`
- **Linting** (e.g. ESLint with typed-linting and `eslint-plugin-boundaries`) — `npm run lint`, `npm run lint:fix`
- **End-to-end tests** — `npm run test:e2e`

When you wire any of these in, update this file with the command, what it covers, and how to interpret typical failures.

---

## Interpreting Failures

### Type check failures

Read the error output carefully — `tsc` reports file, line, and the expected vs actual type. Fix the type mismatch at the source. Do not use `as any` or `@ts-ignore` to suppress errors.

### Build failures

`npm run build` failures usually surface as Vite/Rollup errors with a file and import path. Common causes: an alias unresolved by the bundler (check `vite.config.ts`), a server-only module imported into a client bundle (or vice versa), a missing build-time env var, or a top-level side effect that can't be statically analysed. Reproduce locally with the exact command from CI — do not rely on `npm run dev`, which uses different module resolution.

---

## Rules

- All currently available checks (`typecheck`, `build`, `test`) must pass before committing and pushing.
- Do not suppress type errors with `as any` or `@ts-ignore`.
- When a test runner is added, do not skip or `.skip()` failing tests to make the suite pass.
- If a pre-existing failure is unrelated to your change, flag it — do not silently ignore it.
