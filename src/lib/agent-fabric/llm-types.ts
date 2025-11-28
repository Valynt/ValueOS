/**
 * Shared LLM Types
 * 
 * Extracted to avoid circular dependencies between LLMGateway and LlmProxyClient
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
  };
}

export interface LLMResponse {
  content: string;
  tokens_used: number;
  latency_ms: number;
  model: string;
  tool_calls?: LLMToolCall[];
  finish_reason?: 'stop' | 'tool_calls' | 'length';
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
