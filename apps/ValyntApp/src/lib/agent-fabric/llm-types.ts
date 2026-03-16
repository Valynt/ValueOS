// Stub — LLM provider types for agent fabric

export type LLMProvider = "openai" | "anthropic" | "google" | "azure";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
}
