import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArtifactGeneratorService } from "../../export/ArtifactGeneratorService.js";
import { createMockSupabase, factories } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, XSS_PAYLOADS } from "../fixtures/securityFixtures.js";

describe("ArtifactGeneratorService", () => {
  let service: ArtifactGeneratorService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new ArtifactGeneratorService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  describe("Security & Validation", () => {
    it("should sanitize XSS in generated content", async () => {
      const xssPayload = XSS_PAYLOADS[0];
      const scenario = factories.scenario({
        evf_decomposition_json: {
          revenue_uplift: 100000,
          cost_reduction: 50000,
          risk_mitigation: 25000,
          efficiency_gain: 10000,
        },
      });

      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        artifactType: "executive_memo" as const,
        scenarioId: "scenario-1",
        readinessScore: 0.85,
        dealContext: {
          account_name: xssPayload,
          industry: "Tech",
          stakeholders: [],
        },
        scenario,
        assumptions: [],
        topValueDrivers: [],
      };

      const result = await service.generateArtifact(input);
      const content = JSON.stringify(result.content);

      expect(content).not.toContain("<script>");
      expect(content).not.toContain("javascript:");
    });

    it("should reject SQL injection in caseId", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(
          service.generateArtifact({
            tenantId: "tenant-1",
            caseId: payload,
            artifactType: "executive_memo",
            scenarioId: "scenario-1",
            readinessScore: 0.8,
            scenario: factories.scenario(),
            assumptions: [],
            topValueDrivers: [],
          }),
        ).rejects.toThrow();
      }
    });

    it("should enforce tenant isolation on artifact persistence", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        artifactType: "executive_memo" as const,
        scenarioId: "scenario-1",
        readinessScore: 0.8,
        scenario: factories.scenario(),
        assumptions: [],
        topValueDrivers: [],
      };

      await service.generateArtifact(input);

      const persisted = mockSupabase._mockData.get("case_artifacts");
      const artifact = persisted?.[0] as Record<string, unknown>;
      expect(artifact?.tenant_id).toBe("tenant-1");
    });
  });

  describe("Readiness Score Status", () => {
    it("should mark as final when readiness >= 0.8", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        artifactType: "executive_memo" as const,
        scenarioId: "scenario-1",
        readinessScore: 0.85,
        scenario: factories.scenario(),
        assumptions: [],
        topValueDrivers: [],
      };

      const result = await service.generateArtifact(input);
      expect(result.status).toBe("final");
    });

    it("should mark as draft when readiness < 0.8", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        artifactType: "executive_memo" as const,
        scenarioId: "scenario-1",
        readinessScore: 0.6,
        scenario: factories.scenario(),
        assumptions: [],
        topValueDrivers: [],
      };

      const result = await service.generateArtifact(input);
      expect(result.status).toBe("draft");
    });
  });

  describe("Artifact Type Generation", () => {
    const artifactTypes = ["executive_memo", "cfo_recommendation", "customer_narrative", "internal_case"] as const;

    for (const artifactType of artifactTypes) {
      it(`should generate valid ${artifactType} content`, async () => {
        const input = {
          tenantId: "tenant-1",
          caseId: "case-1",
          artifactType,
          scenarioId: "scenario-1",
          readinessScore: 0.8,
          scenario: factories.scenario(),
          assumptions: [{ name: "Rate", value: 100, source_type: "confirmed", confidence_score: 0.9 }],
          topValueDrivers: [{ name: "Cost Savings", impact: "20%", confidence: 0.85 }],
        };

        const result = await service.generateArtifact(input);
        expect(result.artifactId).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.status).toBeDefined();
      });
    }
  });

  describe("Zod Validation", () => {
    it("should validate generated content against schema", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        artifactType: "executive_memo" as const,
        scenarioId: "scenario-1",
        readinessScore: 0.8,
        scenario: factories.scenario(),
        assumptions: [],
        topValueDrivers: [],
      };

      const result = await service.generateArtifact(input);
      const content = result.content as Record<string, unknown>;

      expect(content.title).toBeDefined();
      expect(content.summary).toBeDefined();
      expect(content.value_hypothesis).toBeDefined();
    });
  });
});
