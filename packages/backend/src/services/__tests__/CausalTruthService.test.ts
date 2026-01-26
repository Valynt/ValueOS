/**
 * CausalTruthService Tests
 */

import { CausalTruthService } from "../CausalTruthService.js"

describe("CausalTruthService", () => {
  let service: CausalTruthService;

  beforeAll(async () => {
    service = new CausalTruthService();
    await service.initialize();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      expect(service).toBeDefined();
    });

    it("should load causal relationships", () => {
      const actions = service.getAvailableActions();
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContain("Cloud Infrastructure Migration");
    });
  });

  describe("getCausalImpact", () => {
    it("should find impact for known action-KPI pair", () => {
      const impact = service.getCausalImpact(
        "Cloud Infrastructure Migration",
        "IT Operational Efficiency"
      );

      expect(impact).toBeDefined();
      expect(impact?.action).toBe("Cloud Infrastructure Migration");
      expect(impact?.targetKpi).toBe("IT Operational Efficiency");
      expect(impact?.confidence).toBeGreaterThan(0);
      expect(impact?.evidence.length).toBeGreaterThan(0);
    });

    it("should return null for unknown action-KPI pair", () => {
      const impact = service.getCausalImpact("Unknown Action", "Unknown KPI");
      expect(impact).toBeNull();
    });
  });

  describe("search", () => {
    it("should find impacts by action", () => {
      const impacts = service.search({ action: "Cloud Infrastructure Migration" });
      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts[0].action).toContain("Cloud Infrastructure Migration");
    });

    it("should find impacts by KPI", () => {
      const impacts = service.search({ kpi: "Efficiency" });
      expect(impacts.length).toBeGreaterThan(0);
    });

    it("should filter by minimum confidence", () => {
      const allImpacts = service.search({ action: "Cloud Infrastructure Migration" });
      const highConfidenceImpacts = service.search({
        action: "Cloud Infrastructure Migration",
        minConfidence: 0.8,
      });

      expect(highConfidenceImpacts.length).toBeLessThanOrEqual(allImpacts.length);
      highConfidenceImpacts.forEach((impact) => {
        expect(impact.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe("getEvidenceSources", () => {
    it("should return evidence sources for valid pair", () => {
      const evidence = service.getEvidenceSources(
        "Cloud Infrastructure Migration",
        "IT Operational Efficiency"
      );
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence[0].source_name).toBeDefined();
      expect(evidence[0].tier).toBeDefined();
    });

    it("should return empty array for invalid pair", () => {
      const evidence = service.getEvidenceSources("Unknown Action", "Unknown KPI");
      expect(evidence).toEqual([]);
    });
  });

  describe("getCascadingEffects", () => {
    it("should return cascading effects when available", () => {
      const effects = service.getCascadingEffects(
        "Cloud Infrastructure Migration",
        "IT Operational Efficiency"
      );
      expect(effects.length).toBeGreaterThan(0);
      expect(effects[0].downstream_kpi).toBe("Operating Margin");
    });

    it("should return empty array when no cascading effects", () => {
      const effects = service.getCascadingEffects("Unknown Action", "Unknown KPI");
      expect(effects).toEqual([]);
    });
  });
});
