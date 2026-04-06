/**
 * Agent Type Definitions
 *
 * Types for agent configuration, lifecycle context, agent outputs,
 * health monitoring, and agent orchestration.
 */

// ============================================================================
// Agent Configuration
// ============================================================================

export type { PromptApprovalMetadata } from '../lib/agent-fabric/prompts/PromptRegistry';
import type { AgentType } from '../services/agent-types';
export type { AgentType };
import type { LifecycleStage } from '@valueos/shared';
export type { LifecycleStage };

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  lifecycle_stage: LifecycleStage;
  capabilities: string[];
  model: ModelConfig;
  prompts: PromptConfig;
  parameters: AgentParameters;
  constraints: AgentConstraints;
  metadata?: Record<string, unknown>;
}

// Canonical AgentType is defined in services/agent-types.ts.
// This re-export keeps backward compatibility for consumers of types/agent.ts.


// LifecycleStage re-exported at top of file.


export type AgentState = 'idle' | 'planning' | 'executing' | 'waiting' | 'completed' | 'error';

export interface AgentEvent {
  type: 'state_change' | 'message' | 'error' | 'action';
  timestamp: string;
  data: unknown;
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  model_name: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface PromptConfig {
  system_prompt: string;
  user_prompt_template: string;
  few_shot_examples?: FewShotExample[];
  output_format?: string;
}

export interface FewShotExample {
  input: string;
  output: string;
  context?: Record<string, unknown>;
}

export interface AgentParameters {
  timeout_seconds: number;
  max_retries: number;
  retry_delay_ms: number;
  enable_caching: boolean;
  cache_ttl_seconds?: number;
  enable_telemetry: boolean;
}

export interface AgentConstraints {
  max_input_tokens: number;
  max_output_tokens: number;
  allowed_actions: string[];
  forbidden_actions: string[];
  required_permissions: string[];
}

// ============================================================================
// Lifecycle Context
// ============================================================================

export interface LifecycleContext {
  workspace_id: string;
  /** Alias for workspace_id — used by some callers. */
  session_id?: string;
  organization_id: string;
  user_id: string;
  lifecycle_stage: LifecycleStage;
  previous_stage_outputs?: Record<string, unknown>;
  workspace_data: WorkspaceData;
  user_inputs: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Free-form query string passed by some callers. */
  query?: string;
  /**
   * Request-scoped RLS Supabase client authenticated with the caller's JWT.
   * When present, agents must use this client for all DB operations so that
   * tenant isolation is enforced via RLS rather than service_role bypass.
   * Injected by the API layer from the authenticated request context.
   */
  supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
}

export interface WorkspaceData {
  opportunity?: Record<string, unknown>;
  target?: Record<string, unknown>;
  realization?: Record<string, unknown>;
  expansion?: Record<string, unknown>;
  integrity?: Record<string, unknown>;
  businessCase?: Record<string, unknown>;
  [key: string]: Record<string, unknown> | undefined;
}

// ============================================================================
// Agent Output
// ============================================================================

export interface AgentOutput {
  agent_id: string;
  agent_type: AgentType;
  lifecycle_stage: LifecycleStage;
  status: AgentOutputStatus;
  result: Record<string, unknown>;
  data?: Record<string, unknown>;
  confidence: ConfidenceLevel;
  reasoning?: string;
  suggested_next_actions?: string[];
  warnings?: string[];
  errors?: AgentError[];
  metadata: AgentOutputMetadata;
}

export type AgentOutputStatus =
  | 'success'
  | 'partial_success'
  | 'failure'
  | 'timeout'
  | 'cancelled';

export type ConfidenceLevel =
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'very_high';

export interface AgentError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  recoverable: boolean;
  context?: Record<string, unknown>;
}

export interface AgentOutputMetadata {
  execution_time_ms: number;
  token_usage?: TokenUsage;
  model_version: string;
  timestamp: string;
  correlation_id?: string;
  retry_count?: number;
  prompt_version_refs?: PromptVersionReference[];
  /**
   * ID of the reasoning_traces row created by secureInvoke for this invocation.
   * Present on every successful LLM call. Used by ReasoningTracePanel to fetch
   * the full trace without a separate lookup.
   */
  trace_id?: string;
  /**
   * Evidence links for all numeric values in the output.
   * Required for CFO-defensible financial calculations (S2-1).
   */
  evidence_links?: EvidenceLink[];
}

/**
 * Evidence link for a numeric value in agent output.
 * Provides traceability from calculated numbers to their source evidence.
 * Required for compliance and auditability (S2-1).
 */
export interface EvidenceLink {
  /** The numeric value that this evidence supports */
  value: number;
  /** JSON path to the numeric value in the result object */
  path: string;
  /** Trace ID for correlation with reasoning trace */
  trace_id: string;
  /** Reference to the source evidence (e.g., document ID, benchmark URL) */
  evidence_reference: string;
  /** Human-readable description of the evidence */
  description?: string;
  /** Timestamp when the evidence was captured (ISO 8601) - optional per Zod schema */
  captured_at?: string;
}

export interface PromptVersionReference {
  prompt_key: string;
  version: string;
  owner?: string;
  ticket?: string;
  risk_class?: 'low' | 'medium' | 'high' | 'critical';
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd?: number;
}

// ============================================================================
// Agent Health & Monitoring
// ============================================================================

export interface AgentHealthStatus {
  agent_id: string;
  status: HealthStatus;
  last_check: string;
  metrics: AgentMetrics;
  issues: HealthIssue[];
}

export type HealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

export interface AgentMetrics {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
  uptime_percentage: number;
}

export interface HealthIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Agent Registry
// ============================================================================

export interface AgentRegistration {
  agent_id: string;
  id?: string;
  name?: string;
  config: AgentConfig;
  status: 'active' | 'inactive' | 'deprecated';
  version: string;
  registered_at: string;
  last_updated: string;
  lifecycleStage?: string;
  capabilities?: string[];
  region?: string;
  endpoint?: string;
  priority?: number;
}

export interface AgentRecord extends AgentRegistration {
  health?: AgentHealthStatus;
  metrics?: Record<string, unknown>;
}

// ============================================================================
// Agent Execution Request
// ============================================================================

export interface AgentExecutionRequest {
  agent_id: string;
  context: LifecycleContext;
  input: Record<string, unknown>;
  options?: ExecutionOptions;
}

export interface ExecutionOptions {
  timeout_override_seconds?: number;
  enable_streaming?: boolean;
  callback_url?: string;
  idempotency_key?: string;
  priority?: 'low' | 'normal' | 'high';
}

// ============================================================================
// Agent Capabilities
// ============================================================================

export interface AgentCapability {
  name: string;
  description: string;
  required_permissions: string[];
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}
