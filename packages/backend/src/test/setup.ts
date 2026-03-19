/**
 * Backend test setup
 *
 * Sets fallback env vars so modules that eagerly validate config
 * (e.g. supabase.ts, env.ts) don't throw at import time.
 * Individual tests should still mock these modules for isolation.
 */

import { beforeEach, expect } from "vitest";

// Supabase config — only set if not already present
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";

// LLM config
process.env.LLM_PROVIDER ??= "together";
process.env.TOGETHER_API_KEY ??= "test-together-key";

// Redis
process.env.REDIS_URL ??= "redis://localhost:6379";

beforeEach(async () => {
  const testPath = expect.getState().testPath ?? "";
  if (
    testPath.endsWith("EntitlementsService.static.test.ts") ||
    testPath.endsWith("secretsManager.test.ts")
  ) {
    return;
  }

  const [{ supabase }, entitlementsModule] = await Promise.all([
    import("../lib/supabase.js"),
    import("../services/billing/EntitlementsService.js"),
  ]);

  const EntitlementsService = entitlementsModule.EntitlementsService;
  if (typeof EntitlementsService?.setInstance === "function") {
    EntitlementsService.setInstance(new EntitlementsService(supabase));
  }
});
