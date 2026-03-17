/**
 * LLM Provider and Message Types
 */

export type LLMProvider = "openai" | "anthropic" | "together" | "replicate" | "google";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  response_format?: { type: "json_object" | "text" };
  seed?: number;
  user?: string;
}

export interface LLMResponse {
  id?: string;
  object?: string;
  created?: number;
  model: string;
  choices?: {
    index: number;
    message: LLMMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Simplified response fields used by proxy clients. */
  content?: string;
  tokens_used?: number;
  latency_ms?: number;
  tool_calls?: unknown[];
  finish_reason?: string;
}

export type LLMStreamCallback = (chunk: string) => void;

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  };
}
