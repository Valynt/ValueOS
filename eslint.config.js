// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
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
    "apps/VOSAcademy/src/data/db.js",
    "apps/VOSAcademy/src/data/seed-simulations.mjs",
    "tests/performance/stress-testing.test.ts",
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
      node: {
        moduleDirectory: [
          "node_modules",
          "packages/*/node_modules",
          "apps/*/node_modules",
        ],
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
      // Type-aware project references removed — loading all monorepo tsconfigs caused OOM.
      // Use `tsc --noEmit` for type checking instead.
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
    "jsx-a11y/interactive-supports-focus": "error",
    "jsx-a11y/no-autofocus": "warn",
    "jsx-a11y/tabindex-no-positive": "error",
    "jsx-a11y/anchor-is-valid": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/no-noninteractive-element-interactions": "warn",
    "jsx-a11y/label-has-associated-control": "warn",
    "jsx-a11y/heading-has-content": "warn",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-role": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    // Disabled for TS files: TypeScript handles these checks.
    "no-undef": "off",
    "no-redeclare": "off",
    "no-case-declarations": "warn",
    "no-useless-escape": "warn",
    "no-useless-catch": "warn",
    // eslint-disable-next-line no-irregular-whitespace -- intentional whitespace
    // Promoting any usage to a warning as part of Phase 1 debt reduction; tighten to error once existing usages are removed.
    "@typescript-eslint/no-explicit-any": "warn",
    // Requires type-aware parserOptions.project (disabled to avoid OOM in monorepo)
    // "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    // Disable base no-unused-vars in favor of TS-aware version below
    "no-unused-vars": "off",
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
    "no-script-url": "warn",
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
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-non-literal-regexp": "error",
    "security/detect-non-literal-require": "error",
    "security/detect-object-injection": "warn",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-unsafe-regex": "warn",
    "import/no-dynamic-require": "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-duplicate-imports": "warn",
    "no-return-await": "warn",
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

    // ESM Import Rules
    // Disabled: eslint-import-resolver-typescript is not installed, so path aliases don't resolve.
    // Re-enable after: pnpm add -Dw eslint-import-resolver-typescript
    "import/no-unresolved": "off",
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      },
    ],

    // Disallow direct LLM gateway complete() calls in production code.
    // All LLM invocations must go through secureLLMComplete (services/workers)
    // or BaseAgent.secureInvoke (agent-owned paths). This rule catches:
    //   llmGateway.complete(...)       — bare variable name
    //   this.llmGateway.complete(...)  — member expression
    //   this.llm.complete(...)         — aliased as this.llm
    // Exceptions: LLMGateway.ts itself, secureLLMWrapper.ts, and test files
    // (excluded via the testOverrides config block below).
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.property.name='complete'][callee.object.name='llmGateway'], CallExpression[callee.property.name='complete'][callee.object.property.name='llmGateway'], CallExpression[callee.property.name='complete'][callee.object.property.name='llm']",
        message:
          "Direct LLM gateway complete() calls are forbidden. Use secureLLMComplete (services/workers) or BaseAgent.secureInvoke (agents). See AGENTS.md rule 2.",
      },
      {
        selector: "AssignmentExpression[left.property.name='innerHTML']",
        message:
          "Do not assign to innerHTML. Use textContent or sanitizeHtml() with an allowlist.",
      },
      {
        selector: "AssignmentExpression[left.property.name='outerHTML']",
        message:
          "Do not assign to outerHTML. Use DOM APIs or sanitizeHtml() with an allowlist.",
      },
      // ESLint Integrity Gate: Agent Patterns
      {
        selector:
          "CallExpression[callee.property.name='secureInvoke'][arguments.length<4]",
        message:
          "secureInvoke must be called with 4 arguments (sessionId, prompt, schema, options).",
      },
      {
        selector:
          "CallExpression[callee.property.name='secureInvoke'] > ObjectExpression:last-child:not([properties.0.key.name='idempotencyKey']):not([properties.1.key.name='idempotencyKey']):not([properties.2.key.name='idempotencyKey']):not([properties.3.key.name='idempotencyKey'])",
        message:
          "secureInvoke options must include an idempotencyKey as one of the first few properties.",
      },
      {
        selector:
          "CallExpression[callee.property.name='secureInvoke'][typeArguments.params.0.type='TSAnyKeyword']",
        message:
          "Do not use 'any' with secureInvoke. Provide a specific Zod-validated type.",
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
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-alert": "warn",
    "no-debugger": "error",
    "no-sequences": "error",
    complexity: ["warn", { max: 8 }],
  },
};

