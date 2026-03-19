import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
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
    globals: {
      ...globals.browser,
      ...globals.node,
      React: "readonly",
    },
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      jsxPragma: null, // React 17+ automatic JSX transform
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
    "jsx-a11y": jsxA11y,
    react: react,
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
    // Disable base rules that TypeScript handles
    "no-unused-vars": "off",
    "no-undef": "off",
    "no-redeclare": "off",
    // Match root config: downgrade these from js.configs.recommended errors to warnings
    "no-case-declarations": "warn",
    "no-useless-escape": "warn",
    "no-useless-catch": "warn",
    // Downgrade problematic jsx-a11y rules to warnings (address incrementally)
    "jsx-a11y/label-has-associated-control": "warn",
    "jsx-a11y/anchor-is-valid": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/no-noninteractive-element-interactions": "warn",
    "jsx-a11y/no-noninteractive-tabindex": "warn",
    "jsx-a11y/no-autofocus": "warn",
    "jsx-a11y/no-redundant-roles": "warn",
    "jsx-a11y/heading-has-content": "warn",
    "jsx-a11y/role-supports-aria-props": "warn",
    "jsx-a11y/role-has-required-aria-props": "warn",
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
    "react/no-danger": "error",
    "security/detect-object-injection": "warn",
    // "security/detect-non-literal-fs-filename": "error", // Disabled due to ESLint 9 compatibility
    // ADR-0014 / Phase 8: All REST calls to /api/ routes must use UnifiedApiClient.
    // Raw fetch() to backend API routes bypasses auth, retry, and error handling.
    // Exceptions (src/lib/, src/utils/): fire-and-forget analytics, external APIs, CSP reporting.
    // Mark confirmed exceptions with: // legitimate-exception: <reason>
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.name='fetch'][arguments.0.type='Literal'][arguments.0.value=/^\\/api\\//]",
        message:
          "Use apiClient from unified-api-client instead of raw fetch() for /api/ routes. Add '// legitimate-exception: <reason>' if this is intentional.",
      },
      {
        selector: "CallExpression[callee.name='fetch'][arguments.0.type='TemplateLiteral']",
        message:
          "Use apiClient from unified-api-client instead of raw fetch() for API calls. Add '// legitimate-exception: <reason>' if this is intentional.",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        paths: [
          { name: "fs", message: "Browser code must not import Node built-ins." },
          { name: "node:fs", message: "Browser code must not import Node built-ins." },
          { name: "crypto", message: "Browser code must not import Node built-ins." },
          { name: "node:crypto", message: "Browser code must not import Node built-ins." },
          { name: "events", message: "Browser code must not import Node built-ins." },
          { name: "node:events", message: "Browser code must not import Node built-ins." },
          { name: "path", message: "Browser code must not import Node built-ins." },
          { name: "node:path", message: "Browser code must not import Node built-ins." },
          { name: "node-vault", message: "Browser code must not import server-only secret adapters." },
          { name: "@aws-sdk/client-secrets-manager", message: "Browser code must not import server-only secret adapters." },
        ],
        patterns: [
          {
            group: ["@valueos/backend", "@valueos/backend/*"],
            message: "Backend imports forbidden - use HTTP API",
          },
          { group: ["@valueos/shared/lib/logger"], message: "Node-only - use local logger" },
          { group: ["@/config/secrets/*"], message: "Secret providers are server-only and live in packages/backend/src/config/secrets" },
          {
            group: ["@valueos/shared/lib/redisClient", "@valueos/shared/lib/redisKeys"],
            message: "Node-only",
          },
        ],
      },
    ],
    "no-restricted-properties": [
      "error",
      {
        object: "process",
        property: "env",
        message: "Browser code must use import.meta.env with VITE_-prefixed variables.",
      },
    ],
  },
};

// Test files: enable vitest globals (expect, it, describe, vi, beforeEach, etc.)
const testConfig = {
  files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
  languageOptions: {
    globals: {
      describe: "readonly",
      it: "readonly",
      expect: "readonly",
      test: "readonly",
      vi: "readonly",
      vitest: "readonly",
      beforeAll: "readonly",
      beforeEach: "readonly",
      afterAll: "readonly",
      afterEach: "readonly",
    },
  },
};

// Confirmed exception locations: src/lib/ and src/utils/ may use raw fetch()
// for external APIs, fire-and-forget analytics, and CSP violation reporting.
// These are not /api/ backend routes and do not require UnifiedApiClient.
const fetchExceptionConfig = {
  files: ["src/lib/**/*.{ts,tsx}", "src/utils/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": "off",
  },
};

export default [ignoresConfig, valyntAppConfig, testConfig, fetchExceptionConfig];
