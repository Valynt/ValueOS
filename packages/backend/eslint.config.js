import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const reqAsAnyMessage =
  "Do not cast req to any. Use typed Express.Request properties from src/types/express.d.ts (e.g., req.tenantId, req.userId, req.sessionId, req.user, req.db).";
const nonNullAssertionBoundaryGrandfatheredFiles = [
  // Keep this allowlist restricted to explicitly-tracked debt items.
  // TODO(valueos-eslint/non-null-assertion): remove file entries after migrating assertions to guarded branches.
];

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      security: security,
    },
    rules: {
      ...security.configs.recommended.rules,
      // NOTE: Individual suppressions use eslint-disable-next-line comments
      // See BURN-DOWN.md for plan to reduce these systematically
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      // Pre-existing baseline issues — warn only until resolved
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-case-declarations": "warn",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "no-useless-catch": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "src/**/__tests__/**/*.ts",
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/services/types/agent",
                "**/services/types/agent.js",
              ],
              message:
                "Deprecated shim import. Use canonical `src/types/agent`.",
            },
            {
              group: [
                "**/services/UnifiedAgentAPI",
                "**/services/UnifiedAgentAPI.js",
                "**/services/post-v1/UnifiedAgentAPI",
                "**/services/post-v1/UnifiedAgentAPI.js",
              ],
              message:
                "Deprecated UnifiedAgentAPI shim import. Use canonical `services/value/UnifiedAgentAPI`.",
            },
            {
              group: [
                "**/api/domainPacks",
                "**/api/domainPacks/*",
                "**/api/domainPacks.js",
              ],
              message:
                "Deprecated camelCase API path import. Use canonical `src/api/domain-packs/*`.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSAsExpression[expression.type='Identifier'][expression.name='req'] > TSAnyKeyword",
          message: reqAsAnyMessage,
        },
        {
          selector:
            "ImportDeclaration[source.value=/TaskContext$/] > ImportDefaultSpecifier[local.name='TaskContext']",
          message:
            "TaskContext must be imported as a named type export. Use: import type { TaskContext } from '.../TaskContext'.",
        },
      ],
    },
  },
  {
    files: ["src/workers/**/*.ts", "src/runtime/**/*.ts"],
    ignores: nonNullAssertionBoundaryGrandfatheredFiles,
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    files: ["src/api/**/*.ts", "src/middleware/**/*.ts", "src/routes/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/lib/supabase/privileged",
                "**/lib/supabase/privileged/*",
              ],
              message:
                "Request handlers must not import service-role privileged clients directly. Route through an allowlisted service module.",
            },
            {
              group: [
                "@shared/lib/supabase",
              ],
              importNames: ["supabase", "createServerSupabaseClient", "getSupabaseClient", "createServiceRoleSupabaseClient"],
              message:
                "Request handlers must use request-scoped Supabase helpers (createRequestSupabaseClient/getRequestSupabaseClient). Service-role imports are forbidden in request paths.",
            },
            {
              group: [
                "**/lib/supabase",
                "**/lib/supabase.js",
              ],
              importNames: ["supabase", "createServerSupabaseClient", "getSupabaseClient"],
              message:
                "Request handlers must use request-scoped Supabase helpers (createRequestSupabaseClient/getRequestSupabaseClient).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/api/**/*.ts", "src/runtime/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/services/workflows/WorkflowDAGIntegration",
                "**/services/workflows/WorkflowDAGIntegration.js",
              ],
              message:
                "WorkflowDAGIntegration is deprecated non-runtime code. Use runtime/execution-runtime/WorkflowExecutor.ts.",
            },
          ],
        },
      ],
    },
  },

  {
    files: [
      "src/api/auth.ts",
      "src/api/services/ReferralService.ts",
      "src/api/services/ReferralAnalyticsService.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/__tests__/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  // Keep legacy any tolerance only for generated and ambient declaration types
  {
    files: [
      "src/types/**/*.d.ts",
      "src/types/supabase-generated.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Disable no-unused-vars in test-utils/ — helpers are consumed by test files outside this directory
  {
    files: ["src/test-utils/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Strict boundaries: enforce error-level type safety in DTO/domain/worker/repository zones
  {
    files: [
      "src/types/**/*.ts",
      "src/services/types/**/*.ts",
      "src/workers/**/*.ts",
      "src/repositories/**/*.ts",
      "src/domain/**/adapters/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
    },
  },
);
