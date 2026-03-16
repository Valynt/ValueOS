export type AgentStatus = "idle" | "running" | "error" | "complete";
export interface AgentMessage { role: "user" | "assistant"; content: string; }
export interface AgentContext { sessionId: string; organizationId: string; }
