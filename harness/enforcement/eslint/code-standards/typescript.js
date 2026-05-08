import tseslint from "typescript-eslint";

// TypeScript-specific rules. Several rules below (`prefer-readonly`,
// `only-throw-error`) require type information and rely on the
// `parserOptions.projectService` enabled in tooling/language-options.js.
//
// `consistent-type-assertions` uses `objectLiteralTypeAssertions: "never"` to
// push object-literal payloads to use `satisfies` (per typescript-and-zod.md
// and backend/api-conventions.md) while still permitting call-expression casts
// like `await request.json() as RequestType`.

export default [
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Typed-linting rules — depend on `parserOptions.projectService` (Phase 0).
      // Together they upgrade the compiler's `noImplicitAny` story by catching
      // the *use* of `any` at the call site (`no-unsafe-*`) and surfacing
      // forgotten `await`s on promise-returning calls (`no-floating-promises`).
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-member-accessibility": ["error", {
        accessibility: "explicit",
        overrides: {
          constructors: "no-public",
        },
      }],
      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "separate-type-imports",
      }],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-expect-error": { descriptionFormat: "^: .+" },
        "ts-ignore": true,
        "ts-nocheck": true,
        "ts-check": false,
      }],
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", {
        assertionStyle: "as",
        objectLiteralTypeAssertions: "never",
      }],
      "@typescript-eslint/only-throw-error": ["error", {
        // React Router uses `throw redirect(...)` and `throw new Response(...)`
        // as a control-flow idiom; both produce Response objects. Allow them.
        allow: [{ from: "lib", name: "Response" }],
      }],
      "prefer-const": "error",
      // Scoped to ts/tsx only (current behaviour) — do not move to react.js, it would broaden the glob.
      "react/prop-types": "off",
      // ----------------------------------------------------------------------
      // Naming conventions — backs harness/knowledge/code-standards/naming-conventions.md
      // (intent-revealing PascalCase / camelCase / UPPER_CASE rules).
      //
      // The `interface` selector enforces plain PascalCase and explicitly bans
      // the legacy `^I[A-Z]` Hungarian prefix (e.g. `IFoo`); use bare PascalCase
      // names instead. Suffixes like `Props` / `State` / `Args` / `Config` /
      // `Options` / `Schema` remain recommended in naming-conventions.md as
      // intent-revealing hints but are no longer required by the linter.
      //
      // The module-level constants selector relies on type information (Phase 0
      // enabled `projectService`); without it, the `types` filter would silently
      // match nothing.
      //
      // The class-extends-Error selector enforces the `*Error` suffix from
      // error-handling.md without needing a custom rule.
      // ----------------------------------------------------------------------
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow", trailingUnderscore: "allow" },
        { selector: "variable", format: ["camelCase", "UPPER_CASE", "PascalCase"], leadingUnderscore: "allow" },
        { selector: "parameter", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        // `leadingUnderscore: "allow"` keeps the `_findById`/`_insert` convention
        // used by `Repository` for protected helpers that subclasses delegate to.
        { selector: "method", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "accessor", format: ["camelCase"] },
        { selector: "memberLike", modifiers: ["private"], format: ["camelCase"], leadingUnderscore: "allow" },
        // Static readonly class properties act like module-level constants.
        { selector: "classProperty", modifiers: ["static", "readonly"], format: ["UPPER_CASE", "camelCase"] },
        { selector: "objectLiteralProperty", format: null },
        { selector: "typeProperty", format: null },
        { selector: "import", format: ["camelCase", "PascalCase"] },
        { selector: "typeLike", format: ["PascalCase"] },
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: {
            // Forbid the legacy `IFoo` Hungarian prefix; use bare PascalCase.
            regex: "^I[A-Z]",
            match: false,
          },
        },
        { selector: "enum", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        {
          selector: "variable",
          modifiers: ["const", "global"],
          types: ["string", "number", "boolean"],
          format: ["UPPER_CASE", "camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "class",
          modifiers: ["abstract"],
          format: ["PascalCase"],
        },
        {
          selector: "class",
          format: ["PascalCase"],
          filter: { regex: "Error$", match: true },
          suffix: ["Error"],
        },
      ],
    },
  },
];
