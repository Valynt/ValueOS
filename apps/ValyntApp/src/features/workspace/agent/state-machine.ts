/**
 * 7-State Agent UI Machine
 *
 * Maps agent cognitive states to UI phases with validated transitions.
 * Each state has a color, animation class, and set of allowed transitions.
 *
 * States: idle → clarify → plan → execute → review → finalize → resume
 * Error is an overlay state reachable from any active phase.
 */

import type { AgentPhase } from "./types";

// ─── Transition Events ───────────────────────────────────────────────

export type AgentTransitionEvent =
  | "START"              // idle → clarify | plan
  | "NEED_CLARIFICATION" // any → clarify
  | "CLARIFIED"          // clarify → plan
  | "PLAN_READY"         // clarify → plan, execute → plan (re-plan)
  | "PLAN_APPROVED"      // plan → execute
  | "PLAN_REJECTED"      // plan → idle
  | "EXECUTION_DONE"     // execute → review
  | "NEED_INPUT"         // execute → clarify
  | "APPROVED"           // review → finalize
  | "REVISION_NEEDED"    // review → plan
  | "FINALIZED"          // finalize → idle
  | "SESSION_RESTORED"   // resume → idle | clarify | plan | execute
  | "RESUME_SESSION"     // idle → resume
  | "ERROR"              // any → error (overlay)
  | "RETRY"              // error → previous phase
  | "RESET";             // any → idle

// ─── State Metadata ──────────────────────────────────────────────────

export interface AgentStateConfig {
  phase: AgentPhase;
  label: string;
  color: string;           // Tailwind bg class
  textColor: string;       // Tailwind text class
  borderColor: string;     // Tailwind border class
  animationClass: string;  // Tailwind animation class for the state indicator
  description: string;
}

export const AGENT_STATE_CONFIG: Record<AgentPhase, AgentStateConfig> = {
  idle: {
    phase: "idle",
    label: "Ready",
    color: "bg-primary/10",
    textColor: "text-primary",
    borderColor: "border-primary/20",
    animationClass: "animate-breathe",
    description: "Waiting for input",
  },
  clarify: {
    phase: "clarify",
    label: "Clarifying",
    color: "bg-warning/10",
    textColor: "text-warning-700",
    borderColor: "border-warning/30",
    animationClass: "animate-pulse-subtle",
    description: "Resolving ambiguity",
  },
  plan: {
    phase: "plan",
    label: "Planning",
    color: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    animationClass: "animate-card-reveal",
    description: "Showing execution plan",
  },
  execute: {
    phase: "execute",
    label: "Executing",
    color: "bg-success/10",
    textColor: "text-success-700",
    borderColor: "border-success/30",
    animationClass: "animate-scan-beam",
    description: "Processing actively",
  },
  review: {
    phase: "review",
    label: "Review",
    color: "bg-violet-50",
    textColor: "text-violet-700",
    borderColor: "border-violet-200",
    animationClass: "animate-fade-in",
    description: "Comparing results",
  },
  finalize: {
    phase: "finalize",
    label: "Complete",
    color: "bg-success/10",
    textColor: "text-success-700",
    borderColor: "border-success/30",
    animationClass: "animate-check-draw",
    description: "Persisting to fabric",
  },
  resume: {
    phase: "resume",
    label: "Restoring",
    color: "bg-cyan-50",
    textColor: "text-cyan-700",
    borderColor: "border-cyan-200",
    animationClass: "animate-context-restore",
    description: "Restoring context",
  },
};

// ─── Transition Table ────────────────────────────────────────────────

interface Transition {
  from: AgentPhase;
  event: AgentTransitionEvent;
  to: AgentPhase;
}

const TRANSITIONS: Transition[] = [
  // From idle
  { from: "idle", event: "START", to: "clarify" },
  { from: "idle", event: "PLAN_READY", to: "plan" },
  { from: "idle", event: "RESUME_SESSION", to: "resume" },

  // From clarify
  { from: "clarify", event: "CLARIFIED", to: "plan" },
  { from: "clarify", event: "PLAN_READY", to: "plan" },
  { from: "clarify", event: "RESET", to: "idle" },

  // From plan
  { from: "plan", event: "PLAN_APPROVED", to: "execute" },
  { from: "plan", event: "PLAN_REJECTED", to: "idle" },
  { from: "plan", event: "NEED_CLARIFICATION", to: "clarify" },
  { from: "plan", event: "RESET", to: "idle" },

  // From execute
  { from: "execute", event: "EXECUTION_DONE", to: "review" },
  { from: "execute", event: "NEED_INPUT", to: "clarify" },
  { from: "execute", event: "PLAN_READY", to: "plan" },
  { from: "execute", event: "RESET", to: "idle" },

  // From review
  { from: "review", event: "APPROVED", to: "finalize" },
  { from: "review", event: "REVISION_NEEDED", to: "plan" },
  { from: "review", event: "RESET", to: "idle" },

  // From finalize
  { from: "finalize", event: "FINALIZED", to: "idle" },
  { from: "finalize", event: "RESET", to: "idle" },

  // From resume
  { from: "resume", event: "SESSION_RESTORED", to: "idle" },
  { from: "resume", event: "CLARIFIED", to: "plan" },
  { from: "resume", event: "PLAN_READY", to: "plan" },
  { from: "resume", event: "PLAN_APPROVED", to: "execute" },
  { from: "resume", event: "RESET", to: "idle" },
];

// Build a lookup map for O(1) transition checks
const transitionMap = new Map<string, AgentPhase>();
for (const t of TRANSITIONS) {
  transitionMap.set(`${t.from}:${t.event}`, t.to);
}

// ─── Machine API ─────────────────────────────────────────────────────

export interface TransitionResult {
  success: boolean;
  from: AgentPhase;
  to: AgentPhase;
  event: AgentTransitionEvent;
}

/**
 * Check if a transition is valid from the given phase.
 */
export function canTransition(from: AgentPhase, event: AgentTransitionEvent): boolean {
  return transitionMap.has(`${from}:${event}`);
}

/**
 * Resolve the target phase for a transition. Returns null if invalid.
 */
export function resolveTransition(
  from: AgentPhase,
  event: AgentTransitionEvent
): AgentPhase | null {
  return transitionMap.get(`${from}:${event}`) ?? null;
}

/**
 * Get all valid events from a given phase.
 */
export function getValidEvents(from: AgentPhase): AgentTransitionEvent[] {
  const events: AgentTransitionEvent[] = [];
  for (const t of TRANSITIONS) {
    if (t.from === from) {
      events.push(t.event);
    }
  }
  return events;
}

/**
 * Get the state config for a phase.
 */
export function getStateConfig(phase: AgentPhase): AgentStateConfig {
  return AGENT_STATE_CONFIG[phase];
}

/**
 * All phases in order.
 */
export const PHASE_ORDER: AgentPhase[] = [
  "idle",
  "clarify",
  "plan",
  "execute",
  "review",
  "finalize",
  "resume",
];
