/**
 * Agent Workspace State Machine
 *
 * Defines the 7-state machine for agent interactions:
 *
 *   idle ──► plan ──► execute ──► review ──► finalize
 *    ▲        │         │          │           │
 *    │        ▼         ▼          ▼           │
 *    │      clarify   error ◄─── (any) ───────┘
 *    │        │         │
 *    └────────┴─────────┘
 *    └──── resume ──────┘
 *
 * Each transition has a named action and optional guard.
 */

import type { AgentPhase } from './types';

// Actions that trigger state transitions
export type AgentAction =
  | 'SEND_MESSAGE'
  | 'PLAN_PROPOSED'
  | 'PLAN_APPROVED'
  | 'PLAN_REJECTED'
  | 'CLARIFY_REQUESTED'
  | 'CLARIFY_ANSWERED'
  | 'EXECUTION_COMPLETE'
  | 'ARTIFACT_PROPOSED'
  | 'ARTIFACT_APPROVED'
  | 'ARTIFACT_REJECTED'
  | 'ALL_ARTIFACTS_REVIEWED'
  | 'FINALIZE_COMPLETE'
  | 'ERROR_OCCURRED'
  | 'ERROR_RECOVERED'
  | 'ERROR_DISMISSED'
  | 'SESSION_RESTORED'
  | 'RESUME_COMPLETE'
  | 'CANCEL'
  | 'RESET';

interface Transition {
  from: AgentPhase;
  to: AgentPhase;
  action: AgentAction;
  guard?: (context: TransitionContext) => boolean;
}

export interface TransitionContext {
  hasArtifacts: boolean;
  hasPendingArtifacts: boolean;
  hasCheckpoints: boolean;
  errorRecoverable: boolean;
  isStreaming: boolean;
}

// Valid transitions — the single source of truth for state flow
const TRANSITIONS: Transition[] = [
  // idle → plan: user sends a message, agent proposes a plan
  { from: 'idle', to: 'plan', action: 'PLAN_PROPOSED' },
  // idle → clarify: agent needs more info before planning
  { from: 'idle', to: 'clarify', action: 'CLARIFY_REQUESTED' },
  // idle → execute: direct execution (skip plan for simple queries)
  { from: 'idle', to: 'execute', action: 'SEND_MESSAGE' },

  // plan → execute: user approves the plan
  { from: 'plan', to: 'execute', action: 'PLAN_APPROVED' },
  // plan → idle: user rejects the plan
  { from: 'plan', to: 'idle', action: 'PLAN_REJECTED' },
  // plan → clarify: agent needs clarification on plan details
  { from: 'plan', to: 'clarify', action: 'CLARIFY_REQUESTED' },

  // clarify → plan: user answers, agent refines plan
  { from: 'clarify', to: 'plan', action: 'PLAN_PROPOSED' },
  // clarify → execute: user answers, agent proceeds directly
  { from: 'clarify', to: 'execute', action: 'CLARIFY_ANSWERED' },
  // clarify → idle: user cancels
  { from: 'clarify', to: 'idle', action: 'CANCEL' },

  // execute → review: execution complete, artifacts ready for review
  {
    from: 'execute', to: 'review', action: 'EXECUTION_COMPLETE',
    guard: (ctx) => ctx.hasArtifacts,
  },
  // execute → idle: execution complete, no artifacts to review
  {
    from: 'execute', to: 'idle', action: 'EXECUTION_COMPLETE',
    guard: (ctx) => !ctx.hasArtifacts,
  },
  // execute → clarify: agent needs more info mid-execution
  { from: 'execute', to: 'clarify', action: 'CLARIFY_REQUESTED' },

  // review → finalize: all artifacts approved
  {
    from: 'review', to: 'finalize', action: 'ALL_ARTIFACTS_REVIEWED',
    guard: (ctx) => !ctx.hasPendingArtifacts,
  },
  // review → execute: user rejects artifact, agent re-executes
  { from: 'review', to: 'execute', action: 'ARTIFACT_REJECTED' },
  // review → idle: user cancels review
  { from: 'review', to: 'idle', action: 'CANCEL' },

  // finalize → idle: finalization complete
  { from: 'finalize', to: 'idle', action: 'FINALIZE_COMPLETE' },

  // error → previous state: recoverable error resolved
  { from: 'error', to: 'idle', action: 'ERROR_DISMISSED' },
  { from: 'error', to: 'execute', action: 'ERROR_RECOVERED', guard: (ctx) => ctx.errorRecoverable },
  { from: 'error', to: 'idle', action: 'ERROR_RECOVERED', guard: (ctx) => !ctx.errorRecoverable },

  // resume → idle: session restored
  { from: 'resume', to: 'idle', action: 'RESUME_COMPLETE' },
  // resume → execute: resume mid-execution
  { from: 'resume', to: 'execute', action: 'SESSION_RESTORED' },

  // Any state → error (except error itself)
  { from: 'idle', to: 'error', action: 'ERROR_OCCURRED' },
  { from: 'plan', to: 'error', action: 'ERROR_OCCURRED' },
  { from: 'execute', to: 'error', action: 'ERROR_OCCURRED' },
  { from: 'clarify', to: 'error', action: 'ERROR_OCCURRED' },
  { from: 'review', to: 'error', action: 'ERROR_OCCURRED' },
  { from: 'finalize', to: 'error', action: 'ERROR_OCCURRED' },

  // Any state → idle via RESET
  { from: 'plan', to: 'idle', action: 'RESET' },
  { from: 'execute', to: 'idle', action: 'RESET' },
  { from: 'clarify', to: 'idle', action: 'RESET' },
  { from: 'review', to: 'idle', action: 'RESET' },
  { from: 'finalize', to: 'idle', action: 'RESET' },
  { from: 'error', to: 'idle', action: 'RESET' },
  { from: 'resume', to: 'idle', action: 'RESET' },
];

