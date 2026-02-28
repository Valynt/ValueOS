import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import storybook from "eslint-plugin-storybook";
import globals from "globals";
import tseslint from "typescript-eslint";

export const ignoresConfig = {
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

export const pluginConfig = {
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
      typescript: true,
      node: true,
    },
  },
};

export const baseConfig = {
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
      "warn",
      {
        allowConstantExport: true,
      },
    ],
    "security/detect-object-injection": "off",
    "import/no-unresolved": "error",
  },
};

export default [ignoresConfig, pluginConfig, baseConfig];
