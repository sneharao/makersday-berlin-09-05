// Design-system + Tailwind hygiene — backs `code-standards/ui/design-system.md`.
//
// Uses `eslint-plugin-better-tailwindcss` (Tailwind v4-aware). We deliberately
// skip the stylistic bundle (line-wrapping/ordering) — Prettier already owns
// formatting. The rules below are correctness-focused: they catch class
// conflicts, duplicates, and references to classes that don't resolve in the
// project's Tailwind v4 setup. The `entryPoint` setting points the plugin at
// the project's CSS entry so it understands custom utilities (e.g. `p-m`,
// `bg-surface-primary`, `text-text-subtle`).

import pluginBetterTailwind from "eslint-plugin-better-tailwindcss";

export default [
  {
    files: ["app/ui.client/**/*.{ts,tsx,jsx,js}"],
    plugins: {
      "better-tailwindcss": pluginBetterTailwind,
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "app/ui.client/design-system/styles/tailwind.css",
      },
    },
    rules: {
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unknown-classes": "error",
    },
  },
];
