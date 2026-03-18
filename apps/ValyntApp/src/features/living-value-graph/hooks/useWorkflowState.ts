/**
 * useWorkflowState Hook - Access workflow state and actions
 */

import { useWorkflowStore } from '../store/workflow-store';
import {
  WorkflowState,
  WorkflowStep,
} from '../types/workflow.types';

export function useWorkflowState() {
  const {
    phase,
    steps,
    currentStep,
    phaseHistory,
    blockingIssues,
    advancePhase,
    completeStep,
    blockStep,
    unblockStep,
    getGatingRules,
    canTransitionTo,
    setBlockingIssues,
    clearBlockingIssues,
  } = useWorkflowStore();

  const isStepComplete = (step: WorkflowStep) =>
    steps.find((s) => s.step === step)?.status === 'complete';

  const isStepBlocked = (step: WorkflowStep) =>
    steps.find((s) => s.step === step)?.status === 'blocked';

  const isStepActive = (step: WorkflowStep) =>
    steps.find((s) => s.step === step)?.status === 'active';

  const getStepStatus = (step: WorkflowStep) =>
    steps.find((s) => s.step === step)?.status || 'not_started';

  const getBlockingReason = (step: WorkflowStep) =>
    steps.find((s) => s.step === step)?.blockingReason;

  return {
    // State
    phase,
    steps,
    currentStep,
    phaseHistory,
    blockingIssues,

    // Queries
    isStepComplete,
    isStepBlocked,
    isStepActive,
    getStepStatus,
    getBlockingReason,
    canTransitionTo,
    getGatingRules,

    // Actions
    advancePhase,
    completeStep,
    blockStep,
    unblockStep,
    setBlockingIssues,
    clearBlockingIssues,
  };
}
