import { beforeEach, describe, expect, it } from "vitest";
import { CalculationEngine, CalculationUpdate } from "../CalculationEngine.js"
import { CanvasComponent } from "../types";

describe("CalculationEngine", () => {
  let engine: CalculationEngine;
  let components: CanvasComponent[];

  beforeEach(() => {
    engine = new CalculationEngine();
    components = [
      {
        id: "revenue-metric",
        type: "metric",
        props: { value: 100000, label: "Revenue" },
        position: { x: 0, y: 0 },
      },
      {
        id: "cost-metric",
        type: "metric",
        props: { value: 50000, label: "Cost" },
        position: { x: 100, y: 0 },
      },
      {
        id: "roi-metric",
        type: "metric",
        props: { value: 0, label: "ROI" },
        position: { x: 200, y: 0 },
      },
    ];
  });

  describe("registerDependency", () => {
    it("should register a dependency correctly", () => {
      const formula = (components: Map<string, CanvasComponent>) => {
        const revenue = components.get("revenue-metric")?.props.value || 0;
        const cost = components.get("cost-metric")?.props.value || 0;
        return ((revenue - cost) / cost) * 100;
      };

      engine.registerDependency("roi-metric", ["revenue-metric", "cost-metric"], formula);

      const dependents = engine.getDependents("revenue-metric");
      expect(dependents).toContain("roi-metric");
    });
  });

  describe("getDependents", () => {
    it("should return dependents for a component", () => {
      engine.registerDependency("roi-metric", ["revenue-metric", "cost-metric"], () => 0);

      const dependents = engine.getDependents("revenue-metric");
      expect(dependents).toEqual(["roi-metric"]);
    });

    it("should return empty array for component with no dependents", () => {
      const dependents = engine.getDependents("non-existent");
      expect(dependents).toEqual([]);
    });
  });

  describe("calculateCascade", () => {
    it("should calculate cascading updates", () => {
      const formula = (components: Map<string, CanvasComponent>) => {
        const revenue = components.get("revenue-metric")?.props.value || 0;
        const cost = components.get("cost-metric")?.props.value || 0;
        return ((revenue - cost) / cost) * 100;
      };

      engine.registerDependency("roi-metric", ["revenue-metric", "cost-metric"], formula);

      const updates = engine.calculateCascade("revenue-metric", components);

      expect(updates).toHaveLength(1);
      expect(updates[0].componentId).toBe("roi-metric");
      expect(updates[0].oldValue).toBe(0);
      expect(updates[0].newValue).toBe(100); // ((100000 - 50000) / 50000) * 100 = 100
    });

    it("should handle multiple levels of dependencies", () => {
      // Add another component that depends on roi-metric
      components.push({
        id: "profit-margin",
        type: "metric",
        props: { value: 0, label: "Profit Margin" },
        position: { x: 300, y: 0 },
      });

      const roiFormula = (components: Map<string, CanvasComponent>) => {
        const revenue = components.get("revenue-metric")?.props.value || 0;
        const cost = components.get("cost-metric")?.props.value || 0;
        return ((revenue - cost) / cost) * 100;
      };

      const marginFormula = (components: Map<string, CanvasComponent>) => {
        const roi = components.get("roi-metric")?.props.value || 0;
        return roi / 2; // Simplified
      };

      engine.registerDependency("roi-metric", ["revenue-metric", "cost-metric"], roiFormula);
      engine.registerDependency("profit-margin", ["roi-metric"], marginFormula);

      const updates = engine.calculateCascade("revenue-metric", components);

      expect(updates).toHaveLength(2);
      const roiUpdate = updates.find((u) => u.componentId === "roi-metric");
      const marginUpdate = updates.find((u) => u.componentId === "profit-margin");

      expect(roiUpdate?.newValue).toBe(100);
      expect(marginUpdate?.newValue).toBe(50);
    });

    it("should not update if value hasn't changed", () => {
      const formula = () => 100; // Always returns 100

      engine.registerDependency("roi-metric", ["revenue-metric"], formula);

      // Set initial value to 100
      components[2].props.value = 100;

      const updates = engine.calculateCascade("revenue-metric", components);

      expect(updates).toHaveLength(0);
    });

    it("should avoid infinite loops", () => {
      // Create circular dependency
      const formula1 = (components: Map<string, CanvasComponent>) => {
        const val2 = components.get("component2")?.props.value || 0;
        return val2 + 1;
      };

      const formula2 = (components: Map<string, CanvasComponent>) => {
        const val1 = components.get("component1")?.props.value || 0;
        return val1 + 1;
      };

      components.push(
        { id: "component1", type: "metric", props: { value: 1 }, position: { x: 0, y: 0 } },
        { id: "component2", type: "metric", props: { value: 1 }, position: { x: 0, y: 0 } }
      );

      engine.registerDependency("component1", ["component2"], formula1);
      engine.registerDependency("component2", ["component1"], formula2);

      const updates = engine.calculateCascade("component1", components);

      // Should not cause infinite loop, but may have some updates
      expect(updates.length).toBeLessThan(10); // Reasonable limit
    });
  });

  describe("getFormulaDescription", () => {
    it("should return description for component with dependencies", () => {
      engine.registerDependency("roi-metric", ["revenue-metric", "cost-metric"], () => 0);

      const description = engine.getFormulaDescription("roi-metric");
      expect(description).toBe("Depends on 2 components");
    });

    it("should return default description for component without dependencies", () => {
      const description = engine.getFormulaDescription("independent-component");
      expect(description).toBe("Calculated value");
    });
  });

  describe("setupDefaultDependencies", () => {
    it("should set up default ROI calculation", () => {
      engine.setupDefaultDependencies();

      const dependents = engine.getDependents("revenue-metric");
      expect(dependents).toContain("roi-metric");
    });
  });
});
