/**
 * Verifies PII_TABLES covers all 7 agent output tables (F-011).
 * Reads the source file directly to assert table names are present —
 * this is intentionally a static analysis test so it catches regressions
 * without needing a live database.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  resolve(__dirname, "../dataSubjectRequests.ts"),
  "utf-8",
);

const REQUIRED_AGENT_TABLES = [
  "hypothesis_outputs",
  "integrity_outputs",
  "narrative_drafts",
  "realization_reports",
  "expansion_opportunities",
  "value_tree_nodes",
  "financial_model_snapshots",
];

describe("DSR PII_TABLES coverage (F-011)", () => {
  for (const table of REQUIRED_AGENT_TABLES) {
    it(`includes agent output table: ${table}`, () => {
      expect(SOURCE).toContain(`"${table}"`);
    });
  }

  it("all agent output tables use created_by as userColumn", () => {
    for (const table of REQUIRED_AGENT_TABLES) {
      // Each entry should appear near a created_by reference
      const idx = SOURCE.indexOf(`"${table}"`);
      const surrounding = SOURCE.slice(idx, idx + 80);
      expect(surrounding).toContain("created_by");
    }
  });
});
