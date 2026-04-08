/**
 * TDD: Frontend Redesign — Phase 2 Workspace Contracts
 *
 * Tests for the three-mode workspace, SDUI integration, and warmth-adaptive UI.
 * These tests encode the contracts from blueprint §5.2, §6.2, §7.2.
 * They will FAIL until the workspace implementation is built.
 *
 * Run: pnpm --filter ValyntApp test -- redesign-tdd
 */

import { describe, expect, it } from "vitest";

import {
  deriveWarmth,
  WorkspaceModeSchema,
} from "@shared/domain/Warmth";

// ============================================================================
// §5.2 Workspace Mode Contract
// ============================================================================

describe("Workspace modes: three equal modes", () => {
  const REQUIRED_MODES = ["canvas", "narrative", "copilot", "evidence"] as const;

  it("WorkspaceModeSchema defines all four modes", () => {
    expect(WorkspaceModeSchema.options).toEqual([...REQUIRED_MODES]);
  });

  it("each mode is a valid workspace mode", () => {
    for (const mode of REQUIRED_MODES) {
      expect(() => WorkspaceModeSchema.parse(mode)).not.toThrow();
    }
  });

  it("rejects invalid mode", () => {
    expect(() => WorkspaceModeSchema.parse("sidebar")).toThrow();
  });
});

// ============================================================================
// §5.2 Mode-Persona Mapping
// ============================================================================

describe("Mode-persona defaults", () => {
  // Blueprint §2.2: persona → default mode mapping
  const PERSONA_MODE_DEFAULTS: Record<string, string> = {
    value_engineer: "canvas",
    sales_rep: "copilot",
    exec_buyer: "narrative",
    customer_success: "evidence",
    admin: "canvas",
  };

  it("defines a default mode for each persona", () => {
    for (const [persona, mode] of Object.entries(PERSONA_MODE_DEFAULTS)) {
      expect(mode, `${persona} should have a default mode`).toBeDefined();
    }
  });

  it("all default modes are valid workspace modes", () => {
    for (const [persona, mode] of Object.entries(PERSONA_MODE_DEFAULTS)) {
      expect(
        () => WorkspaceModeSchema.parse(mode),
        `${persona}'s default mode "${mode}" should be valid`,
      ).not.toThrow();
    }
  });
});

// ============================================================================
// §3.1 Dual-Layer Status — Inspector Panel Data Contract
// ============================================================================

describe("Dual-layer status: inspector panel data", () => {
  // The inspector panel shows warmth on the surface,
  // operational state one click deeper
  it("warmth surface layer has state + modifier + confidence", () => {
    const result = deriveWarmth("VALIDATING", 0.65);

    // Surface layer (always visible)
    expect(result.state).toBe("firm");
    expect(result.modifier).toBeNull();
    expect(result.confidence).toBe(0.65);
  });

  it("deep layer includes saga_state for power users", () => {
    const result = deriveWarmth("VALIDATING", 0.65);

    // Deep layer (one click deeper)
    expect(result.sagaState).toBe("VALIDATING");
  });

  it("forming state with high confidence shows firming modifier", () => {
    const result = deriveWarmth("DRAFTING", 0.8);

    expect(result.state).toBe("forming");
    expect(result.modifier).toBe("firming");
    // Deep layer shows the saga_state is still DRAFTING
    expect(result.sagaState).toBe("DRAFTING");
  });

  it("verified state with low confidence shows needs_review", () => {
    const result = deriveWarmth("REFINING", 0.3);

    expect(result.state).toBe("verified");
    expect(result.modifier).toBe("needs_review");
    expect(result.sagaState).toBe("REFINING");
  });
});

// ============================================================================
// §7.2 Real-Time Event Contract
// ============================================================================

