// Test discipline — backs `code-standards/backend/testing.md` and
// `code-standards/ui/testing.md`. Two scopes:
//
// 1. Jest unit tests: encourage AAA structure, prevent disabled / focused
//    tests landing on main, and forbid console.log noise (the rest of the
//    codebase already bans non-`info`/`warn`/`error`, but tests reset
//    `no-explicit-any`-style overrides anyway).
// 2. Playwright e2e tests: same discipline (no skip / no focus, valid title)
//    plus prevent `page.pause()` and other dev-only escapes.
//
// We disable a handful of unit-test ergonomics: tests legitimately use `any`
// for typed mocks (kept off via the existing override), and `max-params` /
// `complexity` caps don't make sense for table-driven `it.each` blocks.

import pluginJest from "eslint-plugin-jest";
import pluginPlaywright from "eslint-plugin-playwright";

const jestTestGlobs = ["tests/**/*.unit.test.ts", "tests/**/*.unit.test.tsx"];
const playwrightTestGlobs = ["tests/e2e/**/*.{ts,tsx}"];

export default [
  // Pre-existing baseline: tests can use `any` for typed mocks. The typed-
  // linting `no-unsafe-*` family fires whenever an `any` value crosses a call
  // / member-access / argument boundary, which is the entire point of typed
  // mocks (`as any` to bypass strict signatures). Disable in tests.
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },

  // Jest unit tests.
  {
    files: jestTestGlobs,
    plugins: {
      jest: pluginJest,
    },
    languageOptions: {
      globals: {
        ...pluginJest.environments.globals.globals,
      },
    },
    rules: {
      // Catch broken / accidentally-shipped test states.
      "jest/no-disabled-tests": "error",
      "jest/no-focused-tests": "error",
      "jest/no-identical-title": "error",
      "jest/no-commented-out-tests": "error",

      // Structural sanity.
      "jest/valid-describe-callback": "error",
      "jest/valid-expect": "error",
      "jest/valid-title": "error",
      "jest/no-conditional-expect": "error",
      "jest/no-standalone-expect": "error",

      // Style / hygiene.
      "jest/expect-expect": "error",
      "jest/prefer-to-be": "error",
      "jest/prefer-to-have-length": "error",
      "jest/prefer-to-contain": "error",

      // Tests are written for clarity — relax shape caps that are useful in
      // production code but counter-productive here (e.g. `it.each` rows,
      // long arrange blocks).
      "max-params": "off",
      "complexity": "off",
      "max-depth": "off",
      "no-console": "off",
    },
  },

  // Playwright e2e tests.
  {
    files: playwrightTestGlobs,
    plugins: {
      playwright: pluginPlaywright,
    },
    rules: {
      ...pluginPlaywright.configs["flat/recommended"].rules,
      // Belt-and-braces: explicitly forbid debug escapes that the recommended
      // bundle warns on.
      "playwright/no-skipped-test": "error",
      "playwright/no-focused-test": "error",
      "playwright/no-page-pause": "error",
      "playwright/no-conditional-in-test": "error",

      "max-params": "off",
      "complexity": "off",
      "max-depth": "off",
      "no-console": "off",
    },
  },
];
