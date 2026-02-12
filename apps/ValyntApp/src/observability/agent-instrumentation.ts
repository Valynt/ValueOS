/**
 * Agent Behavior Instrumentation
 *
 * Specialized observability for AI agents including:
 * - Reasoning accuracy tracking
 * - Tool usage correctness
 * - Memory consistency
 * - Safety boundaries
 * - Context handling across turns
 */

import { Metrics, logger, withSpan } from "./instrumentation";
import type { Span } from "@opentelemetry/api";

// ============================================================================
// AGENT BEHAVIOR METRICS
// ============================================================================

export const AgentMetrics = {
  // Reasoning & Decision Making
  reasoningAttempts: Metrics.createCounter(
    "agent_reasoning_attempts_total",
    "Total number of reasoning attempts"
  ),

  reasoningErrors: Metrics.createCounter(
    "agent_reasoning_errors_total",
    "Number of reasoning errors or failures"
  ),

  reasoningDuration: Metrics.createHistogram(
    "agent_reasoning_duration_seconds",
    "Duration of reasoning operations",
    "seconds"
  ),

  // Tool Usage
  toolInvocations: Metrics.createCounter(
    "agent_tool_invocations_total",
    "Total number of tool invocations"
  ),

  toolErrors: Metrics.createCounter(
    "agent_tool_errors_total",
    "Number of tool execution errors"
  ),

  toolDuration: Metrics.createHistogram(
    "agent_tool_duration_seconds",
    "Duration of tool executions",
    "seconds"
  ),

  // Memory Operations
  memoryRetrievals: Metrics.createCounter(
    "agent_memory_retrievals_total",
    "Number of memory retrieval operations"
  ),

  memoryStores: Metrics.createCounter(
    "agent_memory_stores_total",
    "Number of memory store operations"
  ),

  memoryInconsistencies: Metrics.createCounter(
    "agent_memory_inconsistencies_total",
    "Detected memory inconsistencies"
  ),

  // Safety & Boundaries
  safetyViolations: Metrics.createCounter(
    "agent_safety_violations_total",
    "Number of safety boundary violations"
  ),

  contentFiltered: Metrics.createCounter(
    "agent_content_filtered_total",
    "Number of filtered/rejected contents"
  ),

  // Context Management
  contextSwitches: Metrics.createCounter(
    "agent_context_switches_total",
    "Number of context switches between agents"
  ),

  contextSize: Metrics.createHistogram(
    "agent_context_size_bytes",
    "Size of agent context",
    "bytes"
  ),

  turnCount: Metrics.createHistogram(
    "agent_conversation_turns",
    "Number of turns in a conversation"
  ),
};

// ============================================================================
// AGENT BEHAVIOR TRACKING
// ============================================================================

export interface ReasoningMetadata {
  agentId: string;
  conversationId: string;
  turnNumber: number;
  reasoningType: "planning" | "decision" | "reflection" | "error_handling";
  inputTokens?: number;
  outputTokens?: number;
}

export interface ToolInvocationMetadata {
  agentId: string;
  toolName: string;
  conversationId: string;
  turnNumber: number;
  inputSize?: number;
  outputSize?: number;
}

export interface MemoryOperationMetadata {
  agentId: string;
  operationType: "retrieve" | "store" | "update" | "delete";
  memoryType: "short_term" | "long_term" | "episodic" | "semantic";
  itemCount?: number;
}

export interface SafetyCheckMetadata {
  agentId: string;
  checkType: "input" | "output" | "tool_usage" | "boundary";
  severity: "low" | "medium" | "high" | "critical";
  violationType?: string;
}

/**
 * Track agent reasoning operation
 */
export async function trackReasoning<T>(
  metadata: ReasoningMetadata,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return withSpan(
    "agent.reasoning",
    async (span) => {
      // Add span attributes
      span.setAttribute("agent.id", metadata.agentId);
      span.setAttribute("agent.conversation_id", metadata.conversationId);
      span.setAttribute("agent.turn_number", metadata.turnNumber);
      span.setAttribute("agent.reasoning_type", metadata.reasoningType);

      if (metadata.inputTokens) {
        span.setAttribute("agent.input_tokens", metadata.inputTokens);
      }
      if (metadata.outputTokens) {
        span.setAttribute("agent.output_tokens", metadata.outputTokens);
      }

      // Log reasoning attempt
      logger.info("Agent reasoning started", {
        agent_id: metadata.agentId,
        conversation_id: metadata.conversationId,
        turn: metadata.turnNumber,
        type: metadata.reasoningType,
      });

      // Track metric
      AgentMetrics.reasoningAttempts.add(1, {
        agent_id: metadata.agentId,
        reasoning_type: metadata.reasoningType,
      });

      try {
        const result = await operation(span);

        const duration = (Date.now() - startTime) / 1000;
        AgentMetrics.reasoningDuration.record(duration, {
          agent_id: metadata.agentId,
          reasoning_type: metadata.reasoningType,
          status: "success",
        });

        logger.info("Agent reasoning completed", {
          agent_id: metadata.agentId,
          conversation_id: metadata.conversationId,
          duration_ms: duration * 1000,
          output_tokens: metadata.outputTokens,
        });

        return result;
      } catch (error) {
        AgentMetrics.reasoningErrors.add(1, {
          agent_id: metadata.agentId,
          reasoning_type: metadata.reasoningType,
          error_type: error instanceof Error ? error.name : "unknown",
        });

        logger.error("Agent reasoning failed", {
          agent_id: metadata.agentId,
          conversation_id: metadata.conversationId,
          error: error instanceof Error ? error.message : "unknown",
        });

        throw error;
      }
    },
    {
      "agent.operation": "reasoning",
    }
  );
}

