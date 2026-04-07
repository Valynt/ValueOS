/**
 * OperationalStatePanel — Deep state disclosure panel
 *
 * Shows saga_state, agent status, blocking reasons, and confidence.
 *
 * Phase 2: Workspace Core
 */

interface OperationalState {
  sagaState: string;
  confidenceScore: number;
  blockingReasons: string[];
  lastAgentAction: string;
  agentStatus: "idle" | "working" | "needs_input" | "error";
}

interface OperationalStatePanelProps {
  state: OperationalState;
}

const statusLabels: Record<OperationalState["agentStatus"], string> = {
  idle: "idle",
  working: "working",
  needs_input: "needs input",
  error: "error",
};

const statusColors: Record<OperationalState["agentStatus"], string> = {
  idle: "text-green-600",
  working: "text-blue-600",
  needs_input: "text-amber-600",
  error: "text-red-600",
};

export function OperationalStatePanel({ state }: OperationalStatePanelProps): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      {/* Saga State */}
      <div className="mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Saga State
        </span>
        <div className="text-sm font-semibold text-gray-900">{state.sagaState}</div>
      </div>

      {/* Confidence Score */}
      <div className="mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Confidence
        </span>
        <div className="text-sm font-semibold text-gray-900">
          {(state.confidenceScore * 100).toFixed(1)}%
        </div>
      </div>

      {/* Agent Status */}
      <div className="mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Agent Status
        </span>
        <div className={`text-sm font-semibold ${statusColors[state.agentStatus]}`}>
          {statusLabels[state.agentStatus]}
        </div>
      </div>

      {/* Last Action */}
      <div className="mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Last Action
        </span>
        <div className="text-sm text-gray-700">{state.lastAgentAction}</div>
      </div>

      {/* Blocking Reasons */}
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Blocking Issues
        </span>
        {state.blockingReasons.length > 0 ? (
          <ul className="mt-1 list-disc pl-4">
            {state.blockingReasons.map((reason, index) => (
              <li key={index} className="text-sm text-red-600">
                {reason}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-green-600">No blocking issues</div>
        )}
      </div>
    </div>
  );
}

export default OperationalStatePanel;
