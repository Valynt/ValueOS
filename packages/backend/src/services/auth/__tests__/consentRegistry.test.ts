import { describe, expect, it } from "vitest";

import { createDatabaseConsentRegistry } from "../consentRegistry.js";

type ConsentRow = {
  auth_subject: string;
  consent_type: string;
  id: string;
  tenant_id: string;
  withdrawn_at: string | null;
};

function createSupabaseStub(rows: ConsentRow[]) {
  const filters = new Map<string, string | null>();

  const builder = {
    select() {
      return builder;
    },
    eq(column: string, value: string) {
      filters.set(column, value);
      return builder;
    },
    is(column: string, value: null) {
      filters.set(column, value);
      return builder;
    },
    async limit() {
      const matches = rows.filter((row) => {
        return Array.from(filters.entries()).every(([column, value]) => {
          const rowValue = row[column as keyof ConsentRow];
          return rowValue === value;
        });
      });

      return {
        data: matches.slice(0, 1).map(({ id }) => ({ id })),
        error: null,
      };
    },
  };

  return {
    from(table: string) {
      expect(table).toBe("user_consents");
      return builder;
    },
  };
}

describe("createDatabaseConsentRegistry", () => {
  it("returns true only for the consented subject within the same tenant", async () => {
    const registry = createDatabaseConsentRegistry();
    const supabase = createSupabaseStub([
      {
        id: "consent-a",
        tenant_id: "tenant-1",
        auth_subject: "subject-a",
        consent_type: "llm.chat",
        withdrawn_at: null,
      },
    ]);

    await expect(
      registry.hasConsent({
        tenantId: "tenant-1",
        scope: "llm.chat",
        subject: "subject-a",
        supabase,
      })
    ).resolves.toBe(true);

    await expect(
      registry.hasConsent({
        tenantId: "tenant-1",
        scope: "llm.chat",
        subject: "subject-b",
        supabase,
      })
    ).resolves.toBe(false);
  });

  it("does not treat withdrawn consent as active", async () => {
    const registry = createDatabaseConsentRegistry();
    const supabase = createSupabaseStub([
      {
        id: "withdrawn-consent",
        tenant_id: "tenant-1",
        auth_subject: "subject-a",
        consent_type: "llm.chat",
        withdrawn_at: "2026-03-18T10:00:00.000Z",
      },
    ]);

    await expect(
      registry.hasConsent({
        tenantId: "tenant-1",
        scope: "llm.chat",
        subject: "subject-a",
        supabase,
      })
    ).resolves.toBe(false);
  });

  it("does not satisfy consent checks with a cross-tenant record", async () => {
    const registry = createDatabaseConsentRegistry();
    const supabase = createSupabaseStub([
      {
        id: "cross-tenant-consent",
        tenant_id: "tenant-2",
        auth_subject: "subject-a",
        consent_type: "llm.chat",
        withdrawn_at: null,
      },
    ]);

    await expect(
      registry.hasConsent({
        tenantId: "tenant-1",
        scope: "llm.chat",
        subject: "subject-a",
        supabase,
      })
    ).resolves.toBe(false);
  });
});
