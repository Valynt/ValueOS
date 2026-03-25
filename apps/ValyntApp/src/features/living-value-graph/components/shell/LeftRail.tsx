/**
 * LeftRail Component - Left sidebar with workflow steps and navigation
 */

import { useWorkflowState } from '../../hooks/useWorkflowState';
import { WorkflowStepPanel } from '../left-rail/WorkflowStepPanel';

export function LeftRail() {
  const { steps, currentStep, isStepBlocked, getBlockingReason, completeStep } = useWorkflowState();

  return (
    <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
      <WorkflowStepPanel
        steps={steps}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (isStepBlocked(step)) {
            // eslint-disable-next-line no-console
            console.log('Blocked:', getBlockingReason(step));
          }
        }}
      />
    </aside>
  );
}
