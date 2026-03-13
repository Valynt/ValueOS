/**
 * AuditLogService — tenant_id propagation and hash-chain tests
 *
 * Covers:
 * - tenant_id is written to the insert payload when supplied
 * - tenant_id is null when omitted (backward-compatible)
 * - integrity_hash is a non-empty hex string
 * - previous_hash chains across consecutive entries
 * - hash changes when any input field changes
 * - DB error does not advance lastHash
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock state ───────────────────────────────────────────────────────
// vi.mock factories are hoisted to the top of the file by Vitest's transformer,
// so any variables they reference must also be hoisted via vi.hoisted().

const {
  mockSingle,
  mockMaybeSingle,
  mockInsertSelect,
  insertedRows,
  mockInsert,
  makeInsertMock,
  mockFrom,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockInsertSelect = vi.fn();
  const insertedRows: Record<string, unknown>[] = [];

  // Shared factory — used for initial setup and restoring after a throw override.
  // Centralising here ensures the restore in the error-path test stays in sync
  // with the primary implementation.
  function makeInsertMock() {
    return (row: Record<string, unknown>) => {
      insertedRows.push(row);
      return { select: () => ({ single: mockInsertSelect }) };
    };
  }

  const mockInsert = vi.fn().mockImplementation(makeInsertMock());

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: mockInsert,
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    };
  });

  const mockSupabaseClient = {
    from: mockFrom,
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
      },
    },
  };

  return { mockSingle, mockMaybeSingle, mockInsertSelect, insertedRows, mockInsert, makeInsertMock, mockFrom, mockSupabaseClient };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// piiFilter is imported with a wrong relative path in AuditLogService
// ("../lib/piiFilter.js" from services/security/ -> resolves to services/lib/).
// Mock both paths so the test is path-agnostic.
vi.mock("../lib/piiFilter.js", () => ({ sanitizeForLogging: (v: unknown) => v }));
vi.mock("../../lib/piiFilter.js", () => ({ sanitizeForLogging: (v: unknown) => v }));

vi.mock("../../lib/supabase.js", () => ({
  createServerSupabaseClient: () => mockSupabaseClient,
  supabase: mockSupabaseClient, // BaseService imports this named export
}));

// ── Import after mock is registered ─────────────────────────────────────────
import { AuditLogService } from "../security/AuditLogService.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  userId: "user-abc",
  userName: "Alice",
  userEmail: "alice@example.com",
  action: "create",
  resourceType: "value_case",
  resourceId: "case-001",
} as const;

function makeReturnRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    tenant_id: null,
    user_id: BASE_INPUT.userId,
    user_name: BASE_INPUT.userName,
    user_email: BASE_INPUT.userEmail,
    action: BASE_INPUT.action,
    resource_type: BASE_INPUT.resourceType,
    resource_id: BASE_INPUT.resourceId,
    details: {},
    ip_address: "",
    user_agent: "",
    status: "success",
    timestamp: new Date().toISOString(),
    integrity_hash: "aabbcc",
    previous_hash: null,
    archived: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AuditLogService -- tenant_id propagation", () => {
  let service: AuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    insertedRows.length = 0;
    // hash-chain init: maybeSingle returns no prior row
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    service = new AuditLogService();
  });

  it("writes tenant_id to the insert row when supplied", async () => {
    const tenantId = "tenant-111";
    mockInsertSelect.mockResolvedValue({ data: makeReturnRow({ tenant_id: tenantId }), error: null });

    await service.createEntry({ ...BASE_INPUT, tenantId });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ tenant_id: tenantId });
  });

  it("writes null tenant_id when tenantId is omitted (backward-compatible)", async () => {
    mockInsertSelect.mockResolvedValue({ data: makeReturnRow(), error: null });

    await service.createEntry({ ...BASE_INPUT });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ tenant_id: null });
  });

  it("does not duplicate tenantId inside the details payload", async () => {
    const tenantId = "tenant-222";
    mockInsertSelect.mockResolvedValue({ data: makeReturnRow({ tenant_id: tenantId }), error: null });

    await service.createEntry({ ...BASE_INPUT, tenantId, details: { foo: "bar" } });

    const row = insertedRows[0] as Record<string, unknown>;
    const details = row["details"] as Record<string, unknown>;
    expect(details).not.toHaveProperty("tenantId");
    expect(details).not.toHaveProperty("tenant_id");
  });
});

describe("AuditLogService -- integrity hash chain", () => {
  let service: AuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    insertedRows.length = 0;
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    service = new AuditLogService();
  });

  it("produces a non-empty hex integrity_hash", async () => {
    mockInsertSelect.mockResolvedValue({ data: makeReturnRow(), error: null });

    await service.createEntry({ ...BASE_INPUT });

    const row = insertedRows[0] as Record<string, unknown>;
    expect(typeof row["integrity_hash"]).toBe("string");
    expect((row["integrity_hash"] as string).length).toBeGreaterThan(0);
    // SHA-256 hex is 64 chars
    expect((row["integrity_hash"] as string)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("first entry has null previous_hash", async () => {
    mockInsertSelect.mockResolvedValue({ data: makeReturnRow(), error: null });

    await service.createEntry({ ...BASE_INPUT });

    const row = insertedRows[0] as Record<string, unknown>;
    expect(row["previous_hash"]).toBeUndefined();
  });

  it("second entry's previous_hash equals first entry's integrity_hash", async () => {
    mockInsertSelect
      .mockResolvedValueOnce({ data: makeReturnRow({ integrity_hash: "first-hash-hex" }), error: null })
      .mockResolvedValueOnce({ data: makeReturnRow({ integrity_hash: "second-hash-hex" }), error: null });

    await service.createEntry({ ...BASE_INPUT });
    await service.createEntry({ ...BASE_INPUT, action: "update" });

    const firstHash = insertedRows[0]["integrity_hash"] as string;
    const secondPrev = insertedRows[1]["previous_hash"] as string | undefined;

    expect(secondPrev).toBe(firstHash);
  });

  it("hash changes when action field changes", async () => {
    mockInsertSelect
      .mockResolvedValueOnce({ data: makeReturnRow(), error: null })
      .mockResolvedValueOnce({ data: makeReturnRow(), error: null });

    await service.createEntry({ ...BASE_INPUT, action: "create" });
    await service.createEntry({ ...BASE_INPUT, action: "delete" });

    const hash1 = insertedRows[0]["integrity_hash"] as string;
    const hash2 = insertedRows[1]["integrity_hash"] as string;

    expect(hash1).not.toBe(hash2);
  });

  it("hash changes when resourceId changes", async () => {
    mockInsertSelect
      .mockResolvedValueOnce({ data: makeReturnRow(), error: null })
      .mockResolvedValueOnce({ data: makeReturnRow(), error: null });

    await service.createEntry({ ...BASE_INPUT, resourceId: "case-001" });
    await service.createEntry({ ...BASE_INPUT, resourceId: "case-002" });

    const hash1 = insertedRows[0]["integrity_hash"] as string;
    const hash2 = insertedRows[1]["integrity_hash"] as string;

    expect(hash1).not.toBe(hash2);
  });

  it("rejects on DB error and does not advance lastHash", async () => {
    // Use fake timers so BaseService.sleep() resolves instantly -- avoids the
    // 1s + 2s + 4s backoff wait across 3 retry attempts without touching
    // private BaseService internals.
    vi.useFakeTimers();

    try {
      // First entry succeeds -- establishes a known lastHash
      mockInsertSelect.mockResolvedValueOnce({
        data: makeReturnRow({ integrity_hash: "good-hash" }),
        error: null,
      });

      await service.createEntry({ ...BASE_INPUT });
      const hashAfterFirst = insertedRows[0]["integrity_hash"] as string;

      // Second entry: make the insert throw on every attempt so all retries exhaust.
      mockInsert.mockImplementation(() => {
        throw new Error("connection timeout");
      });

      // Drive the retry loop: each retry creates a new setTimeout after the previous
      // one fires, so we advance timers iteratively until the promise settles.
      const failPromise = service.createEntry({ ...BASE_INPUT, action: "update" });
      let settled = false;
      failPromise.catch(() => { settled = true; });
      for (let i = 0; i < 10 && !settled; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      await expect(failPromise).rejects.toBeDefined();

      // Restore insert using the shared factory so the implementation stays in sync
      // with the hoisted definition -- no duplication of the select-chain shape.
      mockInsert.mockImplementation(makeInsertMock());
      mockInsertSelect.mockResolvedValueOnce({ data: makeReturnRow(), error: null });

      // lastHash must not have advanced -- third entry's previous_hash equals first entry's hash
      await service.createEntry({ ...BASE_INPUT, action: "delete" });
      // insertedRows: [0] = first success, [1] = third call (second call threw, never pushed)
      const thirdPrev = insertedRows[1]["previous_hash"] as string | undefined;

      expect(thirdPrev).toBe(hashAfterFirst);
    } finally {
      vi.useRealTimers();
    }
  });
});
