export type AgentState = "idle" | "planning" | "executing" | "waiting" | "completed" | "error";

export interface AgentContext {
  sessionId: string;
  userId: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentInput {
  type: "text" | "action" | "approval";
  content: string;
  context?: AgentContext;
}

export interface AgentOutput {
  type: "message" | "action" | "request" | "result";
  content: string;
  metadata?: {
    confidence?: number;
    sources?: string[];
    nextActions?: string[];
  };
}

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  capabilities?: string[];
}

export interface AgentEvent {
  type: "state_change" | "message" | "error" | "action";
  timestamp: string;
  data: unknown;
}
