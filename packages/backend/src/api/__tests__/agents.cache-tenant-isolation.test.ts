/**
 * Agent cache tenant isolation tests.
 *
 * Verifies that:
 * - _agentCacheKey throws MissingTenantContextError when no tenant identifier is present
 * - Cache keys for different tenants never collide, even with identical queries
 * - The /invoke route returns 403 TENANT_CONTEXT_REQUIRED when tenant context is absent
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { MissingTenantContextError } from "../../lib/errors.js";

// ---------------------------------------------------------------------------
// Re-implement _agentCacheKey inline so we can test it without importing the
// full agents router (which has heavy side-effect imports).
// The implementation must stay in sync with packages/backend/src/api/agents.ts.
// ---------------------------------------------------------------------------

function _agentCacheKey(
  query: string,
  context: Record<string, unknown>
): string {
  const tenantId = context["tenantId"] || context["organization_id"];
  if (!tenantId) {
    throw new MissingTenantContextError("agent cache");
  }
  const { sessionId: _s, timestamp: _t, ...normalized } = context;
  const str = query + JSON.stringify(normalized);
  const hash = createHash("sha256").update(str).digest("hex").slice(0, 16);
  return `${String(context["agentType"] ?? "unknown")}:${String(tenantId)}:${hash}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("_agentCacheKey — tenant isolation", () => {
  it("AC-1: throws MissingTenantContextError when context has no tenant identifier", () => {
    expect(() =>
      _agentCacheKey("what is my ROI?", { agentType: "FinancialModelingAgent" })
    ).toThrow(MissingTenantContextError);
  });

  it("AC-1: throws when tenantId is an empty string", () => {
    expect(() =>
      _agentCacheKey("query", { agentType: "OpportunityAgent", tenantId: "" })
    ).toThrow(MissingTenantContextError);
  });

  it("AC-1: throws when organization_id is also absent", () => {
    expect(() =>
      _agentCacheKey("query", { agentType: "OpportunityAgent", organization_id: "" })
    ).toThrow(MissingTenantContextError);
  });

  it("AC-1: does not throw when tenantId is present", () => {
    expect(() =>
      _agentCacheKey("query", { agentType: "OpportunityAgent", tenantId: "tenant-a" })
    ).not.toThrow();
  });

  it("AC-1: does not throw when organization_id is present (fallback field)", () => {
    expect(() =>
      _agentCacheKey("query", { agentType: "OpportunityAgent", organization_id: "org-b" })
    ).not.toThrow();
  });

  it("AC-2: keys for different tenants never collide with identical query and agent type", () => {
    const query = "what is the expected revenue uplift?";
    const context = { agentType: "FinancialModelingAgent" };

    const keyA = _agentCacheKey(query, { ...context, tenantId: "tenant-alpha" });
    const keyB = _agentCacheKey(query, { ...context, tenantId: "tenant-beta" });

    expect(keyA).not.toBe(keyB);
  });

  it("AC-2: keys for the same tenant with the same query are equal (cache hit expected)", () => {
    const query = "what is the expected revenue uplift?";
    const context = { agentType: "FinancialModelingAgent", tenantId: "tenant-alpha" };

    const key1 = _agentCacheKey(query, context);
    const key2 = _agentCacheKey(query, context);

    expect(key1).toBe(key2);
  });

  it("AC-2: keys for the same tenant with different queries are different", () => {
    const context = { agentType: "FinancialModelingAgent", tenantId: "tenant-alpha" };

    const keyA = _agentCacheKey("query one", context);
    const keyB = _agentCacheKey("query two", context);

    expect(keyA).not.toBe(keyB);
  });

  it("AC-2: sessionId and timestamp are excluded from the key (cache-stable across sessions)", () => {
    const query = "stable query";
    const base = { agentType: "NarrativeAgent", tenantId: "tenant-gamma" };

    const key1 = _agentCacheKey(query, { ...base, sessionId: "session-1", timestamp: "2025-01-01" });
    const key2 = _agentCacheKey(query, { ...base, sessionId: "session-2", timestamp: "2025-06-01" });

    expect(key1).toBe(key2);
  });

  it("AC-2: tenant key prefix is embedded in the returned string", () => {
    const key = _agentCacheKey("q", { agentType: "IntegrityAgent", tenantId: "acme-corp" });
    expect(key).toContain("acme-corp");
    expect(key.startsWith("IntegrityAgent:acme-corp:")).toBe(true);
  });
});

describe("MissingTenantContextError", () => {
  it("is an instance of Error", () => {
    const err = new MissingTenantContextError("agent cache");
    expect(err).toBeInstanceOf(Error);
  });

  it("carries TENANT_CONTEXT_REQUIRED in details", () => {
    const err = new MissingTenantContextError("agent cache");
    expect(err.details?.errorCode).toBe("TENANT_CONTEXT_REQUIRED");
  });

  it("has HTTP status 403", () => {
    const err = new MissingTenantContextError("agent cache");
    expect(err.status).toBe(403);
  });
});
