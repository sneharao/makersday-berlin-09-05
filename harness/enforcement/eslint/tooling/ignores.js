// Global ignores. Must be applied first so ESLint never attempts to parse
// these directories. A config object containing only `ignores` (no `files`,
// no `rules`) acts as a global ignore in flat config.

export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "public/build/**",
      "deploy/**",
      "deployment/**",
      ".react-router/**",
      "storybook-static/**",
      "app-legacy/**",
      "scripts/**",
    ],
  },
];