const valyntBackendServiceImportGuard = {
  files: [
    "apps/ValyntApp/src/api/**/*.{ts,tsx}",
    "apps/ValyntApp/src/config/**/*.{ts,tsx}",
    "apps/ValyntApp/src/middleware/**/*.{ts,tsx}",
    "apps/ValyntApp/src/utils/**/*.{ts,tsx}",
    "apps/ValyntApp/src/views/**/*.{ts,tsx}",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["../services/*Service", "../../services/*Service"],
            message:
              "Backend-domain services are canonical in packages/backend/src/services. Import from @backend/services/* instead.",
          },
        ],
      },
    ],
  },
};

// Strong import boundary guard for ValyntApp service layer
const valyntServicesImportGuard = {
  files: ["apps/ValyntApp/src/services/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@valueos/*/src/*",
              "@valueos/*/*/src/*",
              "packages/*/src/*",
              "../../packages/*",
              "../../../packages/*",
            ],
            message:
              "Service-layer code in apps/ValyntApp must consume package public APIs only. Do not import package internals or cross package via relative paths.",
          },
          {
            group: ["../apps/*", "../../apps/*", "../../../apps/*"],
            message:
              "Do not import other apps from the service layer. Use published package APIs instead.",
          },
        ],
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
    // Ban placeholder assertions — use it.todo('description') for unimplemented tests
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.object.callee.name='expect'][callee.object.arguments.0.value=true][callee.property.name='toBe'][arguments.0.value=true]",
        message:
          "Placeholder assertion expect(true).toBe(true) is banned. Use it.todo('description') for unimplemented tests.",
      },
    ],
    // Ban @jest/globals — use vitest (vi, expect, it, describe) instead
    "no-restricted-imports": [
      "error",
      {
        name: "@jest/globals",
        message:
          "Use vitest imports (vi, expect, it, describe) instead of @jest/globals.",
      },
    ],
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
        selector:
          "MemberExpression[object.name='process'][property.name='env']",
        message:
          "Direct access to process.env is forbidden in src/, use src/lib/env.ts instead",
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

    // Disabled: requires eslint-import-resolver-typescript for path alias resolution.
    // Re-enable after: pnpm add -Dw eslint-import-resolver-typescript
    "import/no-internal-modules": "off",
  },
};

// Backend services guard rail: prevent direct auth schema table queries.
const backendServiceAuthOverrides = {
  files: ["packages/backend/src/services/**/*.{ts,tsx,js,jsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.property.name='schema'][arguments.0.value='auth']",
        message:
          "Do not query auth schema tables from backend services. Use Supabase auth admin APIs via AuthDirectoryService.",
      },
    ],
  },
};

// Enforce no-console in backend production code (use structured logger instead)
const backendNoConsoleOverrides = {
  files: ["packages/backend/src/**/*.ts"],
  ignores: [
    "packages/backend/src/**/*.test.ts",
    "packages/backend/src/**/*.spec.ts",
    "packages/backend/src/**/__tests__/**",
    "packages/backend/src/**/__benchmarks__/**",
    "packages/backend/src/test-utils/**",
    "packages/backend/src/lib/logger.ts",
  ],
  rules: {
    "no-console": ["error", { allow: ["warn", "error"] }],
  },
};

