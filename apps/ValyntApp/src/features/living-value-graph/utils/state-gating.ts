/**
 * State Gating Utilities - Workflow state-based action permissions
 */

import { GatingRules, WorkflowState } from '../types/workflow.types';

/**
 * Matrix defining which actions are allowed in each workflow state
 */
export const GATING_MATRIX: Record<WorkflowState, GatingRules> = {
  INITIATED: {
    allowEdit: true,
    allowRedTeam: false,
    allowApproval: false,
    reason: 'Complete hypothesis generation first',
  },
  DRAFTING: {
    allowEdit: true,
    allowRedTeam: true,
    allowApproval: false,
    reason: 'Validate model before approval',
  },
  VALIDATING: {
    allowEdit: true,
    allowRedTeam: true,
    allowApproval: true,
  },
  COMPOSING: {
    allowEdit: false,
    allowRedTeam: false,
    allowApproval: true,
    reason: 'Narrative generation in progress',
  },
  REFINING: {
    allowEdit: true,
    allowRedTeam: true,
    allowApproval: true,
  },
  FINALIZED: {
    allowEdit: false,
    allowRedTeam: false,
    allowApproval: false,
    reason: 'Version is locked. Request override to edit.',
  },
};

/**
 * Get gating rules for a specific workflow state
 */
export function getGatingRules(phase: WorkflowState): GatingRules {
  return GATING_MATRIX[phase];
}

/**
 * Check if editing is allowed in the given state
 */
export function canEdit(phase: WorkflowState): boolean {
  return GATING_MATRIX[phase].allowEdit;
}

/**
 * Check if red team actions are allowed in the given state
 */
export function canRedTeam(phase: WorkflowState): boolean {
  return GATING_MATRIX[phase].allowRedTeam;
}

/**
 * Check if approval is allowed in the given state
 */
export function canApprove(phase: WorkflowState): boolean {
  return GATING_MATRIX[phase].allowApproval;
}

/**
 * Get the reason why an action is disabled
 */
export function getDisabledReason(phase: WorkflowState): string | undefined {
  return GATING_MATRIX[phase].reason;
}

/**
 * Validate if a state transition is allowed
 */
export function isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
  const validTransitions: Record<WorkflowState, WorkflowState[]> = {
    INITIATED: ['DRAFTING'],
    DRAFTING: ['VALIDATING', 'INITIATED'],
    VALIDATING: ['COMPOSING', 'DRAFTING', 'REFINING'],
    COMPOSING: ['REFINING', 'VALIDATING'],
    REFINING: ['FINALIZED', 'VALIDATING', 'DRAFTING'],
    FINALIZED: ['REFINING'], // Override only
  };

  return validTransitions[from].includes(to);
}

/**
 * Get list of valid next states from current state
 */
export function getValidNextStates(from: WorkflowState): WorkflowState[] {
  const validTransitions: Record<WorkflowState, WorkflowState[]> = {
    INITIATED: ['DRAFTING'],
    DRAFTING: ['VALIDATING', 'INITIATED'],
    VALIDATING: ['COMPOSING', 'DRAFTING', 'REFINING'],
    COMPOSING: ['REFINING', 'VALIDATING'],
    REFINING: ['FINALIZED', 'VALIDATING', 'DRAFTING'],
    FINALIZED: ['REFINING'],
  };

  return validTransitions[from];
}
