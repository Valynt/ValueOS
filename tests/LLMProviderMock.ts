/**
 * Specialized LLM Provider Mock for Failure Mode Testing
 *
 * Provides controlled failure modes for testing agent resilience:
 * - SlowResponse: Simulates high latency responses
 * - TokenLimitExceeded: Simulates token limit errors
 * - MalformedJSON: Returns invalid JSON responses
 */

import { z } from "zod";

export enum LLMFailureMode {
  NONE = "none",
  SLOW_RESPONSE = "slow_response",
  TOKEN_LIMIT_EXCEEDED = "token_limit_exceeded",
  MALFORMED_JSON = "malformed_json",
  NETWORK_ERROR = "network_error",
  RATE_LIMIT = "rate_limit",
}

export interface LLMFailureConfig {
  mode: LLMFailureMode;
  latencyMs?: number;
  errorMessage?: string;
  maxRetries?: number;
}

export interface LLMCallRecord {
  prompt: string;
  model: string;
  timestamp: number;
  failureMode: LLMFailureMode;
  latency: number;
  success: boolean;
  error?: string;
}

/**
 * Specialized LLM Provider Mock for testing failure scenarios
 */
export class LLMProviderMock {
  private failureConfig: LLMFailureConfig = { mode: LLMFailureMode.NONE };
  private callHistory: LLMCallRecord[] = [];
  private callCount = 0;

  /**
   * Configure failure mode
   */
  setFailureMode(config: LLMFailureConfig): void {
    this.failureConfig = { ...config };
  }

  /**
   * Clear failure configuration
   */
  clearFailureMode(): void {
    this.failureConfig = { mode: LLMFailureMode.NONE };
  }

  /**
   * Get current failure configuration
   */
  getFailureConfig(): LLMFailureConfig {
    return { ...this.failureConfig };
  }

  /**
   * Simulate LLM completion with configured failure modes
   */
  async complete(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      schema?: z.ZodSchema;
    } = {}
  ): Promise<any> {
    const startTime = Date.now();
    const model = options.model || "test-model";
    this.callCount++;

    try {
      // Apply failure mode
      switch (this.failureConfig.mode) {
        case LLMFailureMode.SLOW_RESPONSE:
          await this.simulateLatency();
          break;

        case LLMFailureMode.TOKEN_LIMIT_EXCEEDED:
          throw new Error(
            this.failureConfig.errorMessage ||
            "Token limit exceeded. Input is too long."
          );

        case LLMFailureMode.MALFORMED_JSON:
          await this.simulateLatency();
          return this.generateMalformedJSON();

        case LLMFailureMode.NETWORK_ERROR:
          throw new Error(
            this.failureConfig.errorMessage ||
            "Network error: Connection failed"
          );

        case LLMFailureMode.RATE_LIMIT:
          throw new Error(
            this.failureConfig.errorMessage ||
            "Rate limit exceeded. Please try again later."
          );

        case LLMFailureMode.NONE:
        default:
          await this.simulateLatency();
          break;
      }

      // Generate successful response
      const response = this.generateValidResponse(prompt, options.schema);
      const latency = Date.now() - startTime;

      this.recordCall({
        prompt,
        model,
        timestamp: startTime,
        failureMode: this.failureConfig.mode,
        latency,
        success: true,
      });

      return response;

    } catch (error) {
      const latency = Date.now() - startTime;

      this.recordCall({
        prompt,
        model,
        timestamp: startTime,
        failureMode: this.failureConfig.mode,
        latency,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Simulate network latency
   */
  private async simulateLatency(): Promise<void> {
    const latency = this.failureConfig.latencyMs || 100; // Default 100ms
    await new Promise(resolve => setTimeout(resolve, latency));
  }

  /**
   * Generate a valid response based on schema
   */
  private generateValidResponse(prompt: string, schema?: z.ZodSchema): any {
    // Default response structure
    const baseResponse = {
      result: "Mock response for testing",
      confidence: "high" as const,
      reasoning: "This is a mock response generated for testing purposes",
      hallucination_check: false,
    };

    if (!schema) {
      return baseResponse;
    }

    // Try to generate response that matches schema
    try {
      // For common agent schemas, generate appropriate mock data
      if (prompt.toLowerCase().includes("financial") || prompt.toLowerCase().includes("roi")) {
        return {
          result: "Financial analysis complete",
          confidence: "high",
          reasoning: "Mock financial analysis with positive ROI projection",
          hallucination_check: false,
          metrics: {
            npv: 150000,
            irr: 0.25,
            paybackPeriod: 2.5,
          },
        };
      }

      if (prompt.toLowerCase().includes("opportunity") || prompt.toLowerCase().includes("discovery")) {
        return {
          result: "Opportunity identified",
          confidence: "medium",
          reasoning: "Mock opportunity analysis with market potential",
          hallucination_check: false,
          opportunities: [
            "Market expansion opportunity",
            "Product enhancement potential",
          ],
        };
      }

      return baseResponse;
    } catch (error) {
      // Fallback to base response
      return baseResponse;
    }
  }

  /**
   * Generate malformed JSON response
   */
  private generateMalformedJSON(): any {
    const malformedResponses = [
      '{"result": "incomplete json"',
      '{"result": null, "confidence": "high", "reasoning": ',
      '{result: "missing quotes", confidence: "high"}',
      '{"result": "valid", "confidence": "high", "extra": }',
      'not json at all',
    ];

    return malformedResponses[this.callCount % malformedResponses.length];
  }

  /**
   * Record a call for testing verification
   */
  private recordCall(record: LLMCallRecord): void {
    this.callHistory.push(record);
  }

  /**
   * Get call history
   */
  getCallHistory(): LLMCallRecord[] {
    return [...this.callHistory];
  }

  /**
   * Get calls by failure mode
   */
  getCallsByFailureMode(mode: LLMFailureMode): LLMCallRecord[] {
    return this.callHistory.filter(call => call.failureMode === mode);
  }

  /**
   * Get total call count
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    if (this.callHistory.length === 0) return 0;
    const totalLatency = this.callHistory.reduce((sum, call) => sum + call.latency, 0);
    return totalLatency / this.callHistory.length;
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.callHistory.length === 0) return 1;
    const successfulCalls = this.callHistory.filter(call => call.success).length;
    return successfulCalls / this.callHistory.length;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.failureConfig = { mode: LLMFailureMode.NONE };
    this.callHistory = [];
    this.callCount = 0;
  }

  /**
   * Verify that specific failure modes were triggered
   */
  verifyFailureModeTriggered(mode: LLMFailureMode): boolean {
    return this.callHistory.some(call => call.failureMode === mode && !call.success);
  }

  /**
   * Verify that calls were made within latency bounds
   */
  verifyLatencyBounds(minMs: number, maxMs: number): boolean {
    return this.callHistory.every(call => call.latency >= minMs && call.latency <= maxMs);
  }
}

// Export singleton instance
export const llmProviderMock = new LLMProviderMock();