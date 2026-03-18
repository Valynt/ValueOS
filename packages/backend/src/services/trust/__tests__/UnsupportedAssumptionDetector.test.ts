import { describe, it, expect } from "vitest";
import {
  detectUnsupportedAssumptions,
  createUnsupportedFlag,
  calculateUnsupportedPenalty,
  UnsupportedAssumptionDetector,
} from "../UnsupportedAssumptionDetector";
import type { Assumption, Evidence } from "../../lib/validation/SourceClassification.js";
import { SourceTier } from "../../lib/validation/SourceClassification.js";

describe("UnsupportedAssumptionDetector", () => {
  const baseDate = new Date("2024-03-15");

  const createAssumption = (
    id: string,
    content: string,
    caseId: string = "case-1"
  ): Assumption => ({
    id,
    caseId,
    content,
    sourceTag: "tier_3_web",
    createdAt: baseDate,
    updatedAt: baseDate,
  });

  const createEvidence = (
    id: string,
    assumptionId: string
  ): Evidence => ({
    id,
    assumptionId,
    sourceTier: "tier_2_benchmark" as SourceTier,
    freshnessDate: baseDate,
    reliabilityScore: 0.8,
    transparencyLevel: "transparent",
    validationStatus: "validated",
    createdAt: baseDate,
  });

  describe("detection logic", () => {
    it("should flag assumption with no evidence and no benchmark", () => {
      const assumptions = [createAssumption("a1", "Test assumption")];
      const evidence: Evidence[] = [];
      const benchmarkRefs = new Map<string, boolean>();

      const result = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      expect(result.unsupportedCount).toBe(1);
      expect(result.unsupportedAssumptions[0].reason).toBe(
        "no_evidence_no_benchmark"
      );
    });

    it("should not flag assumption with evidence", () => {
      const assumptions = [createAssumption("a1", "Test assumption")];
      const evidence = [createEvidence("e1", "a1")];
      const benchmarkRefs = new Map<string, boolean>();

      const result = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      expect(result.unsupportedCount).toBe(0);
    });

    it("should not flag assumption with benchmark reference", () => {
      const assumptions = [createAssumption("a1", "Test assumption")];
      const evidence: Evidence[] = [];
      const benchmarkRefs = new Map<string, boolean>([["a1", true]]);

      const result = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      expect(result.unsupportedCount).toBe(0);
    });

    it("should handle mixed supported/unsupported assumptions", () => {
      const assumptions = [
        createAssumption("a1", "Supported with evidence"),
        createAssumption("a2", "Supported with benchmark"),
        createAssumption("a3", "Unsupported"),
        createAssumption("a4", "Also unsupported"),
      ];

      const evidence = [createEvidence("e1", "a1")];
      const benchmarkRefs = new Map<string, boolean>([["a2", true]]);

      const result = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      expect(result.totalAssumptions).toBe(4);
      expect(result.unsupportedCount).toBe(2);
      expect(result.supportedRatio).toBe(0.5);

      const unsupportedIds = result.unsupportedAssumptions.map(
        (u) => u.assumptionId
      );
      expect(unsupportedIds).toContain("a3");
      expect(unsupportedIds).toContain("a4");
    });
  });

  describe("register entries", () => {
    it("should create unsupported flag entry", () => {
      const assumption = createAssumption("a1", "Test");
      const entry = createUnsupportedFlag(assumption, "tenant-1", 0, false);

      expect(entry.supportStatus).toBe("unsupported");
      expect(entry.flaggedAt).toBeDefined();
      expect(entry.evidenceCount).toBe(0);
      expect(entry.hasBenchmarkReference).toBe(false);
    });

    it("should create supported entry with evidence", () => {
      const assumption = createAssumption("a1", "Test");
      const entry = createUnsupportedFlag(assumption, "tenant-1", 2, true);

      expect(entry.supportStatus).toBe("supported");
      expect(entry.flaggedAt).toBeUndefined();
      expect(entry.evidenceCount).toBe(2);
      expect(entry.hasBenchmarkReference).toBe(true);
    });

    it("should create partial entry with only benchmark", () => {
      const assumption = createAssumption("a1", "Test");
      const entry = createUnsupportedFlag(assumption, "tenant-1", 0, true);

      expect(entry.supportStatus).toBe("partial");
    });

    it("should create partial entry with only evidence", () => {
      const assumption = createAssumption("a1", "Test");
      const entry = createUnsupportedFlag(assumption, "tenant-1", 1, false);

      expect(entry.supportStatus).toBe("partial");
    });
  });

  describe("readiness penalty", () => {
    it("should calculate zero penalty when no unsupported assumptions", () => {
      const penalty = calculateUnsupportedPenalty(0, 10);
      expect(penalty).toBe(0);
    });

    it("should calculate penalty for 10% unsupported", () => {
      const penalty = calculateUnsupportedPenalty(1, 10);
      expect(penalty).toBe(0.1);
    });

    it("should calculate penalty for 30% unsupported", () => {
      const penalty = calculateUnsupportedPenalty(3, 10);
      expect(penalty).toBe(0.3);
    });

    it("should cap penalty at 0.3", () => {
      const penalty = calculateUnsupportedPenalty(5, 10); // 50%
      expect(penalty).toBe(0.3);
    });

    it("should handle zero total assumptions", () => {
      const penalty = calculateUnsupportedPenalty(0, 0);
      expect(penalty).toBe(0);
    });
  });

  describe("UnsupportedAssumptionDetector class", () => {
    const detector = new UnsupportedAssumptionDetector();

    it("should detect unsupported assumptions", () => {
      const assumptions = [
        createAssumption("a1", "With evidence"),
        createAssumption("a2", "Without evidence"),
      ];
      const evidence = [createEvidence("e1", "a1")];
      const benchmarkRefs = new Map<string, boolean>();

      const result = detector.detect(assumptions, evidence, benchmarkRefs);

      expect(result.unsupportedCount).toBe(1);
      expect(result.unsupportedAssumptions[0].assumptionId).toBe("a2");
    });

    it("should create register entries", () => {
      const assumptions = [createAssumption("a1", "Test")];
      const evidence: Evidence[] = [];
      const benchmarkRefs = new Map<string, boolean>();

      const entries = detector.createRegisterEntries(
        assumptions,
        "tenant-1",
        evidence,
        benchmarkRefs
      );

      expect(entries).toHaveLength(1);
      expect(entries[0].supportStatus).toBe("unsupported");
    });

    it("should calculate penalty", () => {
      const penalty = detector.calculatePenalty(2, 10);
      expect(penalty).toBe(0.2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty assumptions list", () => {
      const result = detectUnsupportedAssumptions([], [], new Map());

      expect(result.totalAssumptions).toBe(0);
      expect(result.unsupportedCount).toBe(0);
      expect(result.supportedRatio).toBe(1);
    });

    it("should handle multiple evidence for same assumption", () => {
      const assumptions = [createAssumption("a1", "Test")];
      const evidence = [
        createEvidence("e1", "a1"),
        createEvidence("e2", "a1"),
        createEvidence("e3", "a1"),
      ];
      const benchmarkRefs = new Map<string, boolean>();

      const result = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      expect(result.unsupportedCount).toBe(0);
    });
  });
});
