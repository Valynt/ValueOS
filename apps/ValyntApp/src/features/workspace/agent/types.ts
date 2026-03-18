/**
 * Agent workspace types — used by the agent workspace UI feature.
 */

export type AgentPhase =
  | "idle"
  | "clarify"
  | "plan"
  | "execute"
  | "review"
  | "finalize"
  | "error"
  | "resume";

export type ArtifactType = "draft" | "proposed" | "approved" | "rejected" | "superseded";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  status: ArtifactType;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ClarifyOption {
  id: string;
  label: string;
  description?: string;
  value: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PlanAssumption {
  id: string;
  description: string;
  confidence: number;
  validated: boolean;
}

export interface WorkflowStepState {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  progress?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}
