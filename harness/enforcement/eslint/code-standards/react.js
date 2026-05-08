import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import pluginJsdoc from "eslint-plugin-jsdoc";

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: pluginReact,
      "jsx-a11y": pluginJsxA11y,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReact.configs["jsx-runtime"].rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginJsxA11y.configs.recommended.rules,
      // Bans `class XxxComponent extends React.Component`; the codebase is
      // strictly functional + hooks (`code-standards/ui/react-patterns.md` →
      // "Functional components only").
      "react/prefer-stateless-function": "error",
    },
    settings: {
      react: { version: "detect" },
      formComponents: ["Form"],
      linkComponents: [
        { name: "Link", linkAttribute: "to" },
        { name: "NavLink", linkAttribute: "to" },
      ],
    },
  },

  // JSDoc validation for TypeScript files. We enforce *correctness* of any
  // JSDoc that's already written (matching tag names, param names, types) but
  // intentionally do NOT enable `jsdoc/require-jsdoc` here — adding doc-strings
  // to every existing prop is a separate, doc-quality pass and is not blocked
  // by linting today. `jsdoc/no-types` keeps TS files free of redundant JSDoc
  // type annotations; types come from the type system.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      jsdoc: pluginJsdoc,
    },
    rules: {
      "jsdoc/check-alignment": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": "error",
      "jsdoc/no-bad-blocks": "error",
      "jsdoc/no-types": "error",
      "jsdoc/no-undefined-types": "error",
    },
    settings: {
      jsdoc: {
        mode: "typescript",
      },
    },
  },
];
