import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      import: importPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      security: security,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "import/no-unresolved": "off",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-fs-filename": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@valueos/backend", "@valueos/backend/*"], message: "Backend imports forbidden - use HTTP API" },
            { group: ["@valueos/shared/lib/logger"], message: "Node-only - use local logger" },
            { group: ["@valueos/shared/lib/redisClient", "@valueos/shared/lib/redisKeys"], message: "Node-only" },
          ],
        },
      ],
    },
  }
);
