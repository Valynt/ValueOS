/**
 * useWorkflowPermissions Hook
 *
 * Provides permission checks based on the current workflow state.
 * Reads from STATE_EXPERIENCE_MAP to ensure UI actions align with
 * the documented state → experience mapping.
 */

import { useAgentUXStore } from '@/lib/agent-ux-store';
import { STATE_EXPERIENCE_MAP, type WorkflowState } from '@/types/agent-ux';

export interface WorkflowPermissions {
  canEdit: boolean;
  canApprove: boolean;
  canRedTeam: boolean;
  canStart: boolean;
  canReset: boolean;
}

export function useWorkflowPermissions(): WorkflowPermissions {
  const { workflowState, isRunning, pendingCheckpoint } = useAgentUXStore();

  const experience = STATE_EXPERIENCE_MAP[workflowState];

  return {
    canEdit: experience.canEdit,
    canApprove: experience.canApprove && !!pendingCheckpoint,
    canRedTeam: experience.canRedTeam,
    canStart: !isRunning && workflowState === 'INITIATED',
    canReset: isRunning && workflowState !== 'FINALIZED',
  };
}

export function getStatePermissions(state: WorkflowState): Omit<WorkflowPermissions, 'canStart' | 'canReset'> {
  const experience = STATE_EXPERIENCE_MAP[state];
  return {
    canEdit: experience.canEdit,
    canApprove: experience.canApprove,
    canRedTeam: experience.canRedTeam,
  };
}
