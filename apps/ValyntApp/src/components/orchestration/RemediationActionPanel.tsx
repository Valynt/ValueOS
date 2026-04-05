import type { RemediationAction, RuntimeFailureDetails } from "@shared/domain/RuntimeFailureTaxonomy";

const ACTION_LABELS: Record<RemediationAction, string> = {
  retry: "Retry",
  "reroute-owner": "Reroute Owner",
  "provide-missing-artifact": "Provide Artifact",
  "request-override": "Request Override",
  "escalate-approval-inbox": "Escalate to Approval Inbox",
};

interface RemediationActionPanelProps {
  runtimeFailure: RuntimeFailureDetails;
  onRetry?: () => void;
  onOpenApprovalInbox?: () => void;
}

export function RemediationActionPanel({ runtimeFailure, onRetry, onOpenApprovalInbox }: RemediationActionPanelProps) {
  const runAction = (action: RemediationAction) => {
    if (action === "retry") {
      onRetry?.();
      return;
    }

    if (action === "escalate-approval-inbox") {
      onOpenApprovalInbox?.();
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-zinc-900">Remediation playbook</p>
        <p className="text-xs text-zinc-600">{runtimeFailure.playbookTitle} · Owner: {runtimeFailure.owner}</p>
        <p className="mt-1 text-xs text-zinc-500">{runtimeFailure.playbookGuidance}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {runtimeFailure.recommendedNextActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => runAction(action)}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </div>
  );
}
