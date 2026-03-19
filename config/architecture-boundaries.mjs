/**
 * Monorepo dependency-boundary policy.
 *
 * packages/shared is treated as browser-safe and domain-oriented by default.
 * Any server-only shared modules must be explicitly listed below so CI can fail
 * browser/runtime violations deterministically.
 */
export const architectureBoundaryPolicy = {
  zones: {
    "apps/ValyntApp": {
      roots: ["apps/ValyntApp/src"],
      runtime: "browser",
      allowedZoneImports: ["packages/shared", "packages/sdui"],
      description:
        "ValyntApp is a browser bundle that may consume shared contracts and the SDUI runtime, but never backend or infra runtime implementations.",
    },
    "packages/backend": {
      roots: ["packages/backend/src"],
      runtime: "server",
      allowedZoneImports: ["packages/shared", "packages/infra", "packages/sdui"],
      description:
        "Backend may depend on shared contracts, infra adapters, and SDUI schema/runtime helpers.",
    },
    "packages/shared": {
      roots: ["packages/shared/src"],
      runtime: "isomorphic",
      allowedZoneImports: [],
      description:
        "Shared is a domain/contracts leaf. It must not import app, backend, infra, or SDUI runtime code.",
    },
    "packages/infra": {
      roots: ["packages/infra"],
      runtime: "server",
      allowedZoneImports: ["packages/shared"],
      description:
        "Infra adapters may depend on shared contracts, but not on app, backend, or SDUI code.",
    },
    "packages/sdui": {
      roots: ["packages/sdui/src"],
      runtime: "browser",
      allowedZoneImports: ["packages/shared"],
      description:
        "SDUI runtime is browser-oriented and may only consume shared contracts/utilities.",
    },
  },
  sharedPackage: {
    zone: "packages/shared",
    defaultClassification: "browser-safe",
    documentedExceptions: {
      serverOnly: [
        {
          pattern: "packages/shared/src/config/server-config.ts",
          reason: "Reads secure server environment variables and secrets-backed configuration.",
        },
        {
          pattern: "packages/shared/src/lib/adminSupabase.ts",
          reason: "Creates a service-role Supabase client for privileged backend flows.",
        },
        {
          pattern: "packages/shared/src/lib/auth/supabaseAdminAuth.ts",
          reason: "Server-only admin auth adapter.",
        },
        {
          pattern: "packages/shared/src/lib/env.ts",
          reason: "Includes server env helpers and service-role accessors; browser code must use platform/browser instead.",
        },
        {
          pattern: "packages/shared/src/platform/server.ts",
          reason: "Explicit server-only shared platform entrypoint.",
        },
        {
          pattern: "packages/shared/src/lib/redisClient.ts",
          reason: "Uses ioredis and filesystem-backed TLS certificate loading.",
        },
      ],
      mixedRuntime: [
        {
          pattern: "packages/shared/src/lib/supabase.ts",
          reason: "Contains browser-safe client helpers alongside request-scoped and service-role server helpers.",
        },
      ],
    },
  },
  browserBlockedTargets: [
    {
      pattern: "packages/backend/src/**",
      message: "Browser bundles must not import backend runtime implementations.",
    },
    {
      pattern: "packages/infra/**",
      message: "Browser bundles must not import infra adapters directly.",
    },
    {
      pattern: "packages/shared/src/config/server-config.ts",
      message: "Use @valueos/shared/platform/browser for browser-safe config access.",
    },
    {
      pattern: "packages/shared/src/lib/env.ts",
      message: "Use @valueos/shared/platform/browser for browser-safe config/env access.",
    },
    {
      pattern: "packages/shared/src/platform/server.ts",
      message: "Use @valueos/shared/platform/browser from browser bundles.",
    },
    {
      pattern: "packages/shared/src/lib/adminSupabase.ts",
      message: "Service-role Supabase helpers are server-only.",
    },
    {
      pattern: "packages/shared/src/lib/auth/**",
      message: "Shared admin auth/security implementations are server-only.",
    },
    {
      pattern: "packages/shared/src/lib/redisClient.ts",
      message: "Redis-backed shared utilities are server-only.",
    },
    {
      pattern: "packages/shared/src/lib/supabase.ts",
      message: "Use browser-safe shared platform/config entrypoints instead of mixed-runtime Supabase helpers.",
    },
  ],
};
