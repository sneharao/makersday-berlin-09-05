import pluginImportX from "eslint-plugin-import-x";

// Import-x plugin configuration + recommended rule sets. Scoped to ts/tsx
// to match the original block that mixed this with typescript rules.
export const importPlugin = [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "import-x": pluginImportX,
    },
    settings: {
      "import-x/internal-regex": "^~/",
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
        node: {
          extensions: [".ts", ".tsx"],
        },
      },
    },
    rules: {
      ...pluginImportX.configs.recommended.rules,
      ...pluginImportX.configs.typescript.rules,
      // Order mirrors the four-group convention in
      // harness/knowledge/code-standards/naming-conventions.md#import-order:
      // external → react-router → internal aliases → relative.
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [
            { pattern: "react", group: "external", position: "before" },
            { pattern: "react/**", group: "external", position: "before" },
            { pattern: "react-router", group: "external", position: "after" },
            { pattern: "react-router/**", group: "external", position: "after" },
            { pattern: "@react-router/**", group: "external", position: "after" },
            { pattern: "@/**", group: "internal" },
            { pattern: "~/**", group: "internal" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "ignore",
          alphabetize: { order: "ignore" },
        },
      ],
      "import-x/no-duplicates": "error",
      "import-x/newline-after-import": "error",
    },
  },
];

// No re-exports. Kept as a separate export because in the composer it must
// follow the per-layer rule blocks so the original `no-restricted-syntax`
// last-wins behaviour is preserved.
export const noReExports = [
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: "ExportNamedDeclaration[source]",
          message: "Do not re-export from another module. Consumers should import from the source directly.",
        },
      ],
    },
  },
];
