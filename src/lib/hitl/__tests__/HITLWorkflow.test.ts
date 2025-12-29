import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HITLFramework } from "../HITLFramework";
import { InMemoryHITLStorage } from "../HITLStorage";
import { AgentIdentity } from "../../auth/AgentIdentity";

// Mock dependencies
// Expose errors to console for debugging
vi.mock("../../logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn((msg, meta) =>
      console.error("[MOCK_LOGGER_ERROR]", msg, meta)
    ),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("HITL Workflow Engine", () => {
  let framework: HITLFramework;
  let mockAuditLogger: { logEvent: ReturnType<typeof vi.fn> };

  // Test Data
  const agent: AgentIdentity = {
    id: "agent-123",
    role: "TargetAgent", // permissions handled in Identity, here just role string
    organizationId: "org-1",
    auditToken: "token-123",
    permissions: [],
    scope: "global",
    capabilities: [],
  } as any; // Cast to AgentIdentity

  beforeEach(() => {
    vi.useFakeTimers();
    framework = HITLFramework.getInstance();

    // Force InMemory Storage for tests
    framework.setStorage(new InMemoryHITLStorage());

    // Inject Mock Audit Logger
    mockAuditLogger = { logEvent: vi.fn() };
    framework.setAuditLogger(mockAuditLogger);

    // Register Test Gate
    framework.registerGate({
      id: "gate:test",
      action: "system:high_risk_action",
      riskLevel: "high",
      requiredApprovers: 1,
      approverRoles: ["manager"],
      timeoutSeconds: 3600,
      escalationPath: ["director"],
      enabled: true,
    });
  });

  afterEach(() => {
    // Clean up
    framework.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Request Lifecycle", () => {
    it("should PERSIST pending request to storage", async () => {
      const request = await framework.requestApproval(
        agent,
        "system:high_risk_action",
        { description: "Delete DB", impact: "High", reversible: false },
        { preview: {}, affectedRecords: 100 }
      );

      expect(request.status).toBe("pending");

      // Verify Audit Log using mock
      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringMatching(/CREATED/),
        })
      );
    });

    it("should APPROVE request when sufficient approvals are met", async () => {
      const request = await framework.requestApproval(
        agent,
        "system:high_risk_action",
        { description: "Deploy", impact: "Med", reversible: true },
        { preview: {}, affectedRecords: 1 }
      );

      await framework.submitDecision(
        request.id,
        "human-1",
        "manager",
        "approve"
      );

      const updated = await framework.getRequest(request.id);
      expect(updated?.status).toBe("approved");

      // Verify Audit
      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringMatching(/APPROVED/),
          actor: expect.objectContaining({ id: "human-1" }),
        })
      );
    });

    it("should REJECT request immediately", async () => {
      const request = await framework.requestApproval(
        agent,
        "system:high_risk_action",
        { description: "Bad Action", impact: "High", reversible: false },
        { preview: {}, affectedRecords: 1 }
      );

      await framework.submitDecision(
        request.id,
        "human-2",
        "manager",
        "reject",
        { reason: "unsafe" }
      );

      const updated = await framework.getRequest(request.id);
      expect(updated?.status).toBe("rejected");
    });
  });

  describe("Resilience & Timeouts", () => {
    it("should ESCALATE expired requests via Polling", async () => {
      // Register short timeout gate for testing
      framework.registerGate({
        id: "gate:fast",
        action: "system:fast_action",
        riskLevel: "low",
        requiredApprovers: 1,
        approverRoles: ["manager"],
        timeoutSeconds: 1, // 1 second timeout
        escalationPath: ["director"],
        enabled: true,
      });

      const request = await framework.requestApproval(
        agent,
        "system:fast_action",
        { description: "Fast", impact: "Low", reversible: true },
        { preview: {}, affectedRecords: 1 }
      );

      // Advance by 5 seconds
      vi.advanceTimersByTime(5000);

      // Allow async interval to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      const updated = await framework.getRequest(request.id);
      // It should be escalated or expired
      expect(["escalated", "expired"]).toContain(updated?.status);
    }, 30000); // 30s timeout
  });
});
