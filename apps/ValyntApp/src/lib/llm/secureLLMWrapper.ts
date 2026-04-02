export interface SecureLLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function secureLLMCall(_prompt: string, _options?: SecureLLMOptions): Promise<string> {
  throw new Error(
    "secureLLMCall is not implemented in the frontend. Invoke agent/LLM capabilities through backend orchestration APIs."
  );
}

export default secureLLMCall;
