import { describe, expect, it } from "vitest";

import { SupabaseProvenanceStore } from "../SagaAdapters.js";

function createReadBuilder(result: unknown) {
  const eqCalls: Array<[string, string]> = [];

  const secondEq = (column: string, value: string) => {
    eqCalls.push([column, value]);
    return Promise.resolve(result);
  };

  const firstEq = (column: string, value: string) => {
    eqCalls.push([column, value]);
    return { eq: secondEq };
  };

  return {
    builder: {
      select: () => ({ eq: firstEq }),
    },
    eqCalls,
  };
}

function createFindByIdBuilder(result: unknown) {
  const eqCalls: Array<[string, string]> = [];

  const single = () => Promise.resolve(result);
  const secondEq = (column: string, value: string) => {
    eqCalls.push([column, value]);
    return { single };
  };
  const firstEq = (column: string, value: string) => {
    eqCalls.push([column, value]);
    return { eq: secondEq, single };
  };

  return {
    builder: {
      select: () => ({ eq: firstEq }),
    },
    eqCalls,
  };
}

describe("SagaAdapters SupabaseProvenanceStore tenant scope", () => {
  const organizationId = "org-tenant-a";

  it("adds organization_id to findByClaimId queries", async () => {
    const { builder, eqCalls } = createReadBuilder({ data: [], error: null });
    const supabase = { from: () => builder };
    const store = new SupabaseProvenanceStore(supabase as never, organizationId);

    await store.findByClaimId("case-123", "claim-123");

    expect(eqCalls).toEqual([
      ["value_case_id", "case-123"],
      ["claim_id", "claim-123"],
      ["organization_id", organizationId],
    ]);
  });

  it("adds organization_id to findById queries", async () => {
    const { builder, eqCalls } = createFindByIdBuilder({ data: null, error: { code: "PGRST116", message: "not found" } });
    const supabase = { from: () => builder };
    const store = new SupabaseProvenanceStore(supabase as never, organizationId);

    await store.findById("prov-123");

    expect(eqCalls).toEqual([
      ["id", "prov-123"],
      ["organization_id", organizationId],
    ]);
  });

  it("adds organization_id to findByValueCaseId queries", async () => {
    const eqCalls: Array<[string, string]> = [];
    const builder = {
      select: () => ({
        eq: (column: string, value: string) => {
          eqCalls.push([column, value]);
          return Promise.resolve({ data: [], error: null });
        },
      }),
    };
    const supabase = { from: () => builder };
    const store = new SupabaseProvenanceStore(supabase as never, organizationId);

    await store.findByValueCaseId("case-123");

    expect(eqCalls).toEqual([
      ["value_case_id", "case-123"],
      ["organization_id", organizationId],
    ]);
  });
});
