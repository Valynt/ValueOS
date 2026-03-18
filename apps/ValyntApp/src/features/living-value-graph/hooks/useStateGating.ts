/**
 * useStateGating Hook - Access state-based permission rules
 */

import { useWorkflowStore } from '../store/workflow-store';

export function useStateGating() {
  const { phase, getGatingRules } = useWorkflowStore();
  const rules = getGatingRules();

  return {
    phase,
    rules,
    canEdit: rules.allowEdit,
    canRedTeam: rules.allowRedTeam,
    canApprove: rules.allowApproval,
    whyDisabled: rules.reason,
  };
}
