export interface SecureLLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function secureLLMCall(_prompt: string, _options?: SecureLLMOptions): Promise<string> {
  return "";
}

export default secureLLMCall;