// Enforce no-console in frontend production code.
// console.warn/error are allowed for genuine error surfaces; console.log is not.
const frontendNoConsoleOverrides = {
  files: ["apps/ValyntApp/src/**/*.ts", "apps/ValyntApp/src/**/*.tsx"],
  ignores: [
    "apps/ValyntApp/src/**/*.test.ts",
    "apps/ValyntApp/src/**/*.test.tsx",
    "apps/ValyntApp/src/**/*.spec.ts",
    "apps/ValyntApp/src/**/*.spec.tsx",
    "apps/ValyntApp/src/**/__tests__/**",
  ],
  rules: {
    "no-console": ["error", { allow: ["warn", "error"] }],
  },
};

// Strict no-any enforcement for security-critical paths and high-risk modules.
// Audit recommendation #1: expanded to cover agent-fabric, middleware, and runtime.
// Existing violations in newly-added globs remain as warn via the base config;
// only NEW files matching these patterns will fail CI on `any` introduction.
const strictNoAnyOverrides = {
  files: [
    // Security-critical middleware
    "packages/backend/src/middleware/auth.ts",
    "packages/backend/src/middleware/rbac.ts",
    "packages/backend/src/middleware/authRateLimiter.ts",
    "packages/backend/src/middleware/enhancedRateLimiter.ts",
    "packages/backend/src/middleware/securityMiddleware.ts",
    "packages/backend/src/middleware/securityHeaders.ts",
    "packages/backend/src/middleware/tenantContext.ts",
    "packages/backend/src/middleware/mfa.ts",
    // Auth services
    "packages/backend/src/services/AuthService.ts",
    "packages/backend/src/services/AuthDirectoryService.ts",
    "packages/backend/src/services/AuthPolicy.ts",
    "packages/backend/src/api/auth.ts",
    "packages/backend/src/api/admin.ts",
    // billing/** excluded: existing `any` debt must be resolved before enabling error-level enforcement here
    // Agent fabric (all agents, base class, memory)
    "packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/OpportunityAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/IntegrityAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/ExpansionAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/NarrativeAgent.ts",
    "packages/backend/src/lib/agent-fabric/agents/ComplianceAuditorAgent.ts",
    "packages/backend/src/lib/agent-fabric/AgentFactory.ts",
    "packages/backend/src/lib/agent-fabric/MemorySystem.ts",
    // Runtime services
    "packages/backend/src/runtime/**/*.ts",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
  },
};

// Guardrail: prevent `as any` assertions in auth/security production modules.
const authSecurityNoAsAnyOverrides = {
  files: [
    "packages/backend/src/api/auth.ts",
    "packages/backend/src/middleware/auth*.ts",
    "packages/backend/src/middleware/security*.ts",
    "packages/backend/src/services/auth/**/*.ts",
    "packages/shared/src/lib/auth/**/*.ts",
  ],
  ignores: [
    "packages/backend/src/**/*.test.ts",
    "packages/backend/src/**/*.spec.ts",
    "packages/backend/src/**/__tests__/**",
    "packages/shared/src/**/*.test.ts",
    "packages/shared/src/**/*.spec.ts",
    "packages/shared/src/**/__tests__/**",
    "packages/backend/src/services/auth/AuthService.ts",
    "packages/backend/src/middleware/securityHeaders.ts",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "TSAsExpression > TSAnyKeyword",
        message:
          "Do not use `as any` in auth/security modules. Introduce typed adapters or type guards.",
      },
    ],
  },
};

const appModuleBoundaryOverrides = {
  files: ["apps/ValyntApp/src/**/*.{ts,tsx,js,jsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@valueos/*/src/*",
              "@valueos/*/*/src/*",
              "@valueos/agents/*/*",
              "packages/*/src/*",
            ],
            message:
              "Valynt app must only consume package public entrypoints. Do not import package internals.",
          },
          {
            group: [
              "../../../packages/*",
              "../../../../packages/*",
              "../../../../../packages/*",
            ],
            message:
              "Valynt app cannot import packages through relative paths. Use workspace package specifiers.",
          },
        ],
      },
    ],
  },
};

