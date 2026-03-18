/**
 * Agent fabric types — aligned with packages/backend/src/types/agent.ts.
 *
 * Frontend-only subset: omits server internals (PromptConfig, AgentConstraints)
 * that are not needed by UI consumers.
 */

export type LifecycleStage =
  | "opportunity"
  | "target"
  | "integrity"
  | "realization"
  | "expansion"
  | "narrative";

export type AgentType =
  | "opportunity"
  | "target"
  | "financial_modeling"
  | "integrity"
  | "realization"
  | "expansion"
  | "narrative"
  | "compliance_auditor";

export type AgentOutputStatus =
  | "success"
  | "partial_success"
  | "failure"
  | "timeout"
  | "cancelled";

export type ConfidenceLevel =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  lifecycle_stage: LifecycleStage;
  capabilities: string[];
  model: {
    provider: "openai" | "anthropic" | "gemini" | "custom";
    model_name: string;
    temperature?: number;
    max_tokens?: number;
  };
  parameters: {
    timeout_seconds: number;
    max_retries: number;
    retry_delay_ms: number;
    enable_caching: boolean;
    cache_ttl_seconds?: number;
    enable_telemetry: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface AgentError {
  code: string;
  message: string;
  severity: "error" | "warning";
  recoverable: boolean;
  context?: Record<string, unknown>;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd?: number;
}

export interface AgentOutputMetadata {
  execution_time_ms: number;
  token_usage?: TokenUsage;
  model_version: string;
  timestamp: string;
  correlation_id?: string;
  retry_count?: number;
}

export interface AgentOutput {
  agent_id: string;
  agent_type: AgentType;
  lifecycle_stage: LifecycleStage;
  status: AgentOutputStatus;
  result: Record<string, unknown>;
  confidence: ConfidenceLevel;
  reasoning?: string;
  suggested_next_actions?: string[];
  warnings?: string[];
  errors?: AgentError[];
  metadata: AgentOutputMetadata;
}

export interface SafetyLimits {
  maxTokensPerRequest: number;
  maxRequestsPerMinute: number;
  allowedModels: string[];
  costBudgetUsd: number;
}

// Domain types re-exported for convenience by apps/ValyntApp/src/types/vos.ts
export interface Agent { id: string; name: string; type: AgentType; status: string; }
export interface AgentSession { id: string; agentId: string; startedAt: string; endedAt?: string; }
export interface AgentMemory { sessionId: string; entries: Array<{ role: string; content: string }>; }
export interface Workflow { id: string; name: string; stages: string[]; status: string; }
export interface WorkflowExecution { id: string; workflowId: string; status: string; startedAt: string; }
export interface AuditLog { id: string; action: string; userId: string; timestamp: string; metadata?: Record<string, unknown>; }
export interface ValueCase { id: string; title: string; tenantId: string; status: string; }
export interface CompanyProfile { id: string; name: string; industry?: string; size?: string; }
export interface ValueMap { id: string; valueCaseId: string; nodes: unknown[]; }
export interface KPIHypothesis { id: string; metric: string; baseline: number; target: number; confidence: number; }
export interface FinancialModel { id: string; valueCaseId: string; totalValue: number; currency: string; }
export interface Assumption { id: string; description: string; validated: boolean; confidence: number; }


