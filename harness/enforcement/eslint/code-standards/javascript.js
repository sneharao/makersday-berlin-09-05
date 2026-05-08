import js from "@eslint/js";
import pluginUnicorn from "eslint-plugin-unicorn";

// Base JS rules + cross-language language/mutation discipline.
// `no-var`, `no-param-reassign`, `prefer-spread`, `prefer-object-spread`, and
// the unicorn rules back the "Functional programming preferred — over mutation"
// and "Throw Error subclasses" sections in design-principles.md and
// error-handling.md.

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      unicorn: pluginUnicorn,
    },
    rules: {
      "no-var": "error",
      "no-param-reassign": ["error", { props: true }],
      "prefer-spread": "error",
      "prefer-object-spread": "error",
      "unicorn/throw-new-error": "error",
      "unicorn/error-message": "error",
      "unicorn/no-array-push-push": "error",
      "unicorn/prefer-spread": "error",
      // Function-shape caps — back "Introduce parameter object", "Guard clauses",
      // and "Small functions" in design-principles.md. Auto-fix is not available
      // for any of these; each violation needs human refactoring (extracted helper,
      // parameter object, guard-clause flatten).
      // `max-params` counts declared parameter slots regardless of destructuring,
      // so handlers/components taking a single destructured object (`{ request }`)
      // remain at 1 — the cap targets long positional argument lists.
      // The cap of 4 is intentionally permissive enough to allow the common
      // `(a, b, c, options)` shape without forcing a parameter object; functions
      // with five or more positional params should adopt one.
      "max-params": ["error", 4],
      "max-depth": ["error", 3],
      "no-else-return": ["error", { allowElseIf: false }],
      complexity: ["error", 10],
    },
  },
];
