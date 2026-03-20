import { describe, expect, it } from "vitest";

import { RequestScopedValueCaseAccessService } from "../RequestScopedValueCaseAccessService.js";

const CASE_ID = "case-shared-123";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const rows = [
  { id: CASE_ID, status: "draft", tenant_id: TENANT_A },
  { id: "case-tenant-b", status: "draft", tenant_id: TENANT_B },
];

function buildUserScopedSupabaseClient(tenantId: string) {
  return {
    from: (_table: string) => {
      let requestedId: string | null = null;

      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          if (column === "id") {
            requestedId = value;
          }
          return builder;
        },
        async maybeSingle() {
          const match = rows.find((row) => row.id === requestedId && row.tenant_id === tenantId) ?? null;
          return { data: match ? { id: match.id, status: match.status } : null, error: null };
        },
      };

      return builder;
    },
  };
}

describe("RequestScopedValueCaseAccessService", () => {
  it("returns the case for the tenant that owns it", async () => {
    const service = new RequestScopedValueCaseAccessService(
      buildUserScopedSupabaseClient(TENANT_A) as never,
    );

    await expect(
      service.assertCaseReadable({ caseId: CASE_ID, tenantId: TENANT_A, route: "/api/cases/:caseId" }),
    ).resolves.toEqual({ id: CASE_ID, status: "draft" });
  });

  it("returns null for a cross-tenant read even when tenant filters are omitted", async () => {
    const service = new RequestScopedValueCaseAccessService(
      buildUserScopedSupabaseClient(TENANT_B) as never,
    );

    await expect(
      service.assertCaseReadable({ caseId: CASE_ID, tenantId: TENANT_B, route: "/api/cases/:caseId" }),
    ).resolves.toBeNull();
  });
});
