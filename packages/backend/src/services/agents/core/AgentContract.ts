export interface AgentResultValidationMeta {
  passed: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface AgentResultRetryMeta {
  count: number;
  maxRetries?: number;
  exhausted?: boolean;
  lastError?: string;
}

export interface AgentResultMeta {
  traceId: string;
  contractVersion: string;
  durationMs: number;
  validation: AgentResultValidationMeta;
  retry: AgentResultRetryMeta;
}

export interface AgentResult<TOutput> {
  success: boolean;
  output: TOutput | null;
  error?: string;
  meta: AgentResultMeta;
}