/**
 * Attempt a state transition. Returns the new phase if valid, null if not.
 */
export function transition(
  currentPhase: AgentPhase,
  action: AgentAction,
  context: TransitionContext
): AgentPhase | null {
  const candidates = TRANSITIONS.filter(
    (t) => t.from === currentPhase && t.action === action
  );

  if (candidates.length === 0) return null;

  // Find first transition whose guard passes (or has no guard)
  for (const t of candidates) {
    if (!t.guard || t.guard(context)) {
      return t.to;
    }
  }

  return null;
}

/**
 * Check if a transition is valid without executing it.
 */
export function canTransition(
  currentPhase: AgentPhase,
  action: AgentAction,
  context: TransitionContext
): boolean {
  return transition(currentPhase, action, context) !== null;
}

/**
 * Get all valid actions from the current phase.
 */
export function getValidActions(
  currentPhase: AgentPhase,
  context: TransitionContext
): AgentAction[] {
  const actions = new Set<AgentAction>();
  for (const t of TRANSITIONS) {
    if (t.from === currentPhase && (!t.guard || t.guard(context))) {
      actions.add(t.action);
    }
  }
  return Array.from(actions);
}

/**
 * Build a TransitionContext from the current agent state.
 */
export function buildTransitionContext(state: {
  artifacts: Record<string, { status: string }>;
  checkpoints: unknown[];
  error: { recoverable: boolean } | null;
  isStreaming: boolean;
}): TransitionContext {
  const artifactValues = Object.values(state.artifacts);
  return {
    hasArtifacts: artifactValues.length > 0,
    hasPendingArtifacts: artifactValues.some(
      (a) => a.status === 'proposed' || a.status === 'draft'
    ),
    hasCheckpoints: state.checkpoints.length > 0,
    errorRecoverable: state.error?.recoverable ?? false,
    isStreaming: state.isStreaming,
  };
}
