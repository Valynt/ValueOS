export type AgentStatus = "idle" | "thinking" | "executing" | "completed" | "error";
export type AgentConfidence = "high" | "medium" | "low";

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon?: string;
  status: AgentStatus;
  capabilities: string[];
}

export interface AgentMessage {
  id: string;
  agentId: string;
  type: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: AgentConfidence;
    sources?: string[];
    suggestions?: string[];
  };
}

export interface AgentSession {
  id: string;
  agentId: string;
  status: AgentStatus;
  messages: AgentMessage[];
  startedAt: string;
  completedAt?: string;
}

export interface AgentAction {
  id: string;
  type: "clarify" | "execute" | "suggest" | "complete";
  label: string;
  description?: string;
  requiresApproval?: boolean;
}

export interface AgentPlan {
  id: string;
  steps: AgentPlanStep[];
  currentStep: number;
  status: "pending" | "approved" | "executing" | "completed";
}

export interface AgentPlanStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  estimatedDuration?: number;
}
