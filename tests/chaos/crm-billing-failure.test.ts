/**
 * Chaos: CRM / billing API failure.
 *
 * Success criteria:
 * - Integration error is isolated — core workflow is unaffected
 * - Error is logged with trace_id and organization_id
 * - Workflow completes with a degraded (not failed) status when CRM is non-critical
 * - Billing failure blocks execution when billing is a hard dependency
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal in-test stubs
// ---------------------------------------------------------------------------

interface WorkflowContext {
  workflowId: string;
  organizationId: string;
  traceId: string;
}

type WorkflowStatus = "completed" | "completed_degraded" | "failed";

interface WorkflowResult {
  status: WorkflowStatus;
  crmSynced: boolean;
  billingRecorded: boolean;
  errors: string[];
}

const auditLog: Array<{ event: string; traceId: string; organizationId: string }> = [];

const mockLogger = {
  error: vi.fn((msg: string, meta: Record<string, unknown>) => {
    auditLog.push({
      event: msg,
      traceId: meta["traceId"] as string,
      organizationId: meta["organizationId"] as string,
    });
  }),
  warn: vi.fn(),
  info: vi.fn(),
};

const mockCRMClient = {
  syncOpportunity: vi.fn<[WorkflowContext], Promise<void>>(),
};

const mockBillingClient = {
  recordUsage: vi.fn<[WorkflowContext], Promise<void>>(),
  checkQuota: vi.fn<[string], Promise<{ allowed: boolean; reason?: string }>>(),
};

// ---------------------------------------------------------------------------
// Workflow execution stub
// ---------------------------------------------------------------------------

async function executeWorkflow(ctx: WorkflowContext): Promise<WorkflowResult> {
  const errors: string[] = [];

  // Billing quota check is a hard dependency — blocks execution if it fails.
  try {
    const quota = await mockBillingClient.checkQuota(ctx.organizationId);
    if (!quota.allowed) {
      mockLogger.error("Billing quota exceeded — workflow blocked", {
        traceId: ctx.traceId,
        organizationId: ctx.organizationId,
        reason: quota.reason,
      });
      return { status: "failed", crmSynced: false, billingRecorded: false, errors: [quota.reason ?? "quota exceeded"] };
    }
  } catch (err) {
    mockLogger.error("Billing API unreachable", {
      traceId: ctx.traceId,
      organizationId: ctx.organizationId,
      error: (err as Error).message,
    });
    return { status: "failed", crmSynced: false, billingRecorded: false, errors: [(err as Error).message] };
  }

  // Core workflow logic (mocked as always succeeding here).
  // CRM sync is non-critical — failure is isolated.
  let crmSynced = false;
  try {
    await mockCRMClient.syncOpportunity(ctx);
    crmSynced = true;
  } catch (err) {
    mockLogger.error("CRM sync failed — continuing workflow", {
      traceId: ctx.traceId,
      organizationId: ctx.organizationId,
      error: (err as Error).message,
    });
    errors.push((err as Error).message);
  }

  // Billing usage recording is non-critical — failure is isolated.
  let billingRecorded = false;
  try {
    await mockBillingClient.recordUsage(ctx);
    billingRecorded = true;
  } catch (err) {
    mockLogger.error("Billing usage recording failed — continuing workflow", {
      traceId: ctx.traceId,
      organizationId: ctx.organizationId,
      error: (err as Error).message,
    });
    errors.push((err as Error).message);
  }

  const status: WorkflowStatus = errors.length > 0 ? "completed_degraded" : "completed";
  return { status, crmSynced, billingRecorded, errors };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Chaos: CRM / billing API failure", () => {
  const ctx: WorkflowContext = {
    workflowId: "opportunity-discovery-v1",
    organizationId: "org-chaos",
    traceId: "trace-crm-001",
  };

  beforeEach(() => {
    auditLog.length = 0;
    vi.clearAllMocks();
    // Default: billing quota allows execution.
    mockBillingClient.checkQuota.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CRM failure is isolated — core workflow completes", async () => {
    mockCRMClient.syncOpportunity.mockRejectedValue(new Error("CRM API timeout"));
    mockBillingClient.recordUsage.mockResolvedValue(undefined);

    const result = await executeWorkflow(ctx);

    expect(result.status).toBe("completed_degraded");
    expect(result.crmSynced).toBe(false);
    expect(result.billingRecorded).toBe(true);
  });

  it("billing usage recording failure is isolated — core workflow completes", async () => {
    mockCRMClient.syncOpportunity.mockResolvedValue(undefined);
    mockBillingClient.recordUsage.mockRejectedValue(new Error("billing API down"));

    const result = await executeWorkflow(ctx);

    expect(result.status).toBe("completed_degraded");
    expect(result.crmSynced).toBe(true);
    expect(result.billingRecorded).toBe(false);
  });

  it("billing quota failure blocks execution", async () => {
    mockBillingClient.checkQuota.mockResolvedValue({ allowed: false, reason: "monthly limit reached" });

    const result = await executeWorkflow(ctx);

    expect(result.status).toBe("failed");
    expect(result.errors).toContain("monthly limit reached");
  });

  it("billing API unreachable blocks execution", async () => {
    mockBillingClient.checkQuota.mockRejectedValue(new Error("billing service unreachable"));

    const result = await executeWorkflow(ctx);

    expect(result.status).toBe("failed");
  });

  it("error log contains trace_id and organization_id on CRM failure", async () => {
    mockCRMClient.syncOpportunity.mockRejectedValue(new Error("CRM API timeout"));
    mockBillingClient.recordUsage.mockResolvedValue(undefined);

    await executeWorkflow(ctx);

    const crmEntry = auditLog.find((e) => e.event.includes("CRM"));
    expect(crmEntry).toBeDefined();
    expect(crmEntry!.traceId).toBe(ctx.traceId);
    expect(crmEntry!.organizationId).toBe(ctx.organizationId);
  });

  it("both CRM and billing failures are isolated — workflow still completes degraded", async () => {
    mockCRMClient.syncOpportunity.mockRejectedValue(new Error("CRM API timeout"));
    mockBillingClient.recordUsage.mockRejectedValue(new Error("billing API down"));

    const result = await executeWorkflow(ctx);

    expect(result.status).toBe("completed_degraded");
    expect(result.errors).toHaveLength(2);
  });
});
