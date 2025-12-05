/**
 * LLM Provider Mock
 * 
 * Provides deterministic LLM responses for testing without
 * making actual API calls or incurring costs.
 */

interface MockLLMResponse {
  provider: 'together_ai' | 'openai' | 'cache';
  model?: string;
  response?: string;
  error?: Error;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  latency?: number;
  cached?: boolean;
}

interface MockLLMCall {
  prompt: string;
  model: string;
  timestamp: number;
  response: MockLLMResponse;
}

class LLMProviderMock {
  private responses: MockLLMResponse[] = [];
  private calls: MockLLMCall[] = [];
  private responseIndex = 0;
  private timeoutMs = 0;

  /**
   * Mock a specific LLM response
   */
  mockResponse(response: MockLLMResponse): void {
    this.responses.push(response);
  }

  /**
   * Mock an error response
   */
  mockError(error: { statusCode: number; message: string }): void {
    this.responses.push({
      provider: 'together_ai',
      error: new Error(error.message)
    });
  }

  /**
   * Mock a timeout
   */
  mockTimeout(ms: number): void {
    this.timeoutMs = ms;
  }

  /**
   * Get the next mocked response
   */
  async getNextResponse(prompt: string, model: string): Promise<MockLLMResponse> {
    // Simulate latency
    if (this.timeoutMs > 0) {
      await new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), this.timeoutMs)
      );
    }

    const response = this.responses[this.responseIndex] || this.getDefaultResponse();
    
    // Record the call
    this.calls.push({
      prompt,
      model,
      timestamp: Date.now(),
      response
    });

    // Move to next response (circular)
    this.responseIndex = (this.responseIndex + 1) % Math.max(this.responses.length, 1);

    // Simulate latency if specified
    if (response.latency) {
      await new Promise(resolve => setTimeout(resolve, response.latency));
    }

    // Throw error if specified
    if (response.error) {
      throw response.error;
    }

    return response;
  }

  /**
   * Get default response when no mock is configured
   */
  private getDefaultResponse(): MockLLMResponse {
    return {
      provider: 'together_ai',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      response: JSON.stringify({
        keyPartners: ['Default partner'],
        keyActivities: ['Default activity'],
        valuePropositions: ['Default value'],
        customerRelationships: ['Default relationship'],
        customerSegments: ['Default segment'],
        keyResources: ['Default resource'],
        channels: ['Default channel'],
        costStructure: ['Default cost'],
        revenueStreams: ['Default revenue']
      }),
      usage: {
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150
      },
      cost: 0.000135,
      latency: 1000,
      cached: false
    };
  }

  /**
   * Get number of calls made
   */
  getCallCount(): number {
    return this.calls.length;
  }

  /**
   * Get last call made
   */
  getLastCall(): MockLLMCall | undefined {
    return this.calls[this.calls.length - 1];
  }

  /**
   * Get all calls made
   */
  getAllCalls(): MockLLMCall[] {
    return [...this.calls];
  }

  /**
   * Get calls for specific provider
   */
  getCallsForProvider(provider: 'together_ai' | 'openai' | 'cache'): MockLLMCall[] {
    return this.calls.filter(call => call.response.provider === provider);
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.responses = [];
    this.calls = [];
    this.responseIndex = 0;
    this.timeoutMs = 0;
  }

  /**
   * Verify specific call was made
   */
  verifyCall(predicate: (call: MockLLMCall) => boolean): boolean {
    return this.calls.some(predicate);
  }

  /**
   * Get total cost of all mocked calls
   */
  getTotalCost(): number {
    return this.calls.reduce((sum, call) => sum + (call.response.cost || 0), 0);
  }

  /**
   * Get average latency of all calls
   */
  getAverageLatency(): number {
    if (this.calls.length === 0) return 0;
    const totalLatency = this.calls.reduce(
      (sum, call) => sum + (call.response.latency || 0),
      0
    );
    return totalLatency / this.calls.length;
  }
}

// Export singleton instance
export const mockLLMProvider = new LLMProviderMock();

/**
 * Mock Together.ai API
 */
export function mockTogetherAI() {
  const originalFetch = global.fetch;

  global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    const urlString = url.toString();

    if (urlString.includes('together.xyz')) {
      const body = JSON.parse(options?.body as string);
      const response = await mockLLMProvider.getNextResponse(
        body.messages[0].content,
        body.model
      );

      if (response.error) {
        return {
          ok: false,
          status: 500,
          text: async () => response.error!.message
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: response.response } }],
          usage: response.usage || {
            prompt_tokens: 50,
            completion_tokens: 100,
            total_tokens: 150
          }
        })
      } as Response;
    }

    return originalFetch(url, options);
  };

  return () => {
    global.fetch = originalFetch;
  };
}

/**
 * Mock OpenAI API
 */
export function mockOpenAI() {
  const originalFetch = global.fetch;

  global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    const urlString = url.toString();

    if (urlString.includes('openai.com')) {
      const body = JSON.parse(options?.body as string);
      const response = await mockLLMProvider.getNextResponse(
        body.messages[0].content,
        body.model
      );

      if (response.error) {
        return {
          ok: false,
          status: 500,
          text: async () => response.error!.message
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: response.response } }],
          usage: response.usage || {
            prompt_tokens: 50,
            completion_tokens: 100,
            total_tokens: 150
          }
        })
      } as Response;
    }

    return originalFetch(url, options);
  };

  return () => {
    global.fetch = originalFetch;
  };
}

/**
 * Mock both LLM providers
 */
export function mockAllLLMProviders() {
  const restoreTogetherAI = mockTogetherAI();
  const restoreOpenAI = mockOpenAI();

  return () => {
    restoreTogetherAI();
    restoreOpenAI();
  };
}
