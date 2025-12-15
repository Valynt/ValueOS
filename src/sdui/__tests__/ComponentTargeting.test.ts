/**
 * Tests for ComponentTargeting
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ComponentTargeting } from "../ComponentTargeting";
import { SDUIPageDefinition } from "../schema";

describe("ComponentTargeting", () => {
  let targeting: ComponentTargeting;
  let testLayout: SDUIPageDefinition;

  beforeEach(() => {
    targeting = new ComponentTargeting();

    testLayout = {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "PageHeader",
          version: 1,
          props: {
            title: "Dashboard",
            subtitle: "Overview",
          },
        },
        {
          type: "component",
          component: "StatCard",
          version: 1,
          props: {
            title: "Revenue",
            value: 100000,
            trend: "up",
          },
        },
        {
          type: "component",
          component: "InteractiveChart",
          version: 1,
          props: {
            type: "line",
            title: "Monthly Revenue",
            data: [],
          },
        },
        {
          type: "component",
          component: "DataTable",
          version: 1,
          props: {
            title: "Transactions",
            columns: [],
            data: [],
          },
        },
      ],
      metadata: {
        experienceId: "test",
      },
    };
  });

  describe("findComponents", () => {
    it("should find components by type", () => {
      const matches = targeting.findComponents(testLayout, {
        type: "StatCard",
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].section.component).toBe("StatCard");
      expect(matches[0].confidence).toBe(0.8);
    });

    it("should find components by index", () => {
      const matches = targeting.findComponents(testLayout, { index: 2 });

      expect(matches).toHaveLength(1);
      expect(matches[0].section.component).toBe("InteractiveChart");
      expect(matches[0].index).toBe(2);
    });

    it("should find components by props", () => {
      const matches = targeting.findComponents(testLayout, {
        props: { title: "Revenue" },
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].section.component).toBe("StatCard");
    });

    it("should find components by description", () => {
      const matches = targeting.findComponents(testLayout, {
        description: "revenue chart",
      });

      expect(matches.length).toBeGreaterThan(0);
      // Should match InteractiveChart with "Monthly Revenue" title
      const chartMatch = matches.find(
        (m) => m.section.component === "InteractiveChart",
      );
      expect(chartMatch).toBeDefined();
    });

    it("should return empty array when no matches", () => {
      const matches = targeting.findComponents(testLayout, {
        type: "NonExistentComponent",
      });

      expect(matches).toHaveLength(0);
    });

    it("should sort matches by confidence", () => {
      const matches = targeting.findComponents(testLayout, {
        description: "revenue",
      });

      // Should have multiple matches, sorted by confidence
      if (matches.length > 1) {
        for (let i = 0; i < matches.length - 1; i++) {
          expect(matches[i].confidence).toBeGreaterThanOrEqual(
            matches[i + 1].confidence,
          );
        }
      }
    });
  });

  describe("findBestMatch", () => {
    it("should return highest confidence match", () => {
      const match = targeting.findBestMatch(testLayout, {
        type: "StatCard",
        props: { title: "Revenue" },
      });

      expect(match).toBeDefined();
      expect(match?.section.component).toBe("StatCard");
      expect(match?.confidence).toBeGreaterThan(0.7);
    });

    it("should return null when no matches", () => {
      const match = targeting.findBestMatch(testLayout, {
        type: "NonExistentComponent",
      });

      expect(match).toBeNull();
    });
  });

  describe("getComponentsByType", () => {
    it("should get all components of specific type", () => {
      // Add another StatCard
      testLayout.sections.push({
        type: "component",
        component: "StatCard",
        version: 1,
        props: {
          title: "Profit",
          value: 50000,
        },
      });

      const matches = targeting.getComponentsByType(testLayout, "StatCard");

      expect(matches).toHaveLength(2);
      expect(matches[0].section.component).toBe("StatCard");
      expect(matches[1].section.component).toBe("StatCard");
    });
  });

  describe("getComponentAtIndex", () => {
    it("should get component at specific index", () => {
      const match = targeting.getComponentAtIndex(testLayout, 1);

      expect(match).toBeDefined();
      expect(match?.section.component).toBe("StatCard");
      expect(match?.index).toBe(1);
      expect(match?.confidence).toBe(1.0);
    });

    it("should return null for invalid index", () => {
      expect(targeting.getComponentAtIndex(testLayout, -1)).toBeNull();
      expect(targeting.getComponentAtIndex(testLayout, 100)).toBeNull();
    });
  });

  describe("findComponentsByProp", () => {
    it("should find components by prop value", () => {
      const matches = targeting.findComponentsByProp(
        testLayout,
        "title",
        "Revenue",
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].section.component).toBe("StatCard");
    });

    it("should find components by nested prop", () => {
      testLayout.sections.push({
        type: "component",
        component: "Card",
        version: 1,
        props: {
          config: {
            theme: "dark",
          },
        },
      });

      const matches = targeting.findComponentsByProp(
        testLayout,
        "config.theme",
        "dark",
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].section.component).toBe("Card");
    });

    it("should return empty array when prop not found", () => {
      const matches = targeting.findComponentsByProp(
        testLayout,
        "nonexistent",
        "value",
      );

      expect(matches).toHaveLength(0);
    });
  });

  describe("generateSelector", () => {
    it('should generate selector from "first chart"', () => {
      const selector = targeting.generateSelector("first chart");

      expect(selector.type).toBe("InteractiveChart");
      expect(selector.index).toBe(0);
    });

    it('should generate selector from "revenue metric"', () => {
      const selector = targeting.generateSelector("revenue metric");

      expect(selector.type).toBe("StatCard");
      expect(selector.description).toBe("revenue metric");
    });

    it('should generate selector from "second table"', () => {
      const selector = targeting.generateSelector("second table");

      expect(selector.type).toBe("DataTable");
      expect(selector.index).toBe(1);
    });

    it("should handle numeric indices", () => {
      const selector = targeting.generateSelector("3rd card");

      expect(selector.index).toBe(2); // 0-based
    });
  });

  describe("explainMatch", () => {
    it("should explain match reason", () => {
      const match = targeting.findBestMatch(testLayout, { type: "StatCard" });

      if (match) {
        const explanation = targeting.explainMatch(match);

        expect(explanation).toContain("StatCard");
        expect(explanation).toContain("confidence");
        expect(explanation).toContain("%");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty layout", () => {
      const emptyLayout: SDUIPageDefinition = {
        type: "page",
        version: 1,
        sections: [],
        metadata: {},
      };

      const matches = targeting.findComponents(emptyLayout, {
        type: "StatCard",
      });

      expect(matches).toHaveLength(0);
    });

    it("should handle case-insensitive prop matching", () => {
      const matches = targeting.findComponents(testLayout, {
        props: { title: "revenue" }, // lowercase
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].section.props.title).toBe("Revenue");
    });

    it("should handle multiple criteria", () => {
      const match = targeting.findBestMatch(testLayout, {
        type: "StatCard",
        index: 1,
        props: { title: "Revenue" },
      });

      expect(match).toBeDefined();
      expect(match?.confidence).toBeGreaterThan(0.8);
    });

    it("should reject when required criteria not met", () => {
      const match = targeting.findBestMatch(testLayout, {
        type: "StatCard",
        index: 0, // Wrong index for StatCard
      });

      expect(match).toBeNull();
    });
  });

  describe("Component Aliases", () => {
    it("should match chart aliases", () => {
      const matches = targeting.findComponents(testLayout, {
        description: "graph showing revenue",
      });

      const chartMatch = matches.find(
        (m) => m.section.component === "InteractiveChart",
      );
      expect(chartMatch).toBeDefined();
    });

    it("should match metric aliases", () => {
      const matches = targeting.findComponents(testLayout, {
        description: "kpi card",
      });

      const statMatch = matches.find((m) => m.section.component === "StatCard");
      expect(statMatch).toBeDefined();
    });
  });

  describe("Confidence Scoring", () => {
    it("should give higher confidence for exact matches", () => {
      const exactMatch = targeting.findBestMatch(testLayout, {
        type: "StatCard",
        index: 1,
      });

      const fuzzyMatch = targeting.findBestMatch(testLayout, {
        description: "revenue",
      });

      expect(exactMatch?.confidence).toBeGreaterThan(
        fuzzyMatch?.confidence || 0,
      );
    });

    it("should normalize confidence based on criteria count", () => {
      const singleCriteria = targeting.findBestMatch(testLayout, {
        type: "StatCard",
      });

      const multiCriteria = targeting.findBestMatch(testLayout, {
        type: "StatCard",
        props: { title: "Revenue" },
      });

      // Both should have reasonable confidence
      expect(singleCriteria?.confidence).toBeGreaterThan(0.5);
      expect(multiCriteria?.confidence).toBeGreaterThan(0.5);
    });
  });
});
