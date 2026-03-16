/**
 * LLM Gateway - stub declaration.
 * TODO: Replace with full implementation.
 */
export interface LLMGatewayConfig {
  provider: string;
  model: string;
  apiKey?: string;
}

export class LLMGateway {
  constructor(_config?: LLMGatewayConfig) {}

  async complete(_prompt: string, _options?: Record<string, unknown>): Promise<string> {
    return "";
  }
}