/**
 * Track tool invocation
 */
export async function trackToolInvocation<T>(
  metadata: ToolInvocationMetadata,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return withSpan(`agent.tool.${metadata.toolName}`, async (span) => {
    span.setAttribute("agent.id", metadata.agentId);
    span.setAttribute("agent.tool", metadata.toolName);
    span.setAttribute("agent.conversation_id", metadata.conversationId);
    span.setAttribute("agent.turn_number", metadata.turnNumber);

    logger.info("Agent tool invoked", {
      agent_id: metadata.agentId,
      tool: metadata.toolName,
      conversation_id: metadata.conversationId,
    });

    AgentMetrics.toolInvocations.add(1, {
      agent_id: metadata.agentId,
      tool: metadata.toolName,
    });

    try {
      const result = await operation(span);

      const duration = (Date.now() - startTime) / 1000;
      AgentMetrics.toolDuration.record(duration, {
        agent_id: metadata.agentId,
        tool: metadata.toolName,
        status: "success",
      });

      logger.info("Agent tool completed", {
        agent_id: metadata.agentId,
        tool: metadata.toolName,
        duration_ms: duration * 1000,
      });

      return result;
    } catch (error) {
      AgentMetrics.toolErrors.add(1, {
        agent_id: metadata.agentId,
        tool: metadata.toolName,
        error_type: error instanceof Error ? error.name : "unknown",
      });

      logger.error("Agent tool failed", {
        agent_id: metadata.agentId,
        tool: metadata.toolName,
        error: error instanceof Error ? error.message : "unknown",
      });

      throw error;
    }
  });
}

/**
 * Track memory operations
 */
export async function trackMemoryOperation<T>(
  metadata: MemoryOperationMetadata,
  operation: () => Promise<T>
): Promise<T> {
  return withSpan(`agent.memory.${metadata.operationType}`, async (span) => {
    span.setAttribute("agent.id", metadata.agentId);
    span.setAttribute("agent.memory.operation", metadata.operationType);
    span.setAttribute("agent.memory.type", metadata.memoryType);

    logger.debug("Agent memory operation", {
      agent_id: metadata.agentId,
      operation: metadata.operationType,
      memory_type: metadata.memoryType,
    });

    const metricKey =
      metadata.operationType === "retrieve"
        ? AgentMetrics.memoryRetrievals
        : AgentMetrics.memoryStores;

    metricKey.add(1, {
      agent_id: metadata.agentId,
      operation: metadata.operationType,
      memory_type: metadata.memoryType,
    });

    return operation();
  });
}

/**
 * Track safety check
 */
export function trackSafetyCheck(
  metadata: SafetyCheckMetadata,
  passed: boolean
): void {
  logger.info("Agent safety check", {
    agent_id: metadata.agentId,
    check_type: metadata.checkType,
    severity: metadata.severity,
    passed,
    violation_type: metadata.violationType,
  });

  if (!passed) {
    AgentMetrics.safetyViolations.add(1, {
      agent_id: metadata.agentId,
      check_type: metadata.checkType,
      severity: metadata.severity,
      violation_type: metadata.violationType || "unknown",
    });

    AgentMetrics.contentFiltered.add(1, {
      agent_id: metadata.agentId,
      check_type: metadata.checkType,
    });
  }
}

/**
 * Track context switch between agents
 */
export function trackContextSwitch(
  fromAgentId: string,
  toAgentId: string,
  conversationId: string,
  contextSize: number
): void {
  logger.info("Agent context switch", {
    from_agent: fromAgentId,
    to_agent: toAgentId,
    conversation_id: conversationId,
    context_size: contextSize,
  });

  AgentMetrics.contextSwitches.add(1, {
    from_agent: fromAgentId,
    to_agent: toAgentId,
  });

  AgentMetrics.contextSize.record(contextSize, {
    from_agent: fromAgentId,
    to_agent: toAgentId,
  });
}

/**
 * Track memory inconsistency detection
 */
export function trackMemoryInconsistency(
  agentId: string,
  inconsistencyType: string,
  details: Record<string, any>
): void {
  logger.warn("Agent memory inconsistency detected", {
    agent_id: agentId,
    inconsistency_type: inconsistencyType,
    ...details,
  });

  AgentMetrics.memoryInconsistencies.add(1, {
    agent_id: agentId,
    type: inconsistencyType,
  });
}

/**
 * Track conversation turn
 */
export function trackConversationTurn(
  agentId: string,
  conversationId: string,
  turnNumber: number
): void {
  AgentMetrics.turnCount.record(turnNumber, {
    agent_id: agentId,
    conversation_id: conversationId,
  });
}
