/**
 * Secure LLM Wrapper for Non-Agent Services
 * 
 * Provides security controls for LLM calls outside of the agent framework:
 * - Tenant isolation
 * - Budget tracking
 * - Audit logging
 * - Circuit breaker protection
 * - Input sanitization
 */

import { LLMGateway, LLMMessage, LLMOptions } from '../agent-fabric/LLMGateway';
import type TaskContext from '../agent-fabric/TaskContext';
import { logger } from '../logger';
import { getTracer } from '../observability';
import { SpanStatusCode } from '@opentelemetry/api';

export interface SecureLLMOptions extends LLMOptions {
  /** Organization/Tenant ID for isolation and budget tracking */
  organizationId?: string;
  /** User ID for audit trail */
  userId?: string;
  /** Service/Component name for logging */
  serviceName: string;
  /** Operation description for audit */
  operation: string;
  /** Task context for budget tracking */
  taskContext?: TaskContext;
}

export interface SecureLLMResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

/**
 * Secure wrapper for LLM gateway calls
 * 
 * Use this instead of direct llmGateway.complete() calls to ensure:
 * - Proper tenant isolation
 * - Budget tracking
 * - Audit logging
 * - Observability
 */
export async function secureLLMComplete(
  llmGateway: LLMGateway,
  messages: LLMMessage[],
  options: SecureLLMOptions
): Promise<SecureLLMResult> {
  const tracer = getTracer();
  const span = tracer.startSpan('secure_llm_complete', {
    attributes: {
      'llm.service': options.serviceName,
      'llm.operation': options.operation,
      'llm.organization_id': options.organizationId || 'unknown',
      'llm.user_id': options.userId || 'unknown',
      'llm.model': options.model || 'default',
    },
  });

  try {
    // Validate required security context
    if (!options.organizationId) {
      logger.warn('LLM call without organization_id', {
        service: options.serviceName,
        operation: options.operation,
      });
    }

    // Sanitize messages
    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: sanitizeContent(msg.content),
    }));

    // Create task context for budget tracking
    const taskContext: TaskContext = options.taskContext || {
      sessionId: `${options.serviceName}-${Date.now()}`,
      organizationId: options.organizationId,
      userId: options.userId,
      agentId: options.serviceName,
      estimatedPromptTokens: estimateTokens(messages),
      estimatedCompletionTokens: options.max_tokens || 1000,
    };

    // Log the call
    logger.info('Secure LLM call initiated', {
      service: options.serviceName,
      operation: options.operation,
      organizationId: options.organizationId,
      userId: options.userId,
      messageCount: messages.length,
      estimatedTokens: taskContext.estimatedPromptTokens,
    });

    // Make the LLM call with task context for budget tracking
    const response = await llmGateway.complete(
      sanitizedMessages,
      {
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        model: options.model,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
      },
      taskContext
    );

    // Log successful completion
    logger.info('Secure LLM call completed', {
      service: options.serviceName,
      operation: options.operation,
      organizationId: options.organizationId,
      responseLength: response.content.length,
      usage: response.usage,
    });

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    return {
      content: response.content,
      usage: response.usage,
      model: response.model,
    };
  } catch (error) {
    logger.error('Secure LLM call failed', error instanceof Error ? error : undefined, {
      service: options.serviceName,
      operation: options.operation,
      organizationId: options.organizationId,
    });

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.end();

    throw error;
  }
}

/**
 * Sanitize content to prevent injection attacks
 */
function sanitizeContent(content: string): string {
  // Remove potential injection patterns
  let sanitized = content;

  // Remove system prompt injection attempts
  sanitized = sanitized.replace(/\[SYSTEM\]|\[\/SYSTEM\]/gi, '');
  sanitized = sanitized.replace(/\[INST\]|\[\/INST\]/gi, '');
  
  // Remove potential command injection
  sanitized = sanitized.replace(/```[\s\S]*?```/g, (match) => {
    // Keep code blocks but remove dangerous commands
    return match.replace(/rm -rf|sudo|eval|exec/gi, '[REDACTED]');
  });

  return sanitized;
}

/**
 * Estimate token count for messages
 * Simple heuristic: ~4 characters per token
 */
function estimateTokens(messages: LLMMessage[]): number {
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Create a secure task context for LLM calls
 */
export function createSecureTaskContext(
  organizationId: string | undefined,
  userId: string | undefined,
  serviceName: string
): TaskContext {
  return {
    sessionId: `${serviceName}-${Date.now()}`,
    organizationId,
    userId,
    agentId: serviceName,
    estimatedPromptTokens: 0,
    estimatedCompletionTokens: 1000,
  };
}
