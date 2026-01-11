/**
 * Example: Instrumenting ValueOS Agent with Observability
 */

import {
  trackReasoning,
  trackToolInvocation,
  trackMemoryOperation,
  trackSafetyCheck,
  trackContextSwitch,
  trackMemoryInconsistency,
  trackConversationTurn,
} from "./agent-instrumentation";

import {
  trackLLMCall,
  trackDependencyCall,
  trackFailure,
  trackRecovery,
  trackCircuitBreakerStateChange,
  trackRetryAttempt,
  trackHealthCheck,
  trackAgentInteraction,
} from "./system-instrumentation";

// ============================================================================
// EXAMPLE: Agent with Full Observability
// ============================================================================

interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  conversationId: string;
  turnNumber: number;
}

/**
 * Example agent reasoning with full observability
 */
export async function processAgentRequest(
  message: AgentMessage
): Promise<string> {
  const agentId = "valueos-agent-1";

  // Track conversation turn
  trackConversationTurn(agentId, message.conversationId, message.turnNumber);

  // Track agent interaction
  trackAgentInteraction(agentId, "user_request");

  // Perform reasoning with tracking
  const reasoning = await trackReasoning(
    {
      agentId,
      conversationId: message.conversationId,
      turnNumber: message.turnNumber,
      reasoningType: "planning",
    },
    async (span) => {
      // 1. Retrieve relevant memories
      const memories = await trackMemoryOperation(
        {
          agentId,
          operationType: "retrieve",
          memoryType: "episodic",
        },
        async () => {
          // Memory retrieval logic
          return { context: "previous conversations...", count: 5 };
        }
      );

      span.setAttribute("memory.items_retrieved", memories.count);

      // 2. Call LLM for reasoning
      const llmResponse = await trackLLMCall(
        {
          provider: "together",
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          operation: "chat",
          inputTokens: 1500,
          outputTokens: 300,
          estimatedCost: 0.0015, // $0.0015 estimated
        },
        async (llmSpan) => {
          // LLM API call
          llmSpan.setAttribute("llm.temperature", 0.7);
          llmSpan.setAttribute("llm.max_tokens", 500);

          return {
            response:
              "I should use the ResearchCompanyTool to gather information...",
            toolCalls: ["ResearchCompanyTool"],
          };
        }
      );

      return llmResponse;
    }
  );

  // 3. Execute tool calls with tracking
  const toolResults = [];
  for (const toolName of reasoning.toolCalls) {
    const result = await trackToolInvocation(
      {
        agentId,
        toolName,
        conversationId: message.conversationId,
        turnNumber: message.turnNumber,
      },
      async (span) => {
        // Tool execution logic
        span.setAttribute("tool.input", "Nike");

        // Simulate tool call to external API
        const apiResult = await trackDependencyCall(
          {
            service: "company-research-api",
            operation: "research",
            endpoint: "/api/research/company",
          },
          async (apiSpan) => {
            apiSpan.setAttribute("api.company", "Nike");
            return { data: "Company research results..." };
          }
        );

        return apiResult;
      }
    );

    toolResults.push(result);
  }

  // 4. Safety check on output
  const finalResponse = "Based on my research, Nike is...";
  trackSafetyCheck(
    {
      agentId,
      checkType: "output",
      severity: "medium",
    },
    true // passed
  );

  // 5. Store result in memory
  await trackMemoryOperation(
    {
      agentId,
      operationType: "store",
      memoryType: "episodic",
    },
    async () => {
      // Store conversation turn
      return { stored: true };
    }
  );

  return finalResponse;
}

/**
 * Example: Multi-agent context switch
 */
export async function handoffToSpecialistAgent(
  fromAgentId: string,
  toAgentId: string,
  conversationId: string,
  context: any
): Promise<void> {
  const contextSize = JSON.stringify(context).length;

  trackContextSwitch(fromAgentId, toAgentId, conversationId, contextSize);

  // Transfer context to specialist agent
  await trackMemoryOperation(
    {
      agentId: toAgentId,
      operationType: "store",
      memoryType: "short_term",
    },
    async () => {
      // Store context for specialist
      return { transferred: true };
    }
  );
}

/**
 * Example: Failure recovery with tracking
 */
export async function resilientLLMCall(
  provider: string,
  model: string,
  input: string
): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await trackLLMCall(
        {
          provider,
          model,
          operation: "completion",
          inputTokens: input.length / 4, // rough estimate
        },
        async (span) => {
          span.setAttribute("retry.attempt", attempt);
          span.setAttribute("retry.max_attempts", maxRetries);

          // Simulate LLM call
          if (Math.random() < 0.3 && attempt < 3) {
            throw new Error("LLM timeout");
          }

          return "LLM response...";
        }
      );

      // Success - track recovery if this was a retry
      if (attempt > 1) {
        trackRecovery("llm-service", "timeout", "retry");
        trackRetryAttempt("llm-call", attempt, maxRetries, true);
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      // Track failure
      trackFailure(
        {
          component: "llm-service",
          failureType: "timeout",
          severity: "medium",
          recoverable: attempt < maxRetries,
        },
        lastError
      );

      // Track retry attempt
      trackRetryAttempt("llm-call", attempt, maxRetries, false);

      if (attempt >= maxRetries) {
        // Circuit breaker logic
        trackCircuitBreakerStateChange("llm-service", "closed", "open");
        throw lastError;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  throw lastError!;
}

/**
 * Example: Health check with tracking
 */
export async function checkSystemHealth(): Promise<void> {
  // Check LLM service
  const llmStart = Date.now();
  try {
    await trackDependencyCall(
      { service: "llm", operation: "health_check" },
      async () => {
        // Ping LLM service
        return { ok: true };
      }
    );

    trackHealthCheck({
      service: "llm",
      status: "healthy",
      latency: Date.now() - llmStart,
    });
  } catch (error) {
    trackHealthCheck({
      service: "llm",
      status: "unhealthy",
      latency: Date.now() - llmStart,
      details: { error: error instanceof Error ? error.message : "unknown" },
    });
  }

  // Check database
  const dbStart = Date.now();
  try {
    await trackDependencyCall(
      { service: "database", operation: "health_check" },
      async () => {
        // Ping database
        return { ok: true };
      }
    );

    trackHealthCheck({
      service: "database",
      status: "healthy",
      latency: Date.now() - dbStart,
    });
  } catch (error) {
    trackHealthCheck({
      service: "database",
      status: "unhealthy",
      latency: Date.now() - dbStart,
      details: { error: error instanceof Error ? error.message : "unknown" },
    });
  }
}

/**
 * Example: Memory consistency check
 */
export async function verifyMemoryConsistency(
  agentId: string
): Promise<boolean> {
  const shortTerm = await trackMemoryOperation(
    { agentId, operationType: "retrieve", memoryType: "short_term" },
    async () => ({ count: 10, hash: "abc123" })
  );

  const longTerm = await trackMemoryOperation(
    { agentId, operationType: "retrieve", memoryType: "long_term" },
    async () => ({ count: 100, hash: "def456" })
  );

  // Check for inconsistency
  if (shortTerm.count < 0 || longTerm.count < 0) {
    trackMemoryInconsistency(agentId, "negative_count", {
      short_term: shortTerm.count,
      long_term: longTerm.count,
    });
    return false;
  }

  return true;
}
