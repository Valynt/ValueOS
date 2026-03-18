/**
 * Workflow Store - Zustand store for workflow state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  GatingRules,
  INITIAL_WORKFLOW_STEPS,
  ValidationIssue,
  WorkflowState,
  WorkflowStep,
  WorkflowStepState,
} from '../types/workflow.types';
import { GATING_MATRIX } from '../utils/state-gating';

interface WorkflowStore {
  // Current orchestration phase
  phase: WorkflowState;

  // 7-step loop progress
  steps: WorkflowStepState[];
  currentStep: WorkflowStep;

  // Phase history for timeline
  phaseHistory: { state: WorkflowState; enteredAt: string; actor: string }[];

  // Actions
  initializeWorkflow: () => void;
  advancePhase: (to: WorkflowState, reason: string, actor?: string) => boolean;
  completeStep: (step: WorkflowStep) => void;
  blockStep: (step: WorkflowStep, reason: string) => void;
  unblockStep: (step: WorkflowStep) => void;
  getGatingRules: () => GatingRules;
  canTransitionTo: (to: WorkflowState) => boolean;

  // Validation
  blockingIssues: ValidationIssue[];
  setBlockingIssues: (issues: ValidationIssue[]) => void;
  clearBlockingIssues: () => void;
}

const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  INITIATED: ['DRAFTING'],
  DRAFTING: ['VALIDATING', 'INITIATED'],
  VALIDATING: ['COMPOSING', 'DRAFTING', 'REFINING'],
  COMPOSING: ['REFINING', 'VALIDATING'],
  REFINING: ['FINALIZED', 'VALIDATING', 'DRAFTING'],
  FINALIZED: ['REFINING'], // Override only
};

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
      phase: 'INITIATED',
      steps: INITIAL_WORKFLOW_STEPS,
      currentStep: 'hypothesis',
      phaseHistory: [{ state: 'INITIATED', enteredAt: new Date().toISOString(), actor: 'system' }],
      blockingIssues: [],

      initializeWorkflow: () => {
        set({
          phase: 'INITIATED',
          steps: INITIAL_WORKFLOW_STEPS,
          currentStep: 'hypothesis',
          phaseHistory: [{ state: 'INITIATED', enteredAt: new Date().toISOString(), actor: 'system' }],
          blockingIssues: [],
        });
      },

      advancePhase: (to, reason, actor = 'user') => {
        const current = get().phase;

        // Check if transition is valid
        if (!VALID_TRANSITIONS[current].includes(to)) {
          console.warn(`Invalid transition from ${current} to ${to}`);
          return false;
        }

        // Check for blocking issues when moving forward
        if (get().blockingIssues.some(i => i.severity === 'blocking')) {
          console.warn('Cannot advance: blocking issues exist');
          return false;
        }

        set({
          phase: to,
          phaseHistory: [
            ...get().phaseHistory,
            { state: to, enteredAt: new Date().toISOString(), actor },
          ],
        });

        return true;
      },

      completeStep: (step) => {
        const steps = get().steps.map((s) =>
          s.step === step
            ? { ...s, status: 'complete' as const, completedAt: new Date().toISOString() }
            : s
        );

        // Find next incomplete step
        const nextStep = steps.find((s) => s.status === 'not_started');
        const currentStep = steps.find((s) => s.status === 'active')?.step ||
          nextStep?.step ||
          get().currentStep;

        // Update current step to next if current is now complete
        if (get().currentStep === step && nextStep) {
          steps.forEach((s) => {
            if (s.step === nextStep.step) {
              s.status = 'active';
              s.startedAt = new Date().toISOString();
            }
          });
        }

        set({ steps, currentStep });
      },

      blockStep: (step, reason) => {
        const steps = get().steps.map((s) =>
          s.step === step ? { ...s, status: 'blocked' as const, blockingReason: reason } : s
        );
        set({ steps });
      },

      unblockStep: (step) => {
        const steps = get().steps.map((s) =>
          s.step === step
            ? { ...s, status: 'not_started' as const, blockingReason: undefined }
            : s
        );
        set({ steps });
      },

      getGatingRules: () => {
        return GATING_MATRIX[get().phase];
      },

      canTransitionTo: (to) => {
        return VALID_TRANSITIONS[get().phase].includes(to);
      },

      setBlockingIssues: (issues) => {
        set({ blockingIssues: issues });
      },

      clearBlockingIssues: () => {
        set({ blockingIssues: [] });
      },
    }),
    {
      name: 'workflow-store',
      partialize: (state) => ({
        phase: state.phase,
        steps: state.steps,
        currentStep: state.currentStep,
        phaseHistory: state.phaseHistory,
      }),
    }
  )
);
