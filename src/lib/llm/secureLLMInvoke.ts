/**
 * Secure LLM Invocation with Schema Validation
 *
 * Provides a secure way to invoke LLMs with:
 * - Structured output validation (Zod)
 * - Error handling and recovery
 * - Tenant isolation
 * - Circuit breaker integration
 * - Telemetry and audit logging
 */

import { LLMGateway, LLMMessage } from '../agent-fabric/LLMGateway';
import { z } from 'zod';
import { logger } from '../logger';
import { extractJSON } from '../agent-fabric/SafeJSONParser';
import { secureLLMComplete, SecureLLMOptions } from './secureLLMWrapper';

export interface SecureInvokeOptions<T extends z.ZodType> extends Partial<SecureLLMOptions> {
  schema?: T;
  deterministicParse?: boolean;
  executor: LLMGateway;
  tenantId: string;
  traceId?: string;
  requestId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SecureInvokeResult<T> {
  ok: boolean;
  data?: T;
  reason?: string;
  details?: any;
}

/**
 * Securely invoke LLM with schema validation and safety checks
 */
export default async function secureLLMInvoke<T extends z.ZodType>(
  promptStr: string,
  options: SecureInvokeOptions<T>
): Promise<SecureInvokeResult<z.infer<T>>> {
  const {
    schema,
    executor,
    tenantId,
    traceId,
    requestId,
    model,
    temperature,
    maxTokens,
    deterministicParse = true,
  } = options;

  try {
    // 1. Prepare messages
    // Since BaseAgent passes a prompt string which is already formatted,
    // we wrap it in a user message.
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: promptStr
      }
    ];

    // 2. Prepare SecureLLMOptions
    const secureOptions: SecureLLMOptions = {
      serviceName: 'secureLLMInvoke', // Generic service name, ideally should come from caller
      operation: 'invoke_with_schema',
      organizationId: tenantId,
      userId: options.userId, // Should be passed if available
      taskContext: options.taskContext, // Should be passed if available
      model,
      temperature,
      max_tokens: maxTokens,
    };

    // 3. Invoke LLM via secure wrapper
    const result = await secureLLMComplete(executor, messages, secureOptions);

    // 4. Parse and Validate Output
    let data: any;
    if (schema) {
      // Use SafeJSONParser to extract and validate JSON
      try {
        data = await extractJSON(result.content, schema, {
            allowPartial: !deterministicParse
        });
      } catch (parseError: any) {
        logger.warn('Schema validation failed in secureLLMInvoke', {
          tenantId,
          traceId,
          error: parseError.message,
          contentPreview: result.content.substring(0, 200)
        });

        return {
          ok: false,
          reason: `Schema validation failed: ${parseError.message}`,
          details: {
            rawContent: result.content,
            error: parseError
          }
        };
      }
    } else {
      // No schema, return raw content (or try to parse generic JSON if it looks like JSON?)
      // BaseAgent typically passes a schema. If not, maybe return content as string?
      // But the return type implies infer<T>. If T is undefined, result is any.
      data = result.content;
    }

    return {
      ok: true,
      data: data
    };

  } catch (error: any) {
    logger.error('secureLLMInvoke execution failed', {
      tenantId,
      traceId,
      error: error.message
    });

    return {
      ok: false,
      reason: error.message || 'Unknown error during LLM invocation',
      details: error
    };
  }
}
