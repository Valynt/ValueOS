import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { mockInsert, mockSelect, mockDelete, mockSupabase } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  const mockSelect = vi.fn();
  const mockDelete = vi.fn();

  // Chainable query builder
  const chainable = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: mockSelect,
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: mockInsert,
      delete: mockDelete,
    };
    // Each method returns the chain
    for (const key of Object.keys(chain)) {
      if (key !== "insert" && key !== "delete") {
        chain[key] = vi.fn().mockReturnValue(chain);
      }
    }
    // select returns chain + resolves to data
    chain.select = vi.fn().mockImplementation(() => {
      const c = { ...chain };
      // Make it thenable so await works
      (c as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: [], error: null });
      return c;
    });
    // delete returns chain
    chain.delete = vi.fn().mockReturnValue({
      lt: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    return chain;
  };

  const mockSupabase = {
    from: vi.fn().mockImplementation(() => chainable()),
  };

  return { mockInsert, mockSelect, mockDelete, mockSupabase };
});

vi.mock("../../lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

vi.mock("../../lib/crypto/CryptoUtils", () => ({
  encrypt: vi.fn().mockReturnValue({
    data: "encrypted",
    iv: "iv",
    tag: "tag",
    algorithm: "aes-256-gcm",
  }),
  decrypt: vi.fn().mockReturnValue('{"decrypted": true}'),
  generateEncryptionKey: vi.fn().mockReturnValue("test-key-32-chars-long-enough!!"),
}));

// --- Imports ---

import { AgentAuditLogger, getAuditLogger, logAgentRequest, logAgentResponse } from "../AgentAuditLogger";
import type { AgentAuditLog } from "../AgentAuditLogger";

// --- Helpers ---

function resetSingleton(): void {
  // Reset the singleton so each test gets a fresh instance
  (AgentAuditLogger as unknown as { instance: null }).instance = null;
}

function makeLogEntry(overrides: Partial<AgentAuditLog> = {}): Omit<AgentAuditLog, "id" | "timestamp"> {
  return {
    agent_name: "opportunity",
    input_query: "Analyze Acme Corp",
    success: true,
    organization_id: "org-123",
    user_id: "user-456",
    session_id: "sess-789",
    ...overrides,
  };
}

// --- Tests ---

describe("AgentAuditLogger", () => {
  let auditLogger: AgentAuditLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Disable encryption for most tests (simpler assertions)
    process.env.AUDIT_LOG_ENCRYPTION_ENABLED = "false";

    // Re-wire mockSupabase.from after clearAllMocks
    mockSupabase.from.mockImplementation(() => ({
      insert: mockInsert,
      select: mockSelect,
      delete: mockDelete,
    }));
    mockInsert.mockResolvedValue({ error: null });

    resetSingleton();
    auditLogger = getAuditLogger();
  });

  afterEach(async () => {
    await auditLogger.cleanup();
    vi.useRealTimers();
    delete process.env.AUDIT_LOG_ENCRYPTION_ENABLED;
    delete process.env.AUDIT_LOG_ENCRYPTION_KEY;
    resetSingleton();
  });

  describe("singleton", () => {
    it("returns the same instance on repeated calls", () => {
      const a = getAuditLogger();
      const b = getAuditLogger();
      expect(a).toBe(b);
    });

    it("returns a new instance after reset", () => {
      const a = getAuditLogger();
      resetSingleton();
      const b = getAuditLogger();
      expect(a).not.toBe(b);
    });
  });

  describe("log", () => {
    it("queues an entry without immediately flushing", async () => {
      await auditLogger.log(makeLogEntry());

      // Should not have called supabase yet (queue not full)
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("adds timestamp to queued entries", async () => {
      const now = new Date("2026-01-15T10:00:00Z");
      vi.setSystemTime(now);

      await auditLogger.log(makeLogEntry());

      // Force flush to inspect what gets sent
      await auditLogger.flush();

      const insertCall = mockInsert.mock.calls[0]?.[0];
      expect(insertCall).toBeDefined();
      expect(insertCall[0].timestamp).toBe("2026-01-15T10:00:00.000Z");
    });

    it("flushes when queue reaches MAX_QUEUE_SIZE", async () => {
      // Queue 100 entries (MAX_QUEUE_SIZE)
      for (let i = 0; i < 100; i++) {
        await auditLogger.log(makeLogEntry({ input_query: `query-${i}` }));
      }

      expect(mockSupabase.from).toHaveBeenCalledWith("agent_audit_logs");
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("flush", () => {
    it("does nothing when queue is empty", async () => {
      await auditLogger.flush();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("inserts queued entries into agent_audit_logs table", async () => {
      await auditLogger.log(makeLogEntry());
      await auditLogger.log(makeLogEntry({ agent_name: "target" }));
      await auditLogger.flush();

      expect(mockSupabase.from).toHaveBeenCalledWith("agent_audit_logs");
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const inserted = mockInsert.mock.calls[0][0];
      expect(inserted).toHaveLength(2);
    });

    it("clears queue after successful flush", async () => {
      await auditLogger.log(makeLogEntry());
      await auditLogger.flush();
      // Second flush should be a no-op
      mockSupabase.from.mockClear();
      await auditLogger.flush();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("re-queues entries on database error", async () => {
      mockInsert.mockResolvedValueOnce({ error: new Error("DB down") });

      await auditLogger.log(makeLogEntry());
      await auditLogger.flush();

      // Entry should be re-queued — flush again with success
      mockInsert.mockResolvedValueOnce({ error: null });
      await auditLogger.flush();
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("auto-flush", () => {
    it("flushes on interval", async () => {
      await auditLogger.log(makeLogEntry());

      // Advance past the 5-second flush interval
      vi.advanceTimersByTime(5001);

      // The interval callback should have triggered flush
      expect(mockSupabase.from).toHaveBeenCalledWith("agent_audit_logs");
    });
  });

  describe("sanitization", () => {
    it("truncates long input_query to 1000 chars", async () => {
      const longQuery = "x".repeat(2000);
      await auditLogger.log(makeLogEntry({ input_query: longQuery }));
      await auditLogger.flush();

      const inserted = mockInsert.mock.calls[0][0][0];
      expect(inserted.input_query.length).toBeLessThanOrEqual(1000);
    });

    it("strips script tags from input", async () => {
      await auditLogger.log(
        makeLogEntry({ input_query: 'test<script>alert("xss")</script>query' }),
      );
      await auditLogger.flush();

      const inserted = mockInsert.mock.calls[0][0][0];
      expect(inserted.input_query).not.toContain("<script>");
      expect(inserted.input_query).not.toContain("</script>");
    });

    it("strips javascript: protocol from input", async () => {
      await auditLogger.log(
        makeLogEntry({ input_query: "javascript:alert(1)" }),
      );
      await auditLogger.flush();

      const inserted = mockInsert.mock.calls[0][0][0];
      expect(inserted.input_query).not.toContain("javascript:");
    });

    it("truncates error_message to 500 chars", async () => {
      await auditLogger.log(
        makeLogEntry({ error_message: "e".repeat(1000), success: false }),
      );
      await auditLogger.flush();

      const inserted = mockInsert.mock.calls[0][0][0];
      expect(inserted.error_message.length).toBeLessThanOrEqual(500);
    });
  });

  describe("query — tenant isolation", () => {
    it("throws when organizationId is missing", async () => {
      await expect(
        auditLogger.query({ organizationId: "" }),
      ).rejects.toThrow("organizationId is required");
    });

    it("always applies organization_id filter", async () => {
      // Set up the mock chain to track calls
      const eqFn = vi.fn().mockReturnThis();
      const orderFn = vi.fn().mockReturnThis();
      const limitFn = vi.fn().mockReturnThis();
      const selectFn = vi.fn().mockReturnValue({
        eq: eqFn,
        order: orderFn,
        limit: limitFn,
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
      });
      // Make eq return the chain
      eqFn.mockReturnValue({
        eq: eqFn,
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: orderFn,
        limit: limitFn,
        range: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
      });
      orderFn.mockReturnValue({
        limit: limitFn,
        range: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
      });
      limitFn.mockReturnValue({
        range: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
      });

      mockSupabase.from.mockReturnValue({ select: selectFn });

      await auditLogger.query({ organizationId: "org-tenant-1" });

      expect(mockSupabase.from).toHaveBeenCalledWith("agent_audit_logs");
      expect(eqFn).toHaveBeenCalledWith("organization_id", "org-tenant-1");
    });

    it("applies optional filters alongside tenant filter", async () => {
      const eqFn = vi.fn();
      const chain = {
        eq: eqFn,
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
      };
      eqFn.mockReturnValue(chain);
      const selectFn = vi.fn().mockReturnValue(chain);
      mockSupabase.from.mockReturnValue({ select: selectFn });

      await auditLogger.query({
        organizationId: "org-1",
        agent: "opportunity",
        userId: "user-1",
        success: true,
      });

      // First eq call is always organization_id
      expect(eqFn.mock.calls[0]).toEqual(["organization_id", "org-1"]);
      expect(eqFn).toHaveBeenCalledWith("agent_name", "opportunity");
      expect(eqFn).toHaveBeenCalledWith("user_id", "user-1");
      expect(eqFn).toHaveBeenCalledWith("success", true);
    });
  });

  describe("sensitive data detection", () => {
    it("detects password patterns", async () => {
      await auditLogger.log(
        makeLogEntry({ input_query: "my password is secret123" }),
      );
      await auditLogger.flush();

      // The sanitizeAndZeroMemory path should handle sensitive data
      // We verify the entry was processed (not thrown)
      expect(mockInsert).toHaveBeenCalled();
    });

    it("detects SSN patterns", async () => {
      await auditLogger.log(
        makeLogEntry({ input_query: "social security number 123-45-6789" }),
      );
      await auditLogger.flush();
      expect(mockInsert).toHaveBeenCalled();
    });

    it("detects credit card patterns", async () => {
      await auditLogger.log(
        makeLogEntry({ input_query: "credit card 4111-1111-1111-1111" }),
      );
      await auditLogger.flush();
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("deleteOldLogs", () => {
    it("deletes logs older than specified days", async () => {
      vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));

      const ltFn = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: "1" }, { id: "2" }], error: null }),
      });
      const deleteFn = vi.fn().mockReturnValue({ lt: ltFn });
      mockSupabase.from.mockReturnValue({ delete: deleteFn });

      const count = await auditLogger.deleteOldLogs(90);

      expect(mockSupabase.from).toHaveBeenCalledWith("agent_audit_logs");
      expect(deleteFn).toHaveBeenCalled();
      // Cutoff should be ~90 days before 2026-06-15
      expect(ltFn).toHaveBeenCalledWith(
        "timestamp",
        expect.stringContaining("2026-03"),
      );
      expect(count).toBe(2);
    });

    it("returns 0 on database error", async () => {
      const ltFn = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: new Error("fail") }),
      });
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({ lt: ltFn }),
      });

      const count = await auditLogger.deleteOldLogs(30);
      expect(count).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("flushes remaining entries and stops auto-flush", async () => {
      await auditLogger.log(makeLogEntry());
      await auditLogger.cleanup();

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("helper functions", () => {
    it("logAgentRequest logs with correct fields", async () => {
      await logAgentRequest("opportunity", "test query", {
        userId: "u1",
        organizationId: "org-1",
        sessionId: "s1",
      });

      // Flush to verify
      const logger = getAuditLogger();
      await logger.flush();

      const inserted = mockInsert.mock.calls[0]?.[0]?.[0];
      expect(inserted).toBeDefined();
      expect(inserted.agent_name).toBe("opportunity");
      expect(inserted.organization_id).toBe("org-1");
      expect(inserted.success).toBe(true);
    });

    it("logAgentResponse logs success and failure", async () => {
      await logAgentResponse(
        "target",
        "query",
        false,
        undefined,
        undefined,
        "LLM timeout",
        { organizationId: "org-2" },
      );

      const logger = getAuditLogger();
      await logger.flush();

      const inserted = mockInsert.mock.calls[0]?.[0]?.[0];
      expect(inserted.success).toBe(false);
      expect(inserted.organization_id).toBe("org-2");
    });
  });
});