const backendModuleBoundaryOverrides = {
  files: ["packages/backend/src/**/*.{ts,tsx,js,jsx}"],
  ignores: [
    // Allowlisted modules that legitimately use service_role:
    // AuthService, tenant provisioning, billing workers, cron jobs, security audit.
    "packages/backend/src/services/auth/AuthService.ts",
    "packages/backend/src/services/auth/AdminUserService.ts",
    "packages/backend/src/services/auth/AdminRoleService.ts",
    "packages/backend/src/services/tenant/TenantProvisioning.ts",
    "packages/backend/src/services/tenant/TenantDeletionService.ts",
    "packages/backend/src/workers/**",
    "packages/backend/src/services/post-v1/SecurityAuditService.ts",
    "packages/backend/src/analytics/ValueLoopAnalytics.ts",
    // Repositories use service_role intentionally — tracked as tech debt.
    "packages/backend/src/repositories/**",
    // The supabase module itself defines the clients.
    "packages/backend/src/lib/supabase.ts",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "apps/ValyntApp/*",
              "../../apps/ValyntApp/*",
              "../../../apps/ValyntApp/*",
            ],
            message:
              "Backend modules must not import application-layer code from apps/ValyntApp.",
          },
          {
            group: [
              "../lib/agent-fabric",
              "../lib/agent-fabric.ts",
              "./lib/agent-fabric",
              "./lib/agent-fabric.ts",
            ],
            message:
              "Use @valueos/agents package APIs directly instead of backend-local agent-fabric entrypoints.",
          },
        ],
        // Restrict createServerSupabaseClient (service_role) to the allowlisted modules
        // declared in the ignores list above. All other API paths must use
        // createUserSupabaseClient() so RLS is enforced.
        paths: [
          {
            name: "../lib/supabase.js",
            importNames: [
              "createServerSupabaseClient",
              "getSupabaseClient",
              "supabase",
            ],
            message:
              "service_role bypasses RLS. Use createUserSupabaseClient(userToken) for request-scoped paths. " +
              "createServerSupabaseClient is only allowed in the modules listed in backendModuleBoundaryOverrides.ignores.",
          },
          {
            name: "../../lib/supabase.js",
            importNames: [
              "createServerSupabaseClient",
              "getSupabaseClient",
              "supabase",
            ],
            message:
              "service_role bypasses RLS. Use createUserSupabaseClient(userToken) for request-scoped paths. " +
              "createServerSupabaseClient is only allowed in the modules listed in backendModuleBoundaryOverrides.ignores.",
          },
          {
            name: "../../../lib/supabase.js",
            importNames: [
              "createServerSupabaseClient",
              "getSupabaseClient",
              "supabase",
            ],
            message:
              "service_role bypasses RLS. Use createUserSupabaseClient(userToken) for request-scoped paths. " +
              "createServerSupabaseClient is only allowed in the modules listed in backendModuleBoundaryOverrides.ignores.",
          },
        ],
      },
    ],
  },
};
// Block raw fetch() in backend — all outbound requests must go through egressFetch().
// Existing call sites are listed in ignores as tracked debt; remove entries as they
// are migrated to egressFetch().
const backendEgressEnforcement = {
  files: ["packages/backend/src/**/*.{ts,tsx,js,jsx}"],
  ignores: [
    // The egress client itself wraps fetch — it is the only allowed call site.
    "packages/backend/src/lib/egressClient.ts",
    // Existing call sites — tracked debt, migrate to egressFetch() incrementally.
    "packages/backend/src/workers/crmWorker.ts",
    "packages/backend/src/services/post-v1/NetworkSegmentation.ts",
    "packages/backend/src/services/post-v1/WebScraperService.ts",
    "packages/backend/src/services/post-v1/RobustConnectionManager.ts",
    "packages/backend/src/services/post-v1/WorkerSandbox.ts",
    "packages/backend/src/services/post-v1/OfflineEvaluation.ts",
    "packages/backend/src/services/post-v1/SandboxedExecutor.ts",
    "packages/backend/src/services/GroundtruthAPI.ts",
    "packages/backend/src/services/UnifiedAgentAPI.ts",
    "packages/backend/src/services/onboarding/WebCrawler.ts",
    "packages/backend/src/services/MCPGroundTruthService.ts",
    "packages/backend/src/services/billing/AlertingService.ts",
    "packages/backend/src/services/crm/CRMOAuthService.ts",
    "packages/backend/src/services/crm/HubSpotProvider.ts",
    "packages/backend/src/services/crm/SalesforceProvider.ts",
    "packages/backend/src/services/crm/AgentPrefetchService.ts",
    "packages/backend/src/services/agents/AgentQueryService.ts",
    "packages/backend/src/services/approvals/NotificationAdapterService.ts",
    "packages/backend/src/services/llm/LLMCostTracker.ts",
    "packages/backend/src/services/llm/GeminiProxyService.ts",
  ],
  rules: {
    "no-restricted-globals": [
      "error",
      {
        name: "fetch",
        message:
          "Use egressFetch() from @backend/lib/egressClient instead of the global fetch(). " +
          "egressFetch enforces the production egress allowlist and blocks SSRF targets.",
      },
    ],
  },
};

