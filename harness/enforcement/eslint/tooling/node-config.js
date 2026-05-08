import globals from "globals";

// Node globals for files that run in the Node context (ESLint config, Vite/
// Tailwind config, and every module under `eslint/` that makes up the
// composed flat config). Glob is forward-looking: no pre-refactor file is
// affected by adding `eslint/**/*.js`.

export default [
  {
    files: [
      "eslint.config.js",
      "harness/enforcement/eslint/**/*.js",
      "vite.config.ts",
      "tailwind.config.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
];
