// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import security from "eslint-plugin-security";
import importPlugin from "eslint-plugin-import";

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
    ".coverage",
    ".next",
    ".turbo",
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
    security: security,
    import: importPlugin,
  },
  settings: {
    react: {
      version: "detect",
    },
    "import/resolver": {
      typescript: {
        // Look up workspace and package tsconfigs so path aliases and package-local files resolve correctly
        project: ["./tsconfig.json", "./apps/*/tsconfig.json", "./packages/*/tsconfig.json", "./packages/*/*/tsconfig.json"],
        alwaysTryTypes: true,
      },
      node: {
        moduleDirectory: ["node_modules", "packages/*/node_modules", "apps/*/node_modules"],
        extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts"],
      },
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
      // Provide an explicit list of tsconfig files so type-aware rules can resolve projects across the monorepo
      // This avoids 'Resolve error: typescript with invalid interface loaded as resolver'
      project: ["./tsconfig.json", "./apps/*/tsconfig.json", "./packages/*/tsconfig.json", "./packages/*/*/tsconfig.json"],
      // Suppress warning about multiple projects - expected in a pnpm monorepo with 17+ workspace packages
      noWarnOnMultipleProjects: true,
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
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/no-noninteractive-element-interactions": "warn",
    "jsx-a11y/label-has-associated-control": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-role": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",
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
    "react/jsx-no-target-blank": ["error", { allowReferrer: false }],
    "react/no-danger": "error",
    "react/no-unknown-property": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "security/detect-buffer-noassert": "error",
    "security/detect-child-process": "error",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-new-buffer": "warn",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-non-literal-fs-filename": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-non-literal-require": "error",
    "security/detect-object-injection": "warn",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-unsafe-regex": "error",
    "import/no-dynamic-require": "error",
    "import/no-unresolved": "off", // TypeScript handles this
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        pathGroups: [
          {
            pattern: "@/**",
            group: "internal",
            position: "after",
          },
        ],
        pathGroupsExcludedImportTypes: ["builtin"],
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
        warnOnUnassignedImports: true,
      },
    ],
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

    // ESM Import Rules - Permanent safeguards against import resolution issues
    // CRITICAL: These prevent .js extension mismatches and unresolved imports
    "import/no-unresolved": "error", // Fail on imports that don't resolve
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
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
      {
        selector: "AssignmentExpression[left.property.name='innerHTML']",
        message: "Do not assign to innerHTML. Use textContent or sanitizeHtml() with an allowlist.",
      },
      {
        selector: "AssignmentExpression[left.property.name='outerHTML']",
        message: "Do not assign to outerHTML. Use DOM APIs or sanitizeHtml() with an allowlist.",
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

// Module boundary enforcement across apps/packages
const moduleBoundaryOverrides = {
  files: ["apps/**/*.{ts,tsx,js,jsx}", "packages/**/*.{ts,tsx,js,jsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "../packages/*",
              "../../packages/*",
              "../../../packages/*",
              "../../../../packages/*",
            ],
            message:
              "Do not cross package boundaries via relative paths. Import through package public APIs (@valueos/<pkg>).",
          },
          {
            group: ["@valueos/*/src/*", "@valueos/*/*/src/*"],
            message:
              "Deep imports into package internals are forbidden. Use package entrypoints (index.ts / exports map).",
          },
        ],
      },
    ],

    // If you already use eslint-plugin-import with this rule available
    "import/no-internal-modules": [
      "error",
      {
        // Temporary carve-outs (keep this list short; shrink over time)
        allow: [
          "@valueos/agents/*",
          "@valueos/mcp/*",
          "@valueos/shared/*",
          "@valueos/design-system/*",
        ],
      },
    ],
  },
};

// Backend services guard rail: prevent direct auth schema table queries.
const backendServiceAuthOverrides = {
  files: ["packages/backend/src/services/**/*.{ts,tsx,js,jsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.property.name='schema'][arguments.0.value='auth']",
        message:
          "Do not query auth schema tables from backend services. Use Supabase auth admin APIs via AuthDirectoryService.",
      },
    ],
  },
};

// Config files override - disable type-aware rules and project
const configOverrides = {
  files: [
    "**/vite.config.{ts,js}",
    "**/tailwind.config.{js,cjs}",
    "**/postcss.config.{js,cjs}",
    "**/eslint.config.{js,mjs}",
  ],
  languageOptions: {
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // Explicitly disable type-aware checks for config files by using an empty project list
      project: [],
    },
  },
  rules: {
    "import/no-unresolved": "off", // Config files may have different resolution
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/no-require-imports": "off",
    // Disable type-aware @typescript-eslint rules for config files (no type-checking available)
    "@typescript-eslint/no-unnecessary-type-assertion": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/no-explicit-any": "off",
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
  backendServiceAuthOverrides,
  configOverrides,
  testOverrides,
  k6Overrides,
  frontendOverrides,
  srcOverrides,
  envOverrides,
  moduleBoundaryOverrides,
  testcafeOverrides,
  ...storybook.configs["flat/recommended"],
];
