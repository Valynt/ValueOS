/**
 * Shared LLM Types
 * 
 * Extracted to avoid circular dependencies between LLMGateway and LlmProxyClient
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokens_used: number;
  latency_ms: number;
  model: string;
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  use_gating?: boolean;
  force_model?: string;
}

export type LLMProvider = 'together' | 'openai';
