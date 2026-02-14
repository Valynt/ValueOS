import { config } from '../config/index.js';

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  max_tokens?: number;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class GatewayOpenAICompat {
  chat = {
    completions: {
      create: async (request: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
        const baseUrl = process.env.LLM_GATEWAY_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${baseUrl}/api/llm/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.openRouter.apiKey
              ? { Authorization: `Bearer ${config.openRouter.apiKey}` }
              : {}),
          },
          body: JSON.stringify({
            prompt: request.messages
              .map((message) => `${message.role}: ${message.content}`)
              .join('\n\n'),
            model: request.model,
            maxTokens: request.max_tokens,
            temperature: request.temperature,
            userId: 'github-code-optimizer',
            tenantId: process.env.DEFAULT_TENANT_ID || 'github-code-optimizer',
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`LLM gateway request failed: ${response.status} ${errorBody}`);
        }

        const data = await response.json();
        return {
          choices: [
            {
              message: {
                content: data.response || data.content || '',
              },
            },
          ],
        };
      },
    },
  };
}

export default GatewayOpenAICompat;
