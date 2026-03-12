/**
 * Agent Output Types
 *
 * @deprecated This file defines a legacy AgentOutput shape used by AgentSDUIAdapter
 * and related services. New agent-fabric agents (BaseAgent subclasses) use the
 * canonical AgentOutput from `../types/agent`. Do not add new consumers here;
 * migrate existing ones to `../types/agent` when touching them.
 */

export interface AgentOutput {
  agent_id: string;
  agent_type: string;
  execution_id: string;
  status: AgentOutputStatus;
  result: AgentResult;
  metadata: AgentOutputMetadata;
  workspaceId?: string;
  businessCase?: Record<string, unknown>;
  data?: Record<string, unknown>;
  valueTree?: Record<string, unknown>;
  roiModel?: Record<string, unknown>;
  valueCommit?: Record<string, unknown>;
}

export type AgentOutputStatus =
  | 'success'
  | 'partial_success'
  | 'failure'
  | 'timeout';

export interface AgentResult {
  data: Record<string, any>;
  confidence: number;
  reasoning?: string;
  suggestions?: string[];
  warnings?: string[];
  errors?: AgentError[];
}

export interface AgentError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  recoverable: boolean;
}

export interface AgentOutputMetadata {
  execution_time_ms: number;
  token_usage?: TokenUsage;
  model_version: string;
  timestamp: string;
  retry_count: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd?: number;
}

export interface AgentOutputValidation {
  is_valid: boolean;
  schema_version: string;
  validation_errors: string[];
  validated_at: string;
}
