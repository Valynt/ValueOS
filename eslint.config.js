import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

// Ignores config (must be first)
const ignoresConfig = {
  ignores: [
    "dist",
    "build",
    "*.min.js",
    "node_modules",
    "vendor",
    "coverage",
    ".cache",
    "*.config.js",
    "!eslint.config.js",
    "**/__fixtures__",
    "**/__mocks__",
    "src/mcp-ground-truth/examples",
    ".storybook",
    "storybook-static",
    "scripts/**/*",
    "blueprint/**/*",
    "docs/**/*",
    "backup/**/*",
    "prisma/**/*",
    "services/**/*",
    "migrations/**/*",
    "supabase/**/*",
    "test-results/**/*",
    "playwright-report/**/*",
    "reports/**/*",
    "grafana/**/*",
    "infrastructure/**/*",
    "k8s/**/*",
    "kubernetes/**/*",
    "alembic/**/*",
  ],
};

// Base config with all plugins registered ONCE
const baseConfig = {
  files: ["**/*.{ts,tsx,js,jsx}"],
  languageOptions: {
    ecmaVersion: 2020,
    globals: {
      ...globals.browser,
      ...globals.node,
      NodeJS: "readonly",
    },
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
    "jsx-a11y": jsxA11y,
  },
  rules: {
    ...js.configs.recommended.rules,
    ...tseslint.configs.recommended[0].rules,
    ...jsxA11y.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    "react-refresh/only-export-components": [
      "error",
      {
        allowConstantExport: true,
      },
    ],
    "jsx-a11y/interactive-supports-focus": "error",
    "jsx-a11y/no-autofocus": "warn",
    "jsx-a11y/tabindex-no-positive": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-require-imports": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/no-unused-expressions": [
      "error",
      {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      },
    ],
    "no-console": [
      "error",
      {
        allow: ["warn", "error"],
      },
    ],
  },
};

// Test overrides - NO plugin redefinition, only rule overrides
const testOverrides = {
  files: [
    "**/__tests__/**",
    "**/*.test.{ts,tsx}",
    "**/*.spec.{ts,tsx}",
    "tests/**",
    "test/**",
  ],
  languageOptions: {
    globals: {
      ...globals.node,
      describe: "readonly",
      it: "readonly",
      test: "readonly",
      expect: "readonly",
      beforeEach: "readonly",
      afterEach: "readonly",
      beforeAll: "readonly",
      afterAll: "readonly",
      vi: "readonly",
      vitest: "readonly",
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-function-type": "off",
    "no-empty": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "no-console": "off",
  },
};

export default [ignoresConfig, baseConfig, testOverrides];
