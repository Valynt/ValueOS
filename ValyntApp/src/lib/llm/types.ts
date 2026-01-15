export type LLMProvider = "openai" | "anthropic" | "google";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  config?: Partial<LLMConfig>;
  stream?: boolean;
}

export interface LLMResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length" | "error";
}

export interface LLMStreamChunk {
  id: string;
  delta: string;
  finishReason?: "stop" | "length";
}

export interface LLMError {
  code: string;
  message: string;
  provider: LLMProvider;
}
