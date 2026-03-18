/**
 * WorkflowStepPanel Component - Vertical stepper for 7-step workflow
 */

import { WorkflowStep, WorkflowStepState } from '../../types/workflow.types';

interface WorkflowStepPanelProps {
  steps: WorkflowStepState[];
  currentStep: WorkflowStep;
  onStepClick: (step: WorkflowStep) => void;
}

export function WorkflowStepPanel({ steps, currentStep, onStepClick }: WorkflowStepPanelProps) {
  return (
    <div className="p-4 border-b border-neutral-200">
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">Workflow Progress</h3>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <StepItem
            key={step.step}
            index={index + 1}
            step={step}
            isActive={step.step === currentStep}
            onClick={() => onStepClick(step.step)}
          />
        ))}
      </div>
    </div>
  );
}

interface StepItemProps {
  index: number;
  step: WorkflowStepState;
  isActive: boolean;
  onClick: () => void;
}

function StepItem({ index, step, isActive, onClick }: StepItemProps) {
  const { icon, color } = getStepStatusConfig(step.status, index);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full text-left p-2 rounded-md transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-neutral-50'
        }`}
    >
      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${color}`}>
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium text-neutral-900 capitalize">
          {index}. {step.step}
        </div>
        {step.blockingReason && (
          <div className="text-xs text-red-600">{step.blockingReason}</div>
        )}
      </div>
    </button>
  );
}

function getStepStatusConfig(status: WorkflowStepState['status'], index: number) {
  switch (status) {
    case 'complete':
      return { icon: '✓', color: 'bg-green-500 text-white' };
    case 'active':
      return { icon: '→', color: 'bg-blue-500 text-white' };
    case 'blocked':
      return { icon: '×', color: 'bg-red-500 text-white' };
    default:
      return { icon: index.toString(), color: 'bg-neutral-200 text-neutral-600' };
  }
}
