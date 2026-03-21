import { describe, expect, it } from "vitest";

import { VectorSearchService } from "../memory/VectorSearchService.js";

describe("VectorSearchService filter normalization", () => {
  const service = new VectorSearchService();

  it("extracts tenant and organization scope from filters without emitting SQL fragments", () => {
    const normalized = (service as unknown as {
      normalizeFilters: (filters: Record<string, unknown>) => {
        filters: Record<string, unknown>;
        organizationId: string | null;
        tenantId: string | null;
      };
    }).normalizeFilters({
      organization_id: "org-123",
      tenant_id: "tenant-456",
      workflowId: "wf'; DROP TABLE semantic_memory; --",
      tags: ["safe", "tag"],
    });

    expect(normalized.organizationId).toBe("org-123");
    expect(normalized.tenantId).toBe("tenant-456");
    expect(normalized.filters).toEqual({
      tags: ["safe", "tag"],
      workflowId: "wf'; DROP TABLE semantic_memory; --",
    });
  });

  it("preserves supported range filters and drops unsupported shapes", () => {
    const normalizedRange = (service as unknown as {
      normalizeFilterValue: (value: unknown) => unknown;
    }).normalizeFilterValue({ gte: "2026-01-01", lte: "2026-03-01", nested: true });

    const normalizedUnsupported = (service as unknown as {
      normalizeFilterValue: (value: unknown) => unknown;
    }).normalizeFilterValue({ nested: { nope: true } });

    expect(normalizedRange).toEqual({
      gte: "2026-01-01",
      lte: "2026-03-01",
    });
    expect(normalizedUnsupported).toBeUndefined();
  });
});
