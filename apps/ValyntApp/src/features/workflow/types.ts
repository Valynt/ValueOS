export type WorkflowStatus = "draft" | "active" | "paused" | "completed" | "failed";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: "action" | "condition" | "delay" | "human" | "agent";
  status: StepStatus;
  config: Record<string, unknown>;
  order: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  currentStepId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  startedAt: string;
  completedAt?: string;
  logs: WorkflowLog[];
}

export interface WorkflowLog {
  id: string;
  stepId: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

export interface WorkflowTrigger {
  type: "manual" | "schedule" | "event" | "webhook";
  config: Record<string, unknown>;
}
