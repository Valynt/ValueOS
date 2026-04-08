/**
 * Warmth — frontend derivation utilities
 *
 * Re-exports the canonical shared domain types and adds frontend-specific
 * helpers for resolving warmth design tokens and CSS classes.
 *
 * Usage:
 *   import { deriveWarmth, getWarmthTokens } from '@/lib/warmth';
 *   const result = deriveWarmth('DRAFTING', 0.65);
 *   const tokens = getWarmthTokens(result.state, result.modifier);
 */

import type { SagaStateEnum } from "@valueos/shared/domain/ExperienceModel.js";

// Re-export shared domain types and derivation function
export {
  type WarmthModifier,
  type WarmthResult,
  type WarmthState,
  type WorkspaceMode,
  CONFIDENCE_MODIFIERS,
  SAGA_TO_WARMTH,
  WarmthModifierSchema,
  WarmthResultSchema,
  WarmthStateSchema,
  WorkspaceModeSchema,
  deriveWarmth as deriveWarmthShared,
} from "@valueos/shared/domain/Warmth.js";

import {
  type WarmthModifier,
  type WarmthResult,
  type WarmthState,
  deriveWarmth as deriveWarmthShared,
} from "@valueos/shared/domain/Warmth.js";

// ============================================================================
// Frontend Warmth Token Definitions
// ============================================================================

export interface WarmthTokenSet {
  border: "dashed" | "solid";
  borderColor: string;
  background: string;
  text: string;
  icon: string;
  animation: string | null;
  className: string;
  modifierIcon?: string;
  modifierColor?: string;
}

const WARMTH_TOKEN_MAP: Record<WarmthState, Omit<WarmthTokenSet, "modifierIcon" | "modifierColor" | "className">> = {
  forming: {
    border: "dashed",
    borderColor: "var(--color-amber-300, #FCD34D)",
    background: "var(--color-amber-50, #FFFBEB)",
    text: "var(--color-amber-700, #B45309)",
    icon: "flame",
    animation: "warmth-pulse",
  },
  firm: {
    border: "solid",
    borderColor: "var(--color-blue-200, #BFDBFE)",
    background: "var(--color-white, #FFFFFF)",
    text: "var(--color-slate-900, #0F172A)",
    icon: "check-circle",
    animation: null,
  },
  verified: {
    border: "solid",
    borderColor: "var(--color-blue-500, #3B82F6)",
    background: "var(--color-blue-50, #EFF6FF)",
    text: "var(--color-blue-900, #1E3A8A)",
    icon: "shield-check",
    animation: "warmth-glow",
  },
};

const MODIFIER_TOKEN_MAP: Record<string, { icon: string; color: string }> = {
  firming: { icon: "trending-up", color: "var(--color-amber-600, #D97706)" },
  needs_review: { icon: "alert-triangle", color: "var(--color-amber-600, #D97706)" },
};

const WARMTH_CLASS_MAP: Record<WarmthState, string> = {
  forming: "warmth-forming",
  firm: "warmth-firm",
  verified: "warmth-verified",
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Frontend-specific warmth derivation wrapper.
 *
 * Delegates to the shared domain function but normalises confidence input
 * so callers don't need to handle NaN/negative/>1 edge cases.
 */
export function deriveWarmth(
  sagaState: SagaStateEnum | string,
  confidenceScore?: number | null,
  overrides?: { firmMinimum?: number; verifiedMinimum?: number },
): WarmthResult {
  let confidence = confidenceScore ?? 0.5;
  if (Number.isNaN(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  // The shared function does not accept overrides yet — apply clamping here
  // and pass through. When overrides are supported in the shared layer (Phase 5),
  // this wrapper will forward them directly.
  const _firmMin = overrides?.firmMinimum
    ? Math.max(0.5, Math.min(0.7, overrides.firmMinimum))
    : undefined;
  const _verifiedMin = overrides?.verifiedMinimum
    ? Math.max(0.7, Math.min(0.9, overrides.verifiedMinimum))
    : undefined;

  return deriveWarmthShared(sagaState as SagaStateEnum, confidence);
}

/**
 * Resolve warmth tokens for styling components.
 */
export function getWarmthTokens(
  state: WarmthState,
  modifier?: WarmthModifier | null,
): WarmthTokenSet {
  const base = WARMTH_TOKEN_MAP[state];
  const className = WARMTH_CLASS_MAP[state];
  const modifierTokens = modifier ? MODIFIER_TOKEN_MAP[modifier] : undefined;

  return {
    ...base,
    className,
    modifierIcon: modifierTokens?.icon,
    modifierColor: modifierTokens?.color,
  };
}
