import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks (accessible inside vi.mock factories) ---

const { mockSupabase, createQueryBuilder } = vi.hoisted(() => {
  function createQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    const chainMethods = [
      "select",
      "insert",
      "delete",
      "eq",
      "gte",
      "lte",
      "lt",
      "order",
      "limit",
      "range",
    ];
    for (const method of chainMethods) {
      builder[method] = vi.fn().mockReturnValue(builder);
    }
    builder.then = vi
      .fn()
      .mockImplementation((resolve: (v: unknown) => void) =>
        resolve(resolvedValue)
      );
    return builder;
  }

  const mockSupabase = {
    from: vi.fn().mockReturnValue(createQueryBuilder({ data: [], error: null })),
  };

  return { mockSupabase, createQueryBuilder };
});

// --- Mocks (before imports) ---

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

vi.mock("../../lib/crypto/CryptoUtils", () => ({
  encrypt: vi.fn().mockReturnValue({
    data: "enc-data",
    iv: "enc-iv",
    tag: "enc-tag",
    algorithm: "aes-256-gcm",
  }),
  decrypt: vi.fn().mockReturnValue('{"decrypted":true}'),
  generateEncryptionKey: vi.fn().mockReturnValue("test-encryption-key-32chars"),
}));

// --- Imports ---

import type { AgentType } from "../agent-types";
import { AgentAuditLogger, getAuditLogger } from "../AgentAuditLogger";

// --- Helpers ---

function makeLogEntry(overrides: Record<string, unknown> = {}) {
  return {
    agent_name: "opportunity" as AgentType,
    input_query: "Analyze Acme Corp",
    success: true,
    user_id: "user-1",
    organization_id: "org-1",
    session_id: "session-1",
    ...overrides,
  };
}

// --- Tests ---

