export type BackendWorkflowState =
  | "initiated"
  | "running"
  | "waiting_approval"
  | "failed"
  | "completed"
  | "retrying"
  | "unavailable";

export type WorkflowViewState = BackendWorkflowState | "never_run";

export interface WorkflowStatusPresentation {
  label: string;
  iconClassName: string;
  confidenceClassName: string;
  ctaText: string;
  userMessage: string;
}

export const WORKFLOW_STATUS_PRESENTATION: Record<WorkflowViewState, WorkflowStatusPresentation> = {
  initiated: {
    label: "Initiated",
    iconClassName: "bg-blue-500",
    confidenceClassName: "bg-blue-500",
    ctaText: "Start Run",
    userMessage: "Workflow has been initiated and is preparing stage execution.",
  },
  running: {
    label: "Running",
    iconClassName: "bg-emerald-500",
    confidenceClassName: "bg-emerald-500",
    ctaText: "Monitor Run",
    userMessage: "Workflow is actively executing value-case stages.",
  },
  waiting_approval: {
    label: "Awaiting Approval",
    iconClassName: "bg-amber-500",
    confidenceClassName: "bg-amber-500",
    ctaText: "Review Approval",
    userMessage: "Execution is paused until an approver confirms the next step.",
  },
  failed: {
    label: "Failed",
    iconClassName: "bg-red-500",
    confidenceClassName: "bg-red-500",
    ctaText: "Retry Run",
    userMessage: "Execution failed. Review errors and retry when ready.",
  },
  completed: {
    label: "Completed",
    iconClassName: "bg-violet-500",
    confidenceClassName: "bg-violet-500",
    ctaText: "Run Again",
    userMessage: "Execution completed successfully across all stages.",
  },
  retrying: {
    label: "Retrying",
    iconClassName: "bg-orange-500",
    confidenceClassName: "bg-orange-500",
    ctaText: "View Retries",
    userMessage: "Execution is retrying after a recoverable issue.",
  },
  unavailable: {
    label: "Unavailable",
    iconClassName: "bg-zinc-400",
    confidenceClassName: "bg-zinc-400",
    ctaText: "Check Connectivity",
    userMessage: "Execution status is currently unavailable.",
  },
  never_run: {
    label: "Never Run",
    iconClassName: "bg-zinc-300",
    confidenceClassName: "bg-zinc-300",
    ctaText: "Start First Run",
    userMessage: "No workflow execution has run for this value case yet.",
  },
};

export function isBackendWorkflowState(value: unknown): value is BackendWorkflowState {
  return typeof value === "string" && value in WORKFLOW_STATUS_PRESENTATION && value !== "never_run";
}
