import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { valueCaseService } from "../ValueCaseService.js";

type TenantContext = {
  userId: string;
  tenantId: string;
  tenantIds: string[];
};

const SHARED_USER_ID = "user-1";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const businessCaseRows = [
  {
    id: "case-a",
    name: "Case A",
    client: "Acme",
    status: "draft",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    owner_id: SHARED_USER_ID,
    metadata: { tenant_id: TENANT_A, stage: "opportunity" },
  },
  {
    id: "case-b",
    name: "Case B",
    client: "Bravo",
    status: "draft",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-03T00:00:00.000Z",
    owner_id: SHARED_USER_ID,
    metadata: { tenant_id: TENANT_B, stage: "opportunity" },
  },
];

const originalGetTenantContext = (valueCaseService as unknown as {
  getTenantContextFromSession: () => Promise<TenantContext>;
}).getTenantContextFromSession;

function setTenantContext(tenantId: string): void {
  (valueCaseService as unknown as {
    getTenantContextFromSession: () => Promise<TenantContext>;
  }).getTenantContextFromSession = vi.fn().mockResolvedValue({
    userId: SHARED_USER_ID,
    tenantId,
    tenantIds: [tenantId],
  });
}

function setSupabaseForFallbackReads(): void {
  const supabase = {
    from: (table: string) => {
      if (table === "value_cases") {
        const valueCasesBuilder = {
          select: () => valueCasesBuilder,
          or: () => valueCasesBuilder,
          order: async () => ({ data: null, error: { message: "fallback" } }),
          eq: () => valueCasesBuilder,
          single: async () => ({ data: null, error: { message: "fallback" } }),
        };
        return valueCasesBuilder;
      }

      if (table === "business_cases") {
        let idFilter: string | null = null;
        let ownerIdFilter: string | null = null;
        let tenantFilter: string | null = null;

        const businessCasesBuilder = {
          select: () => businessCasesBuilder,
          eq: (column: string, value: string) => {
            if (column === "id") idFilter = value;
            if (column === "owner_id") ownerIdFilter = value;
            if (column === "metadata->>tenant_id") tenantFilter = value;
            return businessCasesBuilder;
          },
          order: async () => ({
            data: businessCaseRows.filter(
              (row) => row.owner_id === ownerIdFilter && row.metadata.tenant_id === tenantFilter,
            ),
            error: null,
          }),
          single: async () => {
            const row =
              businessCaseRows.find(
                (entry) =>
                  entry.id === idFilter &&
                  entry.owner_id === ownerIdFilter &&
                  entry.metadata.tenant_id === tenantFilter,
              ) ?? null;
            return { data: row, error: row ? null : { message: "not found" } };
          },
        };

        return businessCasesBuilder;
      }

      throw new Error(`Unexpected table ${table}`);
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ id: "channel-id" }),
    }),
    removeChannel: vi.fn(),
  };

  (valueCaseService as unknown as { supabase: unknown }).supabase = supabase;
}

describe("ValueCaseService tenant scoping", () => {
  beforeEach(() => {
    setSupabaseForFallbackReads();
    (valueCaseService as unknown as { realtimeChannel: unknown }).realtimeChannel = null;
    (valueCaseService as unknown as { listeners: Set<(cases: unknown[]) => void> }).listeners = new Set();
  });

  afterAll(() => {
    (valueCaseService as unknown as {
      getTenantContextFromSession: () => Promise<TenantContext>;
    }).getTenantContextFromSession = originalGetTenantContext;
  });

  it("returns only business cases for the current tenant when owner_id matches across tenants", async () => {
    setTenantContext(TENANT_A);

    const result = await valueCaseService.getValueCases();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("case-a");
  });

  it("denies getValueCase across tenant boundaries for the same owner", async () => {
    setTenantContext(TENANT_A);

    const result = await valueCaseService.getValueCase("case-b");

    expect(result).toBeNull();
  });

  it("applies tenant + owner filters on update and delete paths", async () => {
    setTenantContext(TENANT_A);

    const updateEqCalls: Array<[string, string]> = [];
    const deleteEqCalls: Array<[string, string]> = [];

    const supabase = {
      from: (table: string) => {
        if (table !== "business_cases") {
          throw new Error(`Unexpected table ${table}`);
        }

        const updateBuilder = {
          update: () => updateBuilder,
          eq: (column: string, value: string) => {
            updateEqCalls.push([column, value]);
            return updateBuilder;
          },
          select: () => updateBuilder,
          single: async () => ({ data: businessCaseRows[0], error: null }),
        };

        const deleteBuilder = {
          eq: (column: string, value: string) => {
            deleteEqCalls.push([column, value]);
            return deleteBuilder;
          },
          then: (
            onfulfilled: ((value: { error: null }) => unknown) | null | undefined,
          ) => Promise.resolve({ error: null }).then(onfulfilled),
        };

        return {
          ...updateBuilder,
          delete: () => deleteBuilder,
        };
      },
    };

    (valueCaseService as unknown as { supabase: unknown }).supabase = supabase;

    await valueCaseService.updateValueCase("case-a", { name: "Updated" });
    await valueCaseService.deleteValueCase("case-a");

    expect(updateEqCalls).toContainEqual(["owner_id", SHARED_USER_ID]);
    expect(updateEqCalls).toContainEqual(["metadata->>tenant_id", TENANT_A]);
    expect(deleteEqCalls).toContainEqual(["owner_id", SHARED_USER_ID]);
    expect(deleteEqCalls).toContainEqual(["metadata->>tenant_id", TENANT_A]);
  });

  it("includes tenant scope in realtime subscription filter", async () => {
    setTenantContext(TENANT_A);

    const on = vi.fn().mockReturnThis();
    const subscribe = vi.fn().mockReturnValue({ id: "channel-id" });
    const channel = vi.fn().mockReturnValue({ on, subscribe });

    (valueCaseService as unknown as {
      supabase: {
        channel: (name: string) => { on: typeof on; subscribe: typeof subscribe };
        removeChannel: (channel: unknown) => void;
      };
    }).supabase = {
      channel,
      removeChannel: vi.fn(),
    };

    await (valueCaseService as unknown as { initializeRealtimeChannel: () => Promise<void> }).initializeRealtimeChannel();

    expect(channel).toHaveBeenCalledWith("value-cases-changes");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        filter: `owner_id=eq.${SHARED_USER_ID},metadata->>tenant_id=eq.${TENANT_A}`,
      }),
      expect.any(Function),
    );
  });
});
