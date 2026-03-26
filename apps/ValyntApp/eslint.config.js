import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import globals from "globals";
import tseslint from "typescript-eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  rules: {
    "@typescript-eslint/no-unnecessary-type-assertion": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
  },
};

const typeAwareRuntimeConfig = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "src/**/__tests__/**"],
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.json", "./tsconfig.node.json"],
      tsconfigRootDir: __dirname,
    },
  },
  rules: {
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
  },
};

// Confirmed exception locations: src/lib/, src/utils/, src/mcp-*/, src/security/ may use raw fetch()
// for external APIs, fire-and-forget analytics, CSP violation reporting, and security primitives.
// These are not /api/ backend routes and do not require UnifiedApiClient.
const fetchExceptionConfig = {
  files: [
    "src/lib/**/*.{ts,tsx}",
    "src/utils/**/*.{ts,tsx}",
    // MCP modules call external APIs (HubSpot, Salesforce, EDGAR, market data, XBRL) directly
    "src/mcp-crm/**/*.{ts,tsx}",
    "src/mcp-ground-truth/**/*.{ts,tsx}",
    // Security primitives (CSRF interceptor, HIBP breach check, rate limiter proxy)
    "src/security/**/*.{ts,tsx}",
    // Config modules (progressive rollout webhook reporting)
    "src/config/**/*.{ts,tsx}",
  ],
  rules: {
    "no-restricted-syntax": "off",
  },
};

const browserBoundaryConfig = {
  files: [
    "src/*.{ts,tsx}",
    "src/main.tsx",
    "src/App.tsx",
    "src/AppRoutes.tsx",
    "src/api/**/*.{ts,tsx}",
    "src/app/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/contexts/**/*.{ts,tsx}",
    "src/dashboards/**/*.{ts,tsx}",
    "src/features/**/*.{ts,tsx}",
    "src/hooks/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    "src/pages/**/*.{ts,tsx}",
    "src/repositories/**/*.{ts,tsx}",
    "src/views/**/*.{ts,tsx}",
  ],
  ignores: ["src/**/*.server.ts", "src/**/*.server.tsx", "src/**/__tests__/**/*", "src/**/*.test.*", "src/**/*.spec.*"],
  rules: {
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
          {
            group: ["**/*.server", "**/*.server.*"],
            message:
              "Browser entrypoints and browser libraries must not import server-only modules. Use browser-safe config/lib modules instead.",
          },
        ],
      },
    ],
  },
};

export default [
  ignoresConfig,
  valyntAppConfig,
  typeAwareRuntimeConfig,
  testConfig,
  fetchExceptionConfig,
  browserBoundaryConfig,
];
