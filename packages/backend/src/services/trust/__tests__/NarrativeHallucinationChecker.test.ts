import { describe, it, expect } from "vitest";
import {
  parseFinancialFigures,
  crossReferenceFigures,
  checkHallucinations,
  NarrativeHallucinationChecker,
  type CalculatedFigure,
} from "../NarrativeHallucinationChecker";

describe("NarrativeHallucinationChecker", () => {
  describe("parseFinancialFigures", () => {
    it("should parse currency values", () => {
      const text = "Revenue increased by $1.2M this quarter";
      const figures = parseFinancialFigures(text);

      expect(figures).toHaveLength(1);
      expect(figures[0].raw).toBe("$1.2M");
      expect(figures[0].value).toBe(1200000);
      expect(figures[0].type).toBe("currency");
    });

    it("should parse K suffix", () => {
      const text = "Cost is $500K";
      const figures = parseFinancialFigures(text);

      expect(figures[0].value).toBe(500000);
    });

    it("should parse million text", () => {
      const text = "Valued at 10 million dollars";
      const figures = parseFinancialFigures(text);

      expect(figures[0].value).toBe(10);
    });

    it("should parse percentages", () => {
      const text = "Growth rate of 15% annually";
      const figures = parseFinancialFigures(text);

      expect(figures).toHaveLength(1);
      expect(figures[0].value).toBe(0.15);
      expect(figures[0].type).toBe("percentage");
    });

    it("should parse time periods", () => {
      const text = "Over 3 years and 12 months";
      const figures = parseFinancialFigures(text);

      expect(figures).toHaveLength(2);
      expect(figures[0].value).toBe(3);
      expect(figures[1].value).toBe(12);
    });

    it("should capture multiple figures", () => {
      const text = "Revenue $1M, up 20% over 2 years";
      const figures = parseFinancialFigures(text);

      expect(figures.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("crossReferenceFigures", () => {
    it("should pass when figures match", () => {
      const parsed = [
        { raw: "$1.0M", value: 1000000, location: { start: 0, end: 5 }, type: "currency" },
      ];
      const expected: CalculatedFigure[] = [
        { metric: "currency", value: 1000000, required: true },
      ];

      const hallucinations = crossReferenceFigures(parsed, expected);

      expect(hallucinations).toHaveLength(0);
    });

    it("should detect mismatch within 10%", () => {
      const parsed = [
        { raw: "$1.1M", value: 1100000, location: { start: 0, end: 5 }, type: "currency" },
      ];
      const expected: CalculatedFigure[] = [
        { metric: "currency", value: 1000000, required: true },
      ];

      const hallucinations = crossReferenceFigures(parsed, expected);

      expect(hallucinations).toHaveLength(1);
      expect(hallucinations[0].type).toBe("mismatch");
      expect(hallucinations[0].severity).toBe("major");
    });

    it("should detect fabricated figures", () => {
      const parsed = [
        { raw: "$5.0M", value: 5000000, location: { start: 0, end: 5 }, type: "currency" },
      ];
      const expected: CalculatedFigure[] = [
        { metric: "currency", value: 1000000, required: true },
      ];

      const hallucinations = crossReferenceFigures(parsed, expected);

      expect(hallucinations).toHaveLength(1);
      expect(hallucinations[0].type).toBe("fabricated");
      expect(hallucinations[0].severity).toBe("critical");
    });

    it("should detect missing required figures", () => {
      const parsed: ReturnType<typeof parseFinancialFigures> = [];
      const expected: CalculatedFigure[] = [
        { metric: "currency", value: 1000000, required: true },
      ];

      const hallucinations = crossReferenceFigures(parsed, expected);

      expect(hallucinations).toHaveLength(1);
      expect(hallucinations[0].type).toBe("missing");
      expect(hallucinations[0].severity).toBe("minor");
    });

    it("should not flag missing optional figures", () => {
      const parsed: ReturnType<typeof parseFinancialFigures> = [];
      const expected: CalculatedFigure[] = [
        { metric: "currency", value: 1000000, required: false },
      ];

      const hallucinations = crossReferenceFigures(parsed, expected);

      expect(hallucinations).toHaveLength(0);
    });
  });

  describe("checkHallucinations", () => {
    it("should pass with no hallucinations", () => {
      const result = checkHallucinations({
        narrativeId: "n1",
        text: "Revenue is $1.0M",
        expectedFigures: [
          { metric: "currency", value: 1000000, required: true },
        ],
      });

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("none");
      expect(result.hallucinations).toHaveLength(0);
    });

    it("should fail with critical hallucinations", () => {
      const result = checkHallucinations({
        narrativeId: "n1",
        text: "Revenue is $5.0M", // Fabricated
        expectedFigures: [
          { metric: "currency", value: 1000000, required: true },
        ],
      });

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("critical");
    });

    it("should fail with major hallucinations", () => {
      const result = checkHallucinations({
        narrativeId: "n1",
        text: "Revenue is $1.2M", // 20% mismatch
        expectedFigures: [
          { metric: "currency", value: 1000000, required: true },
        ],
      });

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("major");
    });

    it("should report minor for small mismatches", () => {
      const result = checkHallucinations({
        narrativeId: "n1",
        text: "Growth is 12%", // Small mismatch from 10%
        expectedFigures: [
          { metric: "percentage", value: 0.1, required: true },
        ],
      });

      expect(result.severity).toBe("minor");
    });
  });

  describe("NarrativeHallucinationChecker class", () => {
    const checker = new NarrativeHallucinationChecker();

    it("should check narrative", async () => {
      const result = await checker.check({
        narrativeId: "n1",
        text: "Revenue is $1.0M",
        expectedFigures: [
          { metric: "currency", value: 1000000, required: true },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it("should detect hallucinations", async () => {
      const result = await checker.check({
        narrativeId: "n1",
        text: "Revenue is $2.0M", // Mismatch
        expectedFigures: [
          { metric: "currency", value: 1000000, required: true },
        ],
      });

      expect(result.passed).toBe(false);
      expect(result.hallucinations.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty text", () => {
      const result = checkHallucinations({
        narrativeId: "n1",
        text: "",
        expectedFigures: [],
      });

      expect(result.passed).toBe(true);
      expect(result.hallucinations).toHaveLength(0);
    });

    it("should handle multiple figure types", () => {
      const result = checkHallucinations({
        narrativeId: "n1",
        text: "Revenue $1.0M grew 15% over 2 years",
        expectedFigures: [
          { metric: "currency", value: 1000000, required: true },
          { metric: "percentage", value: 0.15, required: true },
        ],
      });

      expect(result.passed).toBe(true);
    });

    it("should use location information", () => {
      const text = "First $1.0M then $2.0M";
      const figures = parseFinancialFigures(text);

      expect(figures[0].location.start).toBe(6);
      expect(figures[1].location.start).toBe(16);
    });
  });
});
