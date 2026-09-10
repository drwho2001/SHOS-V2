// eslint.config.js
//
// ADDED 10 Sep 2026 — real ask: "smoke lint type check whatever this is
// do it if needed." This project had zero automated linting before
// this file — every real bug this session's own CLAUDE.md documents
// (unawaited async calls, stale closures, missing hook dependencies)
// is exactly the class of thing react-hooks/exhaustive-deps and a few
// core ESLint rules catch mechanically. Deliberately scoped to real
// bug-catching rules, not a large stylistic rule set — this app has no
// prior lint history to match, so a strict style ruleset today would
// be pure noise on ~40k lines of already-working code.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "android", "node_modules"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      // __BUILD_SHA__ is a real Vite `define` build-time constant
      // (vite.config.js), not a genuine undefined-global bug.
      globals: { ...globals.browser, ...globals.node, __BUILD_SHA__: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      // Deliberately NOT eslint-plugin-react-hooks' own "recommended"
      // config — v7 bundles several new, React-Compiler-aligned rules
      // (static-components/set-state-in-effect/immutability/purity/etc.)
      // that flag long-standing, already-proven patterns this app uses
      // deliberately (e.g. the "quick-add deep-link" effect pattern,
      // verified live many times over this project's history) as hard
      // errors. Scoped to the two rules with genuine, PROVEN value for
      // this specific codebase: rules-of-hooks (a real correctness
      // rule) and exhaustive-deps (the exact bug class — a stale
      // closure from a missing effect dependency — behind a large
      // fraction of the real regressions this project's own CLAUDE.md
      // documents being found and fixed one at a time, by hand, over
      // many sessions).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": "off",
      // Off, not error: this codebase intentionally destructures unused
      // fields in a few places for shape-documentation purposes, and a
      // blanket "no-unused-vars" pass on 40k pre-existing lines is a
      // separate, much larger cleanup than this real-bug-catching pass
      // is scoped for. Real dead-code/unused-var cleanup is a
      // legitimate future follow-up, not part of "add linting."
      "no-unused-vars": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
