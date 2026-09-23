import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },

  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    // React-specific rules. `react-hooks` catches stale-closure and dependency
    // bugs, which is exactly the class of mistake the dialogs in
    // presentation/actions.tsx are exposed to.
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // eslint-plugin-react-hooks v7 bundles the React Compiler purity rules
      // (static-components, set-state-in-effect, immutability, globals). This
      // project targets React 18 without the compiler, and the remaining hits
      // are the "reset the form when the modal opens" effect — a pattern that
      // is correct here and pinned by the test suite. Kept as warnings so they
      // stay visible as migration debt instead of blocking CI.
      "react-hooks/set-state-in-effect": "warn",

      // ui.tsx, i18n.tsx and charts.tsx intentionally co-locate helpers
      // (fmtCents, inputCls, useToast, cls, palette) with components. The rule
      // only governs dev-server fast-refresh granularity, and splitting these
      // modules would hurt more than it helps.
      "react-refresh/only-export-components": "off",
    },
  },

  {
    // The offline shell runs in a worker, not a window, and reads two
    // identifiers that vite.config.js injects at build time.
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        __CFC_ASSETS__: "readonly",
        __CFC_BUILD__: "readonly",
      },
    },
  }
);
