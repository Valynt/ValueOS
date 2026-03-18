/**
 * InlineMutationBar Component - State-gated action bar for node mutations
 */

import { useStateGating } from '../../hooks/useStateGating';
import { useWorkflowState } from '../../hooks/useWorkflowState';

interface InlineMutationBarProps {
  nodeId: string;
  onEdit: () => void;
  onScenario: () => void;
  onAskAgent: () => void;
  onLinkEvidence: () => void;
  onRedTeam: () => void;
  onRequestApproval: () => void;
}

export function InlineMutationBar({
  nodeId,
  onEdit,
  onScenario,
  onAskAgent,
  onLinkEvidence,
  onRedTeam,
  onRequestApproval,
}: InlineMutationBarProps) {
  const { canEdit, canRedTeam, canApprove, whyDisabled } = useStateGating();
  const { isStepComplete } = useWorkflowState();

  const buttonClass = (enabled: boolean) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${
      enabled
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
    }`;

  return (
    <div className="flex items-center gap-2 p-2 bg-white border-t border-neutral-200">
      <button
        onClick={onEdit}
        disabled={!canEdit}
        className={buttonClass(canEdit)}
        title={!canEdit ? whyDisabled : 'Edit node'}
      >
        Edit
      </button>

      <button
        onClick={onScenario}
        disabled={!canEdit}
        className={buttonClass(canEdit)}
        title={!canEdit ? whyDisabled : 'Run scenario'}
      >
        Scenario
      </button>

      <button
        onClick={onAskAgent}
        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
      >
        Ask Agent
      </button>

      <button
        onClick={onLinkEvidence}
        disabled={!canEdit}
        className={buttonClass(canEdit)}
        title={!canEdit ? whyDisabled : 'Link evidence'}
      >
        Link Evidence
      </button>

      <button
        onClick={onRedTeam}
        disabled={!canRedTeam}
        className={buttonClass(canRedTeam)}
        title={!canRedTeam ? whyDisabled : 'Red team review'}
      >
        Red Team
      </button>

      <div className="flex-1" />

      <button
        onClick={onRequestApproval}
        disabled={!canApprove}
        className={`px-4 py-1.5 text-sm font-medium rounded-md ${
          canApprove
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
        }`}
        title={!canApprove ? whyDisabled : 'Request approval'}
      >
        Request Approval
      </button>
    </div>
  );
}
