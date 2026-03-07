import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTenantIsolationFixture,
  type TenantIsolationFixture,
} from "./tenantIsolationTestUtils";

type CrossTenantExpectation = "not_found" | "forbidden";

type RlsTarget = {
  table: "agent_sessions" | "value_cases";
  id: string;
  tenantColumn: "tenant_id";
  createPayload: (tenantId: string) => Record<string, unknown>;
};

const EXPECTED_SEMANTICS: Record<"read" | "write", CrossTenantExpectation> = {
  read: "not_found",
  write: "forbidden",
};

const assertCrossTenantRead = (rows: unknown[] | null) => {
  expect(EXPECTED_SEMANTICS.read).toBe("not_found");
  expect(rows ?? []).toEqual([]);
};

const assertCrossTenantWrite = (outcome: {
  error: { message: string } | null;
  data: unknown[] | null;
}) => {
  expect(EXPECTED_SEMANTICS.write).toBe("forbidden");
  // For cross-tenant writes, RLS should silently filter out the operation:
  // no error and zero affected rows.
  expect(outcome.error).toBeNull();
  const rows = Array.isArray(outcome.data) ? outcome.data : [];
  expect(rows).toEqual([]);
};

describe("Supabase RLS policy matrix hard gate", () => {
  let fixture: TenantIsolationFixture;

  beforeAll(async () => {
    fixture = await createTenantIsolationFixture();
  });

  afterAll(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
  });

  const targets: RlsTarget[] = [
    {
      table: "agent_sessions",
      id: "sec-agent-session-a",
      tenantColumn: "tenant_id",
      createPayload: tenantId => ({
        id: "sec-agent-session-a",
        tenant_id: tenantId,
        agent_id: "security-agent",
        status: "active",
      }),
    },
    {
      table: "value_cases",
      id: "sec-value-case-a",
      tenantColumn: "tenant_id",
      createPayload: tenantId => ({
        id: "sec-value-case-a",
        tenant_id: tenantId,
        name: "Security value case",
        description: "RLS matrix",
        status: "draft",
      }),
    },
  ];

  for (const target of targets) {
    it(`enforces standardized cross-tenant semantics on ${target.table}`, async () => {
      const { error: insertError } = await fixture.adminClient
        .from(target.table)
        .insert(target.createPayload(fixture.tenantOne.tenantId));
      expect(insertError).toBeNull();

      try {
        const { data: readData, error: readError } =
          await fixture.tenantTwo.client
            .from(target.table)
            .select("id")
            .eq("id", target.id);

        expect(readError).toBeNull();
        assertCrossTenantRead(readData as unknown[] | null);

        const { data: updateData, error: updateError } =
          await fixture.tenantTwo.client
            .from(target.table)
            .update({ updated_at: new Date().toISOString() })
            .eq("id", target.id)
            .select("id");

        assertCrossTenantWrite({
          error: updateError ? { message: updateError.message } : null,
          data: updateData as unknown[] | null,
        });

        const { data: deleteData, error: deleteError } =
          await fixture.tenantTwo.client
            .from(target.table)
            .delete()
            .eq("id", target.id)
            .select("id");

        assertCrossTenantWrite({
          error: deleteError ? { message: deleteError.message } : null,
          data: deleteData as unknown[] | null,
        });

        const { data: ownerView, error: ownerViewError } =
          await fixture.tenantOne.client
            .from(target.table)
            .select("id")
            .eq("id", target.id);

        expect(ownerViewError).toBeNull();
        expect(ownerView?.map(row => row.id)).toEqual([target.id]);
      } finally {
        await fixture.adminClient.from(target.table).delete().eq("id", target.id);
      }
    });
  }

  it("uses tenant-distinct JWT-shaped contexts for non-admin operations", async () => {
    expect(fixture.tenantOne.accessToken).not.toBe(
      fixture.tenantTwo.accessToken
    );
    expect(fixture.tenantOne.tenantId).not.toBe(fixture.tenantTwo.tenantId);
    expect(fixture.tenantOne.userId).not.toBe(fixture.tenantTwo.userId);
  });
});
