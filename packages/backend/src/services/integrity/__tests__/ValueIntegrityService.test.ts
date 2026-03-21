/**
 * ValueIntegrityService — unit tests
 *
 * Tests cover all four detection rules using the pure in-memory methods.
 * DB-dependent methods (recomputeScore, checkHardBlocks) are tested in
 * ValueIntegrityService.db.test.ts which properly hoists the Supabase mock.
 */

import { describe, expect, it } from "vitest";

import { ValueIntegrityService } from "../ValueIntegrityService.js";

const CASE_ID = "00000000-0000-0000-0000-000000000001";
const ORG_ID = "00000000-0000-0000-0000-000000000002";

const svc = new ValueIntegrityService();

// ---------------------------------------------------------------------------
// Rule 1: SCALAR_CONFLICT
// ---------------------------------------------------------------------------

describe("detectScalarConflicts", () => {
  it("returns no violations when agents agree on a metric", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "ARR", value: 10_000_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "ARR", value: 10_200_000, unit: "usd" }, // 2% diff — within threshold
    ];
    const result = svc.detectScalarConflicts(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("detects a critical violation when agents differ by more than 20%", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "ARR", value: 10_000_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "ARR", value: 5_000_000, unit: "usd" }, // 50% diff
    ];
    const result = svc.detectScalarConflicts(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("SCALAR_CONFLICT");
    expect(result[0]!.severity).toBe("critical");
    expect(result[0]!.agent_ids).toContain("AgentA");
    expect(result[0]!.agent_ids).toContain("AgentB");
    expect(result[0]!.case_id).toBe(CASE_ID);
    expect(result[0]!.organization_id).toBe(ORG_ID);
    expect(result[0]!.status).toBe("OPEN");
  });

  it("does not flag a conflict between the same agent", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "ARR", value: 10_000_000, unit: "usd" },
      { agent_id: "AgentA", metric_name: "ARR", value: 5_000_000, unit: "usd" },
    ];
    const result = svc.detectScalarConflicts(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("detects multiple conflicts across different metrics", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "ARR", value: 10_000_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "ARR", value: 3_000_000, unit: "usd" },
      { agent_id: "AgentA", metric_name: "Headcount", value: 500, unit: "count" },
      { agent_id: "AgentB", metric_name: "Headcount", value: 50, unit: "count" },
    ];
    const result = svc.detectScalarConflicts(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(2);
    expect(result.every((v) => v.type === "SCALAR_CONFLICT")).toBe(true);
  });

  it("skips rows with missing metric_name or value", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "", value: 10_000_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "ARR", value: null as unknown as number, unit: "usd" },
    ];
    const result = svc.detectScalarConflicts(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: FINANCIAL_SANITY
// ---------------------------------------------------------------------------

describe("detectFinancialSanity", () => {
  it("returns no violations for plausible financials", () => {
    const rows = [
      {
        agent_id: "FinancialModelingAgent",
        roi_multiplier: 3.5,
        payback_months: 18,
        value_low_usd: 1_000_000,
        value_high_usd: 3_000_000,
      },
    ];
    const result = svc.detectFinancialSanity(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("detects critical violation when ROI exceeds 10x", () => {
    const rows = [
      {
        agent_id: "FinancialModelingAgent",
        roi_multiplier: 15,
        payback_months: 12,
        value_low_usd: 1_000_000,
        value_high_usd: 2_000_000,
      },
    ];
    const result = svc.detectFinancialSanity(rows, CASE_ID, ORG_ID);
    const roiViolation = result.find((v) => v.description.includes("ROI"));
    expect(roiViolation).toBeDefined();
    expect(roiViolation!.type).toBe("FINANCIAL_SANITY");
    expect(roiViolation!.severity).toBe("critical");
  });

  it("detects critical violation when payback is less than 1 month", () => {
    const rows = [
      {
        agent_id: "FinancialModelingAgent",
        roi_multiplier: 3,
        payback_months: 0.5,
        value_low_usd: 1_000_000,
        value_high_usd: 2_000_000,
      },
    ];
    const result = svc.detectFinancialSanity(rows, CASE_ID, ORG_ID);
    const paybackViolation = result.find((v) => v.description.includes("Payback"));
    expect(paybackViolation).toBeDefined();
    expect(paybackViolation!.type).toBe("FINANCIAL_SANITY");
    expect(paybackViolation!.severity).toBe("critical");
  });

  it("detects warning when value range spread exceeds 5x", () => {
    const rows = [
      {
        agent_id: "FinancialModelingAgent",
        roi_multiplier: 3,
        payback_months: 12,
        value_low_usd: 1_000_000,
        value_high_usd: 6_000_000, // 6x spread
      },
    ];
    const result = svc.detectFinancialSanity(rows, CASE_ID, ORG_ID);
    const rangeViolation = result.find((v) => v.description.includes("range spread"));
    expect(rangeViolation).toBeDefined();
    expect(rangeViolation!.type).toBe("FINANCIAL_SANITY");
    expect(rangeViolation!.severity).toBe("warning");
  });

  it("does not flag range spread when value_low_usd is zero", () => {
    const rows = [
      {
        agent_id: "FinancialModelingAgent",
        roi_multiplier: 3,
        payback_months: 12,
        value_low_usd: 0,
        value_high_usd: 6_000_000,
      },
    ];
    const result = svc.detectFinancialSanity(rows, CASE_ID, ORG_ID);
    expect(result.filter((v) => v.description.includes("range spread"))).toHaveLength(0);
  });

  it("skips null financial fields", () => {
    const rows = [
      {
        agent_id: "FinancialModelingAgent",
        roi_multiplier: null,
        payback_months: null,
        value_low_usd: null,
        value_high_usd: null,
      },
    ];
    const result = svc.detectFinancialSanity(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("can produce multiple violations from a single agent output", () => {
    const rows = [
      {
        agent_id: "FinancialModelingAgent",
        roi_multiplier: 20,       // critical
        payback_months: 0.2,      // critical
        value_low_usd: 100_000,
        value_high_usd: 800_000,  // 8x spread — warning
      },
    ];
    const result = svc.detectFinancialSanity(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(3);
    expect(result.filter((v) => v.severity === "critical")).toHaveLength(2);
    expect(result.filter((v) => v.severity === "warning")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Rule 3: LOGIC_CHAIN_BREAK
// ---------------------------------------------------------------------------

describe("detectLogicChainBreaks", () => {
  it("returns no violations when conditions are consistent", () => {
    const rows = [
      { agent_id: "AgentA", implied_conditions: ["cost savings identified"] },
      { agent_id: "AgentB", implied_conditions: ["cost savings identified"] },
    ];
    const result = svc.detectLogicChainBreaks(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("detects a critical violation when one agent negates another's condition", () => {
    const rows = [
      { agent_id: "NarrativeAgent", implied_conditions: ["cost savings identified"] },
      { agent_id: "FinancialModelingAgent", implied_conditions: ["no cost savings identified"] },
    ];
    const result = svc.detectLogicChainBreaks(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("LOGIC_CHAIN_BREAK");
    expect(result[0]!.severity).toBe("critical");
    expect(result[0]!.agent_ids).toContain("NarrativeAgent");
    expect(result[0]!.agent_ids).toContain("FinancialModelingAgent");
  });

  it("handles 'not' prefix as negation", () => {
    const rows = [
      { agent_id: "AgentA", implied_conditions: ["automation feasible"] },
      { agent_id: "AgentB", implied_conditions: ["not automation feasible"] },
    ];
    const result = svc.detectLogicChainBreaks(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("LOGIC_CHAIN_BREAK");
  });

  it("does not flag a conflict when the same agent negates its own condition", () => {
    const rows = [
      {
        agent_id: "AgentA",
        implied_conditions: ["cost savings identified", "no cost savings identified"],
      },
    ];
    const result = svc.detectLogicChainBreaks(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("skips rows with null or missing implied_conditions", () => {
    const rows = [
      { agent_id: "AgentA", implied_conditions: null },
      { agent_id: "AgentB", implied_conditions: undefined },
    ];
    const result = svc.detectLogicChainBreaks(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: UNIT_MISMATCH
// ---------------------------------------------------------------------------

describe("detectUnitMismatches", () => {
  it("returns no violations when units match", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "Revenue", value: 1_000_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "Revenue", value: 1_200_000, unit: "usd" },
    ];
    const result = svc.detectUnitMismatches(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("detects critical violation on currency mismatch (USD vs GBP)", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "Revenue", value: 1_000_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "Revenue", value: 1_000_000, unit: "gbp" },
    ];
    const result = svc.detectUnitMismatches(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("UNIT_MISMATCH");
    expect(result[0]!.severity).toBe("critical");
    expect(result[0]!.description).toContain("USD");
    expect(result[0]!.description).toContain("GBP");
  });

  it("detects warning on magnitude mismatch (1000x difference, same unit)", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "Cost Savings", value: 5_000_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "Cost Savings", value: 5_000, unit: "usd" }, // 1000x diff
    ];
    const result = svc.detectUnitMismatches(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("UNIT_MISMATCH");
    expect(result[0]!.severity).toBe("warning");
    expect(result[0]!.description).toContain("scale mismatch");
  });

  it("does not flag magnitude difference below 1000x", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "Cost Savings", value: 500_000, unit: "usd" },
      { agent_id: "AgentB", metric_name: "Cost Savings", value: 1_000, unit: "usd" }, // 500x — below threshold
    ];
    const result = svc.detectUnitMismatches(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("does not flag same-agent unit differences", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "Revenue", value: 1_000_000, unit: "usd" },
      { agent_id: "AgentA", metric_name: "Revenue", value: 1_000_000, unit: "gbp" },
    ];
    const result = svc.detectUnitMismatches(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });

  it("skips rows with missing unit", () => {
    const rows = [
      { agent_id: "AgentA", metric_name: "Revenue", value: 1_000_000, unit: "" },
      { agent_id: "AgentB", metric_name: "Revenue", value: 1_000_000, unit: "gbp" },
    ];
    const result = svc.detectUnitMismatches(rows, CASE_ID, ORG_ID);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// NonDismissableViolationError
// ---------------------------------------------------------------------------

describe("NonDismissableViolationError", () => {
  it("is thrown when attempting to dismiss a SCALAR_CONFLICT critical violation", async () => {
    const { NonDismissableViolationError } = await import("../ValueIntegrityService.js");
    const err = new NonDismissableViolationError("SCALAR_CONFLICT");
    expect(err.name).toBe("NonDismissableViolationError");
    expect(err.violationType).toBe("SCALAR_CONFLICT");
    expect(err.message).toContain("SCALAR_CONFLICT");
  });
});


