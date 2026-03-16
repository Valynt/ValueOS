/**
 * Verifies DSR PII assets are sourced from canonical inventory metadata (F-011).
 */
import { describe, expect, it } from "vitest";

import {
  getDsrMappedPiiAssets,
  getUnmappedPiiAssets,
} from "../../observability/dataAssetInventoryRegistry.js";

const REQUIRED_AGENT_TABLES = [
  "hypothesis_outputs",
  "integrity_outputs",
  "narrative_drafts",
  "realization_reports",
  "expansion_opportunities",
  "value_tree_nodes",
  "financial_model_snapshots",
] as const;

describe("DSR PII registry coverage (F-011)", () => {
  it("has no unmapped PII assets", () => {
    expect(getUnmappedPiiAssets()).toEqual([]);
  });

  it("contains all required agent output tables with created_by mapping", () => {
    const mapped = getDsrMappedPiiAssets();

    for (const table of REQUIRED_AGENT_TABLES) {
      const entry = mapped.find((asset) => asset.asset === table);
      expect(entry).toBeDefined();
      expect(entry?.dsr.userColumn).toBe("created_by");
      expect(entry?.dsr.exportable).toBe(true);
      expect(entry?.dsr.erasure).toBe("delete");
    }
  });
});