describe("AgentAuditLogger", () => {
  let auditLogger: AgentAuditLogger;
  // Shared reference to the current query builder mock
  let currentBuilder: ReturnType<typeof createQueryBuilder>;

  function setQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
    currentBuilder = createQueryBuilder(resolvedValue);
    mockSupabase.from.mockReturnValue(currentBuilder);
    return currentBuilder;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton between tests
    (AgentAuditLogger as unknown as { instance: null }).instance = null;
    // Disable encryption by default for simpler tests
    process.env.AUDIT_LOG_ENCRYPTION_ENABLED = "false";

    setQueryBuilder({ data: [], error: null });
    auditLogger = AgentAuditLogger.getInstance();
  });

  afterEach(async () => {
    await auditLogger.cleanup();
  });

  // ==========================================================================
  // Singleton
  // ==========================================================================

  describe("singleton", () => {
    it("returns the same instance on repeated calls", () => {
      const a = AgentAuditLogger.getInstance();
      const b = AgentAuditLogger.getInstance();
      expect(a).toBe(b);
    });

    it("getAuditLogger helper returns singleton", () => {
      const instance = getAuditLogger();
      expect(instance).toBe(AgentAuditLogger.getInstance());
    });
  });

  // ==========================================================================
  // log() — queuing
  // ==========================================================================

  describe("log", () => {
    it("adds entry to internal queue", async () => {
      await auditLogger.log(makeLogEntry());
      // Flush to verify the entry was queued
      await auditLogger.flush();

      expect(mockSupabase.from).toHaveBeenCalledWith("agent_audit_logs");
      expect(currentBuilder.insert).toHaveBeenCalledTimes(1);
      const insertedEntries = currentBuilder.insert.mock.calls[0][0];
      expect(insertedEntries).toHaveLength(1);
      expect(insertedEntries[0].agent_name).toBe("opportunity");
      expect(insertedEntries[0].timestamp).toBeDefined();
    });

    it("does not log when logging is disabled", async () => {
      // Access private field to disable
      (auditLogger as unknown as { enableLogging: boolean }).enableLogging =
        false;

      await auditLogger.log(makeLogEntry());
      await auditLogger.flush();

      expect(currentBuilder.insert).not.toHaveBeenCalled();
    });

    it("auto-flushes when queue reaches MAX_QUEUE_SIZE", async () => {
      // Queue 100 entries (MAX_QUEUE_SIZE)
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(auditLogger.log(makeLogEntry({ input_query: `q-${i}` })));
      }
      await Promise.all(promises);

      // Should have auto-flushed
      expect(currentBuilder.insert).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // flush()
  // ==========================================================================

  describe("flush", () => {
    it("does nothing when queue is empty", async () => {
      await auditLogger.flush();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("inserts queued entries into supabase", async () => {
      await auditLogger.log(makeLogEntry());
      await auditLogger.log(makeLogEntry({ agent_name: "target" }));
      await auditLogger.flush();

      expect(currentBuilder.insert).toHaveBeenCalledTimes(1);
      const entries = currentBuilder.insert.mock.calls[0][0];
      expect(entries).toHaveLength(2);
    });

    it("re-queues entries on database error", async () => {
      const errorBuilder = createQueryBuilder({
        data: null,
        error: new Error("DB connection failed"),
      });
      mockSupabase.from.mockReturnValue(errorBuilder);

      await auditLogger.log(makeLogEntry());
      await auditLogger.flush();

      // Entry should be re-queued — flush again with working DB
      mockSupabase.from.mockReturnValue(
        createQueryBuilder({ data: [], error: null })
      );
      await auditLogger.flush();

      // The re-queued entry should be flushed now
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // sanitization
  // ==========================================================================

  describe("sanitization", () => {
    it("truncates long input_query", async () => {
      const longQuery = "a".repeat(2000);
      await auditLogger.log(makeLogEntry({ input_query: longQuery }));
      await auditLogger.flush();

      const entries = currentBuilder.insert.mock.calls[0][0];
      expect(entries[0].input_query.length).toBeLessThanOrEqual(1000);
    });

    it("strips script tags from input", async () => {
      await auditLogger.log(
        makeLogEntry({
          input_query: 'test<script>alert("xss")</script>query',
        })
      );
      await auditLogger.flush();

      const entries = currentBuilder.insert.mock.calls[0][0];
      expect(entries[0].input_query).not.toContain("<script>");
    });

    it("strips javascript: protocol from input", async () => {
      await auditLogger.log(
        makeLogEntry({ input_query: "javascript:alert(1)" })
      );
      await auditLogger.flush();

      const entries = currentBuilder.insert.mock.calls[0][0];
      expect(entries[0].input_query).not.toContain("javascript:");
    });

    it("strips HTML special characters", async () => {
      await auditLogger.log(
        makeLogEntry({ input_query: '<img src="x" onerror="alert(1)">' })
      );
      await auditLogger.flush();

      const entries = currentBuilder.insert.mock.calls[0][0];
      expect(entries[0].input_query).not.toContain("<");
      expect(entries[0].input_query).not.toContain(">");
    });
  });

  // ==========================================================================
  // Sensitive data detection
  // ==========================================================================

  describe("sensitive data detection", () => {
    it("detects password patterns", () => {
      const detector = (auditLogger as unknown as {
        containsSensitiveData: (d: unknown) => boolean;
      }).containsSensitiveData.bind(auditLogger);

      expect(detector("my password is secret123")).toBe(true);
      expect(detector("the api_key is abc")).toBe(true);
      expect(detector("social security number")).toBe(true);
      expect(detector("credit card 4111")).toBe(true);
    });

    it("does not flag normal business text", () => {
      const detector = (auditLogger as unknown as {
        containsSensitiveData: (d: unknown) => boolean;
      }).containsSensitiveData.bind(auditLogger);

      expect(detector("Analyze revenue growth for Q4")).toBe(false);
      expect(detector("Build ROI model for Acme Corp")).toBe(false);
    });

    it("identifies sensitive field names", () => {
      const checker = (auditLogger as unknown as {
        isSensitiveField: (f: string) => boolean;
      }).isSensitiveField.bind(auditLogger);

      expect(checker("password")).toBe(true);
      expect(checker("api_key")).toBe(true);
      expect(checker("ssn")).toBe(true);
      expect(checker("credit_card")).toBe(true);
      expect(checker("company_name")).toBe(false);
      expect(checker("revenue")).toBe(false);
    });
  });

  // ==========================================================================
  // query() — tenant isolation
  // ==========================================================================

  describe("query", () => {
    it("requires organizationId for tenant isolation", async () => {
      await expect(
        auditLogger.query({ organizationId: "" } as never)
      ).rejects.toThrow("organizationId is required");
    });

    it("applies organization_id filter first", async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      mockSupabase.from.mockReturnValue(builder);

      await auditLogger.query({ organizationId: "org-123" });

      expect(builder.eq).toHaveBeenCalledWith(
        "organization_id",
        "org-123"
      );
    });

    it("applies all provided filters", async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      mockSupabase.from.mockReturnValue(builder);

      await auditLogger.query({
        organizationId: "org-1",
        agent: "target" as AgentType,
        userId: "user-1",
        sessionId: "sess-1",
        success: true,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        limit: 10,
        offset: 5,
        sortOrder: "asc",
      });

      expect(builder.eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builder.eq).toHaveBeenCalledWith("agent_name", "target");
      expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(builder.eq).toHaveBeenCalledWith("session_id", "sess-1");
      expect(builder.eq).toHaveBeenCalledWith("success", true);
      expect(builder.gte).toHaveBeenCalled();
      expect(builder.lte).toHaveBeenCalled();
      expect(builder.order).toHaveBeenCalledWith("timestamp", {
        ascending: true,
      });
      expect(builder.limit).toHaveBeenCalledWith(10);
      expect(builder.range).toHaveBeenCalledWith(5, 14);
    });

    it("returns empty array on database error", async () => {
      const builder = createQueryBuilder({
        data: null,
        error: new Error("DB error"),
      });
      mockSupabase.from.mockReturnValue(builder);

      const result = await auditLogger.query({ organizationId: "org-1" });
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getStats()
  // ==========================================================================

  describe("getStats", () => {
    it("computes statistics from queried logs", async () => {
      const mockLogs = [
        {
          agent_name: "opportunity",
          success: true,
          timestamp: "2025-06-01T10:00:00Z",
          response_metadata: { duration: 100, confidence: 0.9 },
        },
        {
          agent_name: "opportunity",
          success: true,
          timestamp: "2025-06-01T11:00:00Z",
          response_metadata: { duration: 200, confidence: 0.8 },
        },
        {
          agent_name: "target",
          success: false,
          timestamp: "2025-06-02T10:00:00Z",
          response_metadata: { duration: 50 },
        },
      ];

      const builder = createQueryBuilder({ data: mockLogs, error: null });
      mockSupabase.from.mockReturnValue(builder);

      const stats = await auditLogger.getStats({ organizationId: "org-1" } as never);

      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(1);
      expect(stats.averageDuration).toBeCloseTo(116.67, 0);
      expect(stats.averageConfidence).toBeCloseTo(0.85, 2);
      expect(stats.byAgent.opportunity).toBe(2);
      expect(stats.byAgent.target).toBe(1);
      expect(stats.timeline).toHaveLength(2);
    });

    it("handles empty log set", async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      mockSupabase.from.mockReturnValue(builder);

      const stats = await auditLogger.getStats({ organizationId: "org-1" } as never);

      expect(stats.totalRequests).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });

  // ==========================================================================
  // deleteOldLogs()
  // ==========================================================================

  describe("deleteOldLogs", () => {
    it("deletes logs older than specified days", async () => {
      const builder = createQueryBuilder({
        data: [{ id: "1" }, { id: "2" }],
        error: null,
      });
      mockSupabase.from.mockReturnValue(builder);

      const count = await auditLogger.deleteOldLogs(90);

      expect(mockSupabase.from).toHaveBeenCalledWith("agent_audit_logs");
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.lt).toHaveBeenCalled();
      expect(count).toBe(2);
    });

    it("returns 0 on database error", async () => {
      const builder = createQueryBuilder({
        data: null,
        error: new Error("delete failed"),
      });
      mockSupabase.from.mockReturnValue(builder);

      const count = await auditLogger.deleteOldLogs(30);
      expect(count).toBe(0);
    });
  });

  // ==========================================================================
  // Encryption
  // ==========================================================================

  describe("encryption", () => {
    it("encrypts response_data when encryption is enabled", async () => {
      // Reset singleton with encryption enabled
      (AgentAuditLogger as unknown as { instance: null }).instance = null;
      process.env.AUDIT_LOG_ENCRYPTION_ENABLED = "true";
      const encLogger = AgentAuditLogger.getInstance();

      await encLogger.log(
        makeLogEntry({
          response_data: { analysis: "test data" },
        })
      );
      await encLogger.flush();

      const entries = currentBuilder.insert.mock.calls[0][0];
      expect(entries[0].response_data.__encrypted__).toBe(true);
      expect(entries[0].response_data.data).toBe("enc-data");
      expect(entries[0].response_data.iv).toBe("enc-iv");

      await encLogger.cleanup();
    });

    it("reports encryption status correctly", () => {
      expect(auditLogger.isEncryptionEnabled()).toBe(false);

      auditLogger.setEncryptionEnabled(true);
      expect(auditLogger.isEncryptionEnabled()).toBe(true);
    });
  });

  // ==========================================================================
  // cleanup()
  // ==========================================================================

  describe("cleanup", () => {
    it("flushes remaining entries and stops auto-flush", async () => {
      await auditLogger.log(makeLogEntry());
      await auditLogger.cleanup();

      expect(currentBuilder.insert).toHaveBeenCalledTimes(1);
    });
  });
});