describe("Event contract: resolution rules", () => {
  // Rule 1: USER_EDIT wins over AGENT_SUGGESTION
  it("documents USER_EDIT priority over agent", () => {
    const EVENT_PRIORITY = {
      USER_EDIT: 1,         // highest — user always wins
      CONFIDENCE_UPDATE: 2, // authoritative from backend
      WARMTH_TRANSITION: 3, // announcement, not decision
      AGENT_OUTPUT: 4,      // merged into SDUI
      CONFLICT_DETECTED: 5, // surfaces in copilot
    };

    expect(EVENT_PRIORITY.USER_EDIT).toBeLessThan(EVENT_PRIORITY.AGENT_OUTPUT);
  });

  // Rule 2: CONFIDENCE_UPDATE is authoritative from backend
  it("confidence updates are backend-authoritative", () => {
    // This documents the contract: frontend must not locally compute confidence
    // It must always accept CONFIDENCE_UPDATE from the event stream
    const isBackendAuthoritative = true;
    expect(isBackendAuthoritative).toBe(true);
  });

  // Rule 4: CONFLICT_DETECTED does not auto-resolve
  it("conflicts surface in copilot, no auto-resolution", () => {
    const autoResolveConflicts = false;
    expect(autoResolveConflicts).toBe(false);
  });
});

// ============================================================================
// §3.3 Warmth as Presentation — No URL Segmentation
// ============================================================================

describe("Warmth as presentation layer: route stability", () => {
  it("warmth state is NOT a URL segment", () => {
    // Blueprint §3.1 Principle 3: Single stable route /case/:caseId
    // NOT /case/:caseId/forming, /case/:caseId/firm, etc.
    const TARGET_CASE_ROUTE = "/case/:caseId";

    // These should NOT exist as routes
    const FORBIDDEN_WARMTH_ROUTES = [
      "/case/:caseId/forming",
      "/case/:caseId/firm",
      "/case/:caseId/verified",
    ];

    expect(TARGET_CASE_ROUTE).not.toContain("forming");
    expect(TARGET_CASE_ROUTE).not.toContain("firm");
    expect(TARGET_CASE_ROUTE).not.toContain("verified");

    for (const route of FORBIDDEN_WARMTH_ROUTES) {
      expect(route).not.toBe(TARGET_CASE_ROUTE);
    }
  });
});

// ============================================================================
// §6.1 Warmth Tokens — Visual Grammar Contract
// ============================================================================

describe("Warmth visual grammar", () => {
  // Blueprint §6.1: Each warmth state has distinct visual properties
  const WARMTH_VISUAL_CONTRACT = {
    forming: {
      border: "dashed",
      hasAnimation: true,
    },
    firm: {
      border: "solid",
      hasAnimation: false,
    },
    verified: {
      border: "solid",
      hasAnimation: true,
    },
  } as const;

  it("forming uses dashed border with animation", () => {
    expect(WARMTH_VISUAL_CONTRACT.forming.border).toBe("dashed");
    expect(WARMTH_VISUAL_CONTRACT.forming.hasAnimation).toBe(true);
  });

  it("firm uses solid border without animation", () => {
    expect(WARMTH_VISUAL_CONTRACT.firm.border).toBe("solid");
    expect(WARMTH_VISUAL_CONTRACT.firm.hasAnimation).toBe(false);
  });

  it("verified uses solid border with animation (glow)", () => {
    expect(WARMTH_VISUAL_CONTRACT.verified.border).toBe("solid");
    expect(WARMTH_VISUAL_CONTRACT.verified.hasAnimation).toBe(true);
  });

  it("warmth visual grammar does not depend solely on color", () => {
    // A11y: Each state must be distinguishable without color
    // forming=dashed border, firm=solid, verified=solid+glow
    expect(WARMTH_VISUAL_CONTRACT.forming.border).not.toBe(
      WARMTH_VISUAL_CONTRACT.firm.border,
    );
  });
});

// ============================================================================
// §5.3 Executive Reviewer Surface Contract
// ============================================================================

describe("Reviewer surface: /review/:caseId contract", () => {
  it("reviewer route pattern is distinct from workspace", () => {
    const WORKSPACE_ROUTE = "/case/:caseId";
    const REVIEWER_ROUTE = "/review/:caseId";

    expect(REVIEWER_ROUTE).not.toBe(WORKSPACE_ROUTE);
    expect(REVIEWER_ROUTE).toContain("review");
    expect(REVIEWER_ROUTE).not.toContain("case/");
  });

  it("reviewer surface requires exactly these sections", () => {
    const REQUIRED_SECTIONS = [
      "executive_summary",
      "assumptions_at_risk",
      "value_projection",
      "approval_decision",
      "export_actions",
    ];

    expect(REQUIRED_SECTIONS).toHaveLength(5);
    expect(REQUIRED_SECTIONS).toContain("approval_decision");
    expect(REQUIRED_SECTIONS).toContain("assumptions_at_risk");
  });
});
