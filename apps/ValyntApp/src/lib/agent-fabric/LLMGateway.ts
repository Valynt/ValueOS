/**
 * LLM Gateway — type-only module.
 *
 * The frontend never calls LLMs directly; all inference goes through
 * the backend agent fabric. This file only exports the types that
 * ConfigurationManager.ts needs for provider configuration shapes.
 */

export type LLMProvider = "openai" | "anthropic" | "together" | "google";

export interface LLMProviderConfig {
  apiKeyEnvVar: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMGatewayConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
}
