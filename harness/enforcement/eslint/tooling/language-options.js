import globals from "globals";

// `projectService: true` enables typescript-eslint's typed-linting service so
// rules that need type information (e.g. `@typescript-eslint/prefer-readonly`,
// `only-throw-error`, the `naming-convention` `types` filter, the Phase 8
// `no-unsafe-*` rules) work without needing an explicit `project` field. The
// service discovers tsconfigs automatically (root `tsconfig.json` plus
// `tests/tsconfig.json`). Lint runtime increases noticeably; this is the cost
// of typed linting and is documented in `harness/skills/testing/run-code-checks.md`.

export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        // `allowDefaultProject` lets the .storybook entry files (which are not
        // matched by tsconfig `include` because of the leading dot) be linted
        // via an inferred default project rather than failing parser setup.
        projectService: {
          allowDefaultProject: [".storybook/main.ts", ".storybook/preview.ts"],
        },
      },
    },
  },
];
