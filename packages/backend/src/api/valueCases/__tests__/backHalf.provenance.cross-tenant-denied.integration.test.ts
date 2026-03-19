import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantAwareRows = [
  { id: "prov-a", value_case_id: "case-123", claim_id: "claim-shared", organization_id: "tenant-a", data_source: "erp", evidence_tier: "gold", agent_id: "agent", agent_version: "1", confidence_score: 0.9, created_at: "2026-01-01T00:00:00.000Z" },
  { id: "prov-b", value_case_id: "case-123", claim_id: "claim-shared", organization_id: "tenant-b", data_source: "crm", evidence_tier: "silver", agent_id: "agent", agent_version: "1", confidence_score: 0.7, created_at: "2026-01-01T00:00:01.000Z" },
];

vi.mock("@valueos/memory/provenance", () => ({
  ProvenanceTracker: class {
    constructor(private store: { findByClaimId: (valueCaseId: string, claimId: string) => Promise<unknown[]> }) {}

    async getLineage(valueCaseId: string, claimId: string) {
      return this.store.findByClaimId(valueCaseId, claimId);
    }
  },
}));

vi.mock("../../../middleware/auth", () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("../../../middleware/tenantContext", () => ({
  tenantContextMiddleware: () => (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req["tenantId"] = "tenant-a";
    next();
  },
}));

vi.mock("../../../middleware/tenantDbContext", () => ({
  tenantDbContextMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../repositories/IntegrityResultRepository", () => ({ IntegrityResultRepository: vi.fn() }));
vi.mock("../../../repositories/NarrativeDraftRepository", () => ({ NarrativeDraftRepository: vi.fn() }));
vi.mock("../../../repositories/RealizationReportRepository", () => ({ RealizationReportRepository: vi.fn() }));
vi.mock("../../../repositories/ExpansionOpportunityRepository", () => ({ ExpansionOpportunityRepository: vi.fn() }));
vi.mock("../../../repositories/AgentExecutionLineageRepository", () => ({ agentExecutionLineageRepository: {} }));
vi.mock("../../../services/export/PdfExportService", () => ({ getPdfExportService: vi.fn() }));
vi.mock("../../../services/export/PptxExportService", () => ({ getPptxExportService: vi.fn() }));
vi.mock("../../../services/post-v1/ValueLifecycleOrchestrator", () => ({ ValueLifecycleOrchestrator: vi.fn() }));
vi.mock("../../../services/handoff/CheckpointScheduler", () => ({ checkpointScheduler: {} }));
vi.mock("../../../services/handoff/HandoffNotesGenerator", () => ({ handoffNotesGenerator: {} }));
vi.mock("../../../services/handoff/PromiseBaselineService", () => ({ promiseBaselineService: {} }));
vi.mock("../../../lib/agent-fabric/AgentFactory", () => ({ createAgentFactory: vi.fn() }));
vi.mock("../../../lib/agent-fabric/AuditLogger", () => ({ AuditLogger: vi.fn() }));
vi.mock("../../../lib/agent-fabric/CircuitBreaker", () => ({ CircuitBreaker: vi.fn() }));
vi.mock("../../../lib/agent-fabric/LLMGateway", () => ({ LLMGateway: vi.fn(), FabricLLMGateway: vi.fn() }));
vi.mock("../../../lib/agent-fabric/MemorySystem", () => ({ MemorySystem: vi.fn(), FabricMemorySystem: vi.fn() }));
vi.mock("../../../lib/agent-fabric/SupabaseMemoryBackend", () => ({ SupabaseMemoryBackend: vi.fn() }));
vi.mock("../../../lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("../../../middleware/rateLimiter", () => ({ rateLimiters: { strict: (_req: unknown, _res: unknown, next: () => void) => next() } }));

vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: (firstColumn: string, firstValue: string) => ({
          eq: (secondColumn: string, secondValue: string) => ({
            eq: (thirdColumn: string, thirdValue: string) => Promise.resolve({
              data: tenantAwareRows.filter(
                (row) =>
                  row[firstColumn as keyof (typeof tenantAwareRows)[number]] === firstValue &&
                  row[secondColumn as keyof (typeof tenantAwareRows)[number]] === secondValue &&
                  row[thirdColumn as keyof (typeof tenantAwareRows)[number]] === thirdValue
              ),
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

async function buildApp() {
  const { backHalfRouter } = await import("../backHalf.js");
  const app = express();
  app.use(express.json());
  app.use("/api/v1/cases", backHalfRouter);
  return app;
}

describe("backHalf provenance tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never returns a sibling tenant's provenance chain for the same claim id", async () => {
    const app = await buildApp();

    const response = await request(app)
      .get("/api/v1/cases/case-123/provenance/claim-shared")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.chains).toHaveLength(1);
    expect(response.body.data.chains[0].organization_id).toBe("tenant-a");
    expect(
      response.body.data.chains.every((row: { organization_id: string }) => row.organization_id === "tenant-a")
    ).toBe(true);
  });
});
