import { describe, expect, it } from "vitest";

import { buildCompanyValueFabricModel, renderValueFabricForRetrieval } from "../ValueFabricBuilder.js";

describe("ValueFabricBuilder", () => {
  it("builds ontology nodes, relationships, and a value tree from extraction results", () => {
    const model = buildCompanyValueFabricModel({
      tenantId: "tenant-1",
      contextId: "context-1",
      website: "https://example.com",
      extractionResults: [
        {
          entityType: "product",
          success: true,
          items: [
            {
              payload: {
                name: "ValueOS Platform",
                description: "Enterprise value intelligence platform",
                product_type: "platform",
              },
              confidence_score: 0.9,
              source_urls: ["https://example.com/products"],
              source_page_url: "https://example.com/products",
            },
          ],
        },
        {
          entityType: "capability",
          success: true,
          items: [
            {
              payload: {
                capability: "Automated Value Modeling",
                operational_change: "Reduces manual business case prep time",
                economic_lever: "productivity",
              },
              confidence_score: 0.82,
              source_urls: ["https://example.com/platform"],
              source_page_url: "https://example.com/platform",
            },
          ],
        },
        {
          entityType: "persona",
          success: true,
          items: [
            {
              payload: {
                title: "CFO",
                persona_type: "decision_maker",
                pain_points: ["Inconsistent value narratives across accounts"],
              },
              confidence_score: 0.78,
              source_urls: ["https://example.com/solutions"],
              source_page_url: "https://example.com/solutions",
            },
          ],
        },
        {
          entityType: "claim",
          success: true,
          items: [
            {
              payload: {
                claim_text: "Improves win rate by aligning proof to buying committee priorities",
                category: "revenue",
                rationale: "Case studies show improved proposal quality and conversion",
                risk_level: "conditional",
              },
              confidence_score: 0.72,
              source_urls: ["https://example.com/customer-stories"],
              source_page_url: "https://example.com/customer-stories",
            },
          ],
        },
      ],
    });

    expect(model.context_id).toBe("context-1");
    expect(model.tenant_id).toBe("tenant-1");
    expect(model.nodes.some((n) => n.type === "product")).toBe(true);
    expect(model.nodes.some((n) => n.type === "capability")).toBe(true);
    expect(model.nodes.some((n) => n.type === "persona")).toBe(true);
    expect(model.nodes.some((n) => n.type === "pain")).toBe(true);
    expect(model.nodes.some((n) => n.type === "outcome")).toBe(true);
    expect(model.nodes.some((n) => n.type === "proof_point")).toBe(true);
    expect(model.relationships.length).toBeGreaterThan(0);
    expect(model.value_tree.roots.length).toBeGreaterThan(0);
    expect(model.value_tree.nodes.length).toBeGreaterThan(0);
  });

  it("renders a retrieval-friendly canonical semantic layer document", () => {
    const model = buildCompanyValueFabricModel({
      tenantId: "tenant-1",
      contextId: "context-1",
      extractionResults: [],
    });
    const rendered = renderValueFabricForRetrieval(model);
    expect(rendered).toContain("VALUE FABRIC (Canonical Semantic Layer)");
    expect(rendered).toContain("Context ID: context-1");
    expect(rendered).toContain("Products:");
    expect(rendered).toContain("Relationships:");
  });
});

