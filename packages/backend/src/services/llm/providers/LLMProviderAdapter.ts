export interface ProviderCompletionRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderCompletionResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMProviderAdapter {
  readonly provider: "together_ai" | "openai" | "anthropic";
  complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse>;
}
