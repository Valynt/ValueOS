import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import globals from "globals";
import tseslint from "typescript-eslint";

const ignoresConfig = {
  ignores: ["dist", "node_modules"],
};

const valyntAppConfig = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
    "jsx-a11y": jsxA11y,
    import: importPlugin,
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
    security: security,
  },
  rules: {
    ...js.configs.recommended.rules,
    ...tseslint.configs.recommended[0].rules,
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
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "security/detect-object-injection": "warn",
    // "security/detect-non-literal-fs-filename": "error", // Disabled due to ESLint 9 compatibility
    // ADR-0014 / Phase 8: All REST calls to /api/ routes must use UnifiedApiClient.
    // Raw fetch() to backend API routes bypasses auth, retry, and error handling.
    // Exceptions must carry an inline comment explaining why (see useAuditLog.ts,
    // OrganizationUsers.tsx, useWebVitals.ts, securityHeaders.ts, llm/client.ts).
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.name='fetch'][arguments.0.type='Literal'][arguments.0.value=/^\\/api\\//]",
        message: "Use apiClient from unified-api-client instead of raw fetch() for /api/ routes.",
      },
      {
        selector: "CallExpression[callee.name='fetch'][arguments.0.type='TemplateLiteral']",
        message: "Use apiClient from unified-api-client instead of raw fetch() for API calls.",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@valueos/backend", "@valueos/backend/*"],
            message: "Backend imports forbidden - use HTTP API",
          },
          { group: ["@valueos/shared/lib/logger"], message: "Node-only - use local logger" },
          {
            group: ["@valueos/shared/lib/redisClient", "@valueos/shared/lib/redisKeys"],
            message: "Node-only",
          },
        ],
      },
    ],
  },
};

export default [ignoresConfig, valyntAppConfig];
