// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";

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
    "infra/k8s/**/*",
    "kubernetes/**/*",
    "alembic/**/*",
  ],
};

// Plugin registration - applying to all files
const pluginConfig = {
  plugins: {
    "@typescript-eslint": tseslint.plugin,
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
    "jsx-a11y": jsxA11y,
    react: react,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};

// Base config
const baseConfig = {
  files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
  languageOptions: {
    ecmaVersion: 2020,
    globals: {
      ...globals.browser,
      ...globals.node,
      NodeJS: "readonly",
      RequestInit: "readonly",
      RequestInfo: "readonly",
      HeadersInit: "readonly",
      BufferSource: "readonly",
    },
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
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
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
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
    // Security-focused rules
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-script-url": "error",

    // React security rules
    "react/jsx-no-target-blank": ["error", { allowReferrer: false }],
    "react/no-danger": "error",
    "react/no-unknown-property": "error",

    // React Hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Code quality and consistency
    eqeqeq: ["error", "always"],
    "no-duplicate-imports": "error",
    "no-return-await": "error",

    // Import organization
    "@typescript-eslint/consistent-import": "off", // Let auto-import handle this
    "sort-imports": [
      "error",
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
        allowSeparatedGroups: true,
      },
    ],

    // Disallow JSX inline styles and direct llmGateway.complete calls
    "no-restricted-syntax": [
      "error",
      {
        selector: "JSXAttribute[name.name='style']",
        message:
          'Inline styles in JSX (style={{...}} or style="...") are forbidden. Use design tokens and utility classes instead.',
      },
      {
        selector:
          "CallExpression[callee.object.name='llmGateway'][callee.property.name='complete']",
        message: "Direct calls to llmGateway.complete are forbidden; use secureLLMInvoke instead.",
      },
    ],

    // Agent-specific rules
    "@typescript-eslint/no-magic-numbers": [
      "warn",
      {
        ignore: [0, 1, -1, 2],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
      },
    ],
    "@typescript-eslint/no-non-null-assertion": "warn",

    // Error handling

    // Security: Prevent dangerous patterns in agent code
    "no-alert": "error",
    "no-debugger": "error",
    "no-sequences": "error",
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
    "src/test/**/*",
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
      jest: "readonly",
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
    "no-restricted-syntax": "off",
  },
};

// k6 load test overrides
const k6Overrides = {
  files: ["**/*.k6.js", "**/load-test*.js", "**/performance-test*.js"],
  languageOptions: {
    globals: {
      ...globals.node,
      __ENV: "readonly",
      __VU: "readonly",
      __ITER: "readonly",
    },
  },
  rules: {
    "no-console": "off",
  },
};

// Frontend overrides - NO process.env access in client code
const frontendOverrides = {
  files: ["src/components/**/*.{ts,tsx}", "src/sdui/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-globals": ["error", "process"],
  },
};

// src overrides: forbid process.env access except in env adapter
const srcOverrides = {
  files: ["src/**/*"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[object.name='process'][property.name='env']",
        message: "Direct access to process.env is forbidden in src/, use src/lib/env.ts instead",
      },
    ],
  },
};

// Allow process.env in env.ts
const envOverrides = {
  files: ["src/lib/env.ts"],
  rules: {
    "no-restricted-syntax": "off",
  },
};

// TestCafe overrides
const testcafeOverrides = {
  files: ["**/testcafe/**/*.js", "**/testcafe/**/*.ts"],
  languageOptions: {
    globals: {
      ...globals.node,
      fixture: "readonly",
      test: "readonly",
    },
  },
};

export default [
  ignoresConfig,
  pluginConfig,
  baseConfig,
  testOverrides,
  k6Overrides,
  frontendOverrides,
  srcOverrides,
  envOverrides,
  testcafeOverrides,
  ...storybook.configs["flat/recommended"],
];