// Block raw fetch() in ValyntApp — all API calls must go through apiClient (unified-api-client).
// apiClient centralises auth headers, retry logic, and error normalisation.
// Existing call sites are listed in ignores as tracked debt; remove entries as they are migrated.
const frontendFetchEnforcement = {
  files: ["apps/ValyntApp/src/**/*.{ts,tsx}"],
  ignores: [
    // apiClient itself wraps fetch — it is the only allowed call site.
    "apps/ValyntApp/src/api/client/unified-api-client.ts",
  ],
  rules: {
    "no-restricted-globals": [
      "error",
      {
        name: "fetch",
        message:
          "Use apiClient from @/api/client/unified-api-client instead of the global fetch(). " +
          "apiClient centralises auth headers, retry logic, and error normalisation.",
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

// Ban imports from deleted legacy root directories (client/, server/, shared/).
// These directories were removed in QUAL-003. This rule prevents re-introduction.
const legacyRootDirBan = {
  files: ["apps/**/*.{ts,tsx,js,jsx}", "packages/**/*.{ts,tsx,js,jsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "**/../../client/**",
              "**/../../../client/**",
              "../../../../client/**",
            ],
            message:
              "The root client/ directory has been removed. Import from apps/ValyntApp/src/ instead.",
          },
          {
            group: [
              "**/../../server/**",
              "**/../../../server/**",
              "../../../../server/**",
            ],
            message:
              "The root server/ directory has been removed. Tests belong in packages/backend/src/__tests__/.",
          },
          {
            group: [
              "**/../../shared/**",
              "**/../../../shared/**",
              "../../../../shared/**",
            ],
            message:
              "The root shared/ directory has been removed. Import from packages/shared/src/ or use @shared/* alias.",
          },
        ],
      },
    ],
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
  valyntBackendServiceImportGuard,
  valyntServicesImportGuard,
  backendServiceAuthOverrides,
  backendNoConsoleOverrides,
  frontendNoConsoleOverrides,
  strictNoAnyOverrides,
  authSecurityNoAsAnyOverrides,
  configOverrides,
  testOverrides,
  k6Overrides,
  frontendOverrides,
  srcOverrides,
  envOverrides,
  moduleBoundaryOverrides,
  appModuleBoundaryOverrides,
  backendModuleBoundaryOverrides,
  backendEgressEnforcement,
  frontendFetchEnforcement,
  legacyRootDirBan,
  testcafeOverrides,
  ...storybook.configs["flat/recommended"],
];
