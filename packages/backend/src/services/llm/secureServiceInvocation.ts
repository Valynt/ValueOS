import { z } from "zod";

import { getAuditLogger } from "../../lib/agent-fabric/AuditLogger.js";
import type { LLMMessage } from "../../lib/agent-fabric/LLMGateway.js";
import { secureLLMComplete, type LLMCompletable, type SecureLLMCompleteOptions } from "../../lib/llm/secureLLMWrapper.js";

interface ServiceLogger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface SecureServiceInvocationParams<T> {
  gateway: LLMCompletable;
  messages: LLMMessage[];
  schema: z.ZodSchema<T>;
  request: SecureLLMCompleteOptions;
  logger: ServiceLogger;
  actorName: string;
  sessionId: string;
  tenantId: string;
  userId?: string;
  invalidJsonMessage: string;
  invalidJsonLogMessage: string;
  invalidJsonLogContext?: (rawContent: string, error: unknown) => Record<string, unknown>;
  hallucinationCheck?: (parsed: T) => Promise<boolean> | boolean;
  escalationLogMessage?: string;
  escalationLogContext?: (parsed: T) => Record<string, unknown>;
}

export interface SecureServiceInvocationResult<T> {
  parsed: T;
  hallucinationCheck: boolean;
  tokenUsage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  model?: string;
  rawContent: string;
}

export async function secureServiceInvoke<T>(
  params: SecureServiceInvocationParams<T>,
): Promise<SecureServiceInvocationResult<T>> {
  const startTime = Date.now();
  const response = await secureLLMComplete(params.gateway, params.messages, params.request);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(response.content);
  } catch (error) {
    params.logger.error(
      params.invalidJsonLogMessage,
      params.invalidJsonLogContext?.(response.content, error),
    );
    throw new Error(params.invalidJsonMessage);
  }

  const parsed = params.schema.parse(parsedJson);
  const hallucinationCheck = params.hallucinationCheck ? await params.hallucinationCheck(parsed) : true;

  if (!hallucinationCheck && params.escalationLogMessage) {
    params.logger.warn(params.escalationLogMessage, params.escalationLogContext?.(parsed));
  }

  const tokenUsage = response.usage
    ? {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      }
    : undefined;

  void getAuditLogger().logLLMInvocation({
    agentName: params.actorName,
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    userId: params.userId ?? "system",
    model: response.model ?? params.request.model ?? "unknown",
    latencyMs: Date.now() - startTime,
    hallucinationPassed: hallucinationCheck,
    groundingScore: hallucinationCheck ? 1 : 0.4,
    tokenUsage,
  });

  return {
    parsed,
    hallucinationCheck,
    tokenUsage,
    model: response.model ?? params.request.model,
    rawContent: response.content,
  };
}
