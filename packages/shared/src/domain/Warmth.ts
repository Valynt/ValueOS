/**
 * Warmth — perceptual state layer for the ValueOS frontend
 *
 * Translates the technical saga lifecycle into a three-state mental model
 * that non-technical users can understand at a glance:
 *
 *   forming  → The case is taking shape. Evidence is being gathered.
 *   firm     → The case has strong evidence and validated assumptions.
 *   verified → The case is validated and ready for decision-making.
 *
 * Design rules:
 *   1. saga_state is ALWAYS authoritative for warmth derivation.
 *   2. confidence_score adds sub-state modifiers but NEVER overrides warmth.
 *   3. Backward saga transitions (INTEGRITY_VETOED, etc.) immediately
 *      change warmth — the UI must reflect the regression.
 *
 * Co-authored contract between frontend and backend teams.
 * Must stay in sync with packages/backend/src/lib/agents/core/ValueCaseSaga.ts.
 */

import { z } from "zod";

import { SagaStateEnumSchema } from "./ExperienceModel.js";
import type { SagaStateEnum } from "./ExperienceModel.js";

// ============================================================================
// Warmth States
// ============================================================================

export const WarmthStateSchema = z.enum(["forming", "firm", "verified"]);
export type WarmthState = z.infer<typeof WarmthStateSchema>;

export const WarmthModifierSchema = z.enum(["firming", "needs_review"]).nullable();
export type WarmthModifier = z.infer<typeof WarmthModifierSchema>;

// ============================================================================
// Workspace Modes
// ============================================================================

export const WorkspaceModeSchema = z.enum(["canvas", "narrative", "copilot", "evidence"]);
export type WorkspaceMode = z.infer<typeof WorkspaceModeSchema>;

// ============================================================================
// Derivation Result
// ============================================================================

export const DEFAULT_CONFIDENCE = 0.5;

export const WarmthResultSchema = z.object({
  state: WarmthStateSchema,
  modifier: WarmthModifierSchema,
  confidence: z.number().min(0).max(1),
  sagaState: SagaStateEnumSchema,
});
export type WarmthResult = z.infer<typeof WarmthResultSchema>;

// ============================================================================
// Saga → Warmth Mapping (canonical, authoritative)
// ============================================================================

export const SAGA_TO_WARMTH: Readonly<Record<SagaStateEnum, WarmthState>> = {
  INITIATED: "forming",
  DRAFTING: "forming",
  VALIDATING: "firm",
  COMPOSING: "firm",
  REFINING: "verified",
  FINALIZED: "verified",
} as const;

// ============================================================================
// Confidence Modifier Rules
// ============================================================================

export const CONFIDENCE_MODIFIERS = {
  /**
   * When saga_state is forming but confidence is unusually high,
   * show a "firming" sub-state indicator to communicate progress.
   */
  highConfidenceInForming: { threshold: 0.7, indicator: "firming" as const },

  /**
   * When saga_state is verified but confidence has dropped below threshold,
   * show a "needs_review" indicator to flag potential regression.
   */
  lowConfidenceInVerified: { threshold: 0.5, indicator: "needs_review" as const },
} as const;

// ============================================================================
// Derivation Function
// ============================================================================

/**
 * Derive the user-perceivable warmth state from backend saga state and confidence.
 *
 * Rules:
 *   1. saga_state determines base warmth (ALWAYS authoritative).
 *   2. confidence_score may add a modifier (NEVER overrides base warmth).
 *   3. If confidence_score is null/undefined, defaults to 0.5 (no modifier).
 *   4. If saga_state is unknown, defaults to "forming" (runtime safety).
 *   5. Returns a WarmthResult with state, modifier, and source data.
 */
export function deriveWarmth(
  sagaState: SagaStateEnum,
  confidenceScore?: number | null,
): WarmthResult {
  const resolvedConfidence = confidenceScore ?? DEFAULT_CONFIDENCE;

  const state: WarmthState =
    SAGA_TO_WARMTH[sagaState] ?? ("forming" as WarmthState);

  let modifier: WarmthModifier = null;

  if (
    state === "forming" &&
    resolvedConfidence >= CONFIDENCE_MODIFIERS.highConfidenceInForming.threshold
  ) {
    modifier = CONFIDENCE_MODIFIERS.highConfidenceInForming.indicator;
  }

  if (
    state === "verified" &&
    resolvedConfidence < CONFIDENCE_MODIFIERS.lowConfidenceInVerified.threshold
  ) {
    modifier = CONFIDENCE_MODIFIERS.lowConfidenceInVerified.indicator;
  }

  return {
    state,
    modifier,
    confidence: resolvedConfidence,
    sagaState,
  };
}
