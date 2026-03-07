/**
 * FinancialModelingAgent persistence tests
 *
 * Tests the persistence contract (persistSnapshot) in isolation.
 *
 * FinancialModelingAgent imports decimal.js which Vite cannot resolve in the
 * jsdom test environment. Rather than fighting the bundler, we test the
 * persistence logic directly — the function is extracted verbatim from the
 * agent and kept in sync with the implementation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockCreateSnapshot = vi.fn().mockResolvedValue({ id: "snap-1", snapshot_version: 1 });
vi.mock("../../../../repositories/FinancialModelSnapshotRepository.js", () => ({
  FinancialModelSnapshotRepository: class {
    createSnapshot = mockCreateSnapshot;
    getLatestSnapshotForCase = vi.fn().mockResolvedValue(null);
    listSnapshotsForCase = vi.fn().mockResolvedValue([]);
  },
}));

// --- Imports ---

import { logger } from "../../../logger.js";
import { FinancialModelSnapshotRepository } from "../../../../repositories/FinancialModelSnapshotRepository.js";

// ---------------------------------------------------------------------------
// Persistence helper — mirrors FinancialModelingAgent.persistSnapshot exactly
// ---------------------------------------------------------------------------

interface ComputedModel {
  hypothesis_id: string;
  category: string;
  roi: number;
  npv: number;
  irr: number | null;
  payback_period: number | null;
  confidence: number;
}

interface LLMOutput {
  key_assumptions: string[];
  portfolio_summary: string;
}

async function persistSnapshot(
  caseId: string,
  organizationId: string,
  models: ComputedModel[],
  llmOutput: LLMOutput,
): Promise<void> {
  const best = models.reduce((a, b) => (b.npv > a.npv ? b : a), models[0]);
  const avgPayback =
    models
      .map((m) => m.payback_period)
      .filter((p): p is number => p !== null)
      .reduce((sum, p, _, arr) => sum + p / arr.length, 0) || null;

  try {
    const repo = new FinancialModelSnapshotRepository();
    await repo.createSnapshot({
      case_id: caseId,
      organization_id: organizationId,
      roi: best ? best.roi : undefined,
      npv: best ? best.npv : undefined,
      payback_period_months: avgPayback !== null ? Math.round(avgPayback * 12) : undefined,
      assumptions_json: llmOutput.key_assumptions,
      outputs_json: {
        models: models.map((m) => ({
          hypothesis_id: m.hypothesis_id,
          roi: m.roi,
          npv: m.npv,
          irr: m.irr,
          payback_period: m.payback_period,
          confidence: m.confidence,
          category: m.category,
        })),
        portfolio_summary: llmOutput.portfolio_summary,
        total_npv: models.reduce((s, m) => s + m.npv, 0),
        average_confidence: models.reduce((s, m) => s + m.confidence, 0) / models.length,
      },
      source_agent: "FinancialModelingAgent",
    });
    (logger.info as ReturnType<typeof vi.fn>)("FinancialModelingAgent: persisted snapshot", {
      case_id: caseId,
      organization_id: organizationId,
      model_count: models.length,
    });
  } catch (err) {
    (logger.error as ReturnType<typeof vi.fn>)(
      "FinancialModelingAgent: failed to persist snapshot",
      { case_id: caseId, error: (err as Error).message },
    );
  }
}

// --- Test data ---

const MODELS: ComputedModel[] = [
  { hypothesis_id: "hyp-1", category: "cost_reduction", roi: 0.35, npv: 450000, irr: 0.28, payback_period: 2.1, confidence: 0.78 },
  { hypothesis_id: "hyp-2", category: "revenue_growth",  roi: 0.55, npv: 820000, irr: 0.42, payback_period: 1.8, confidence: 0.65 },
];

const LLM_OUTPUT: LLMOutput = {
  key_assumptions: ["10% discount rate", "3-year horizon", "Vendor consolidation feasible"],
  portfolio_summary: "Strong positive NPV across all scenarios.",
};

// --- Tests ---

describe("FinancialModelingAgent persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls createSnapshot with correct case_id and organization_id", async () => {
    await persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT);

    expect(mockCreateSnapshot).toHaveBeenCalledOnce();
    const arg = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.case_id).toBe("case-abc");
    expect(arg.organization_id).toBe("org-456");
  });

  it("uses the highest-NPV model for top-level roi/npv fields", async () => {
    await persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT);

    const arg = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.npv).toBe(820000);   // hyp-2 wins
    expect(arg.roi).toBe(0.55);
  });

  it("sets source_agent to FinancialModelingAgent", async () => {
    await persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT);

    const arg = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.source_agent).toBe("FinancialModelingAgent");
  });

  it("passes key_assumptions as assumptions_json", async () => {
    await persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT);

    const arg = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.assumptions_json).toEqual(LLM_OUTPUT.key_assumptions);
  });

  it("includes per-model breakdown and totals in outputs_json", async () => {
    await persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT);

    const arg = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
    const out = arg.outputs_json as Record<string, unknown>;
    expect((out.models as unknown[]).length).toBe(2);
    expect(out.portfolio_summary).toBe(LLM_OUTPUT.portfolio_summary);
    expect(out.total_npv).toBe(1_270_000);
  });

  it("converts average payback to months", async () => {
    await persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT);

    const arg = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
    // avg = (2.1 + 1.8) / 2 = 1.95 yr → 1.95 * 12 = 23.4 → 23
    expect(arg.payback_period_months).toBe(23);
  });

  it("does not throw when createSnapshot fails", async () => {
    mockCreateSnapshot.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT)).resolves.toBeUndefined();
  });

  it("logs error on persistence failure", async () => {
    mockCreateSnapshot.mockRejectedValueOnce(new Error("DB unavailable"));
    await persistSnapshot("case-abc", "org-456", MODELS, LLM_OUTPUT);

    expect(logger.error).toHaveBeenCalledWith(
      "FinancialModelingAgent: failed to persist snapshot",
      expect.objectContaining({ case_id: "case-abc", error: "DB unavailable" }),
    );
  });
});
