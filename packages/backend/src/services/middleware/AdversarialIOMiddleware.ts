/**
 * AdversarialIOMiddleware — consolidated input/output safety screening.
 *
 * Pre-execution: blocks jailbreak, injection, and prompt-injection patterns.
 * Post-execution: screens agent output for blocked content and optionally
 * validates against GroundtruthAPI for hallucination detection.
 *
 * No LLM calls — all input checks are regex/pattern-based.
 */

import { logger } from '../../lib/logger.js';
import { AuditLogService } from '../AuditLogService.js';
import { GroundtruthAPI } from '../GroundtruthAPI.js';
import {
  AgentMiddleware,
  AgentMiddlewareContext,
  AgentResponse,
} from '../../types/orchestration.js';

import {
  AdversarialIOConfig,
  DEFAULT_ADVERSARIAL_IO_CONFIG,
} from './types.js';

export class AdversarialIOMiddleware implements AgentMiddleware {
  public readonly name = 'adversarial_io';

  private config: AdversarialIOConfig;
  private auditLogService: AuditLogService;
  private groundtruthAPI: GroundtruthAPI;

  constructor(
    deps: {
      auditLogService: AuditLogService;
      groundtruthAPI: GroundtruthAPI;
    },
    config: Partial<AdversarialIOConfig> = {},
  ) {
    this.config = { ...DEFAULT_ADVERSARIAL_IO_CONFIG, ...config };
    this.auditLogService = deps.auditLogService;
    this.groundtruthAPI = deps.groundtruthAPI;
  }

  async execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>,
  ): Promise<AgentResponse> {
    if (!this.config.enabled) {
      return next();
    }

    // ---- Input screening ----
    if (this.config.inputScreening.enabled) {
      const inputViolation = this.screenInput(context.query);
      if (inputViolation) {
        await this.logInputViolation(context, inputViolation);
        return this.safeFallbackResponse(this.config.fallbackMessage);
      }
    }

    // ---- Execute downstream ----
    const response = await next();

    // ---- Output screening ----
    if (this.config.outputScreening.enabled) {
      const outputViolation = this.screenOutput(response);
      if (outputViolation) {
        await this.logOutputViolation(context, outputViolation);
        return this.safeFallbackResponse(this.config.outputFallbackMessage);
      }

      // Ground truth hallucination check (external service, not LLM)
      if (
        this.config.outputScreening.enableGroundTruthCheck &&
        this.groundtruthAPI.isConfigured()
      ) {
        const hallucinationDetected = await this.checkHallucination(
          context,
          response,
        );
        if (hallucinationDetected) {
          await this.logHallucination(context);
          return this.safeFallbackResponse(this.config.outputFallbackMessage);
        }
      }
    }

    return response;
  }

  // ---------------------------------------------------------------------------
  // Input screening
  // ---------------------------------------------------------------------------

  screenInput(query: string): string | null {
    if (!query) return null;

    // Length check
    if (query.length > this.config.inputScreening.maxInputLength) {
      return 'input_too_long';
    }

    // Blocked keywords (case-insensitive substring match)
    const lowerQuery = query.toLowerCase();
    for (const keyword of this.config.inputScreening.blockedKeywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        return 'blocked_keyword';
      }
    }

    // Injection patterns (XSS / script)
    for (const pattern of this.config.inputScreening.injectionPatterns) {
      if (pattern.test(query)) {
        return 'injection_pattern';
      }
    }

    // Prompt injection patterns
    for (const pattern of this.config.inputScreening.promptInjectionPatterns) {
      if (pattern.test(query)) {
        return 'prompt_injection';
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Output screening
  // ---------------------------------------------------------------------------

  screenOutput(response: AgentResponse): string | null {
    if (!response.payload) return null;

    const payloadStr =
      typeof response.payload === 'string'
        ? response.payload
        : JSON.stringify(response.payload);

    const lowerPayload = payloadStr.toLowerCase();
    for (const keyword of this.config.outputScreening.blockedKeywords) {
      if (lowerPayload.includes(keyword.toLowerCase())) {
        return 'blocked_output_keyword';
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Hallucination check via GroundtruthAPI
  // ---------------------------------------------------------------------------

  private async checkHallucination(
    context: AgentMiddlewareContext,
    response: AgentResponse,
  ): Promise<boolean> {
    try {
      const result = await this.groundtruthAPI.evaluate({
        query: context.query,
        agent: context.agentType,
        response: response.payload,
        context: {
          sessionId: context.sessionId,
          userId: context.userId,
        },
      });

      if (!result.success) {
        // If the service is unreachable, don't block — fail open
        logger.warn('GroundtruthAPI evaluation failed, skipping hallucination check', {
          error: result.error,
        });
        return false;
      }

      // The API returns a result; treat a falsy `data` or explicit failure as hallucination
      const data = result.data as Record<string, unknown> | undefined;
      if (data && data.verified === false) {
        return true;
      }

      return false;
    } catch (err) {
      logger.warn('GroundtruthAPI threw during hallucination check', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Audit logging helpers
  // ---------------------------------------------------------------------------

  private async logInputViolation(
    context: AgentMiddlewareContext,
    violationType: string,
  ): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        userId: context.userId,
        userName: 'system',
        userEmail: 'system@valueos.internal',
        action: 'security:input_violation',
        resourceType: 'agent_query',
        resourceId: context.traceId,
        details: {
          violationType,
          agentType: context.agentType,
          inputExcerpt: context.query.slice(0, 100),
        },
        status: 'failed',
      });
    } catch (err) {
      logger.error('Failed to log input violation audit', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async logOutputViolation(
    context: AgentMiddlewareContext,
    violationType: string,
  ): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        userId: context.userId,
        userName: 'system',
        userEmail: 'system@valueos.internal',
        action: 'security:output_violation',
        resourceType: 'agent_response',
        resourceId: context.traceId,
        details: {
          violationType,
          agentType: context.agentType,
        },
        status: 'failed',
      });
    } catch (err) {
      logger.error('Failed to log output violation audit', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async logHallucination(
    context: AgentMiddlewareContext,
  ): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        userId: context.userId,
        userName: 'system',
        userEmail: 'system@valueos.internal',
        action: 'security:hallucination_detected',
        resourceType: 'agent_response',
        resourceId: context.traceId,
        details: {
          agentType: context.agentType,
          query: context.query.slice(0, 100),
        },
        status: 'failed',
      });
    } catch (err) {
      logger.error('Failed to log hallucination audit', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Response helpers
  // ---------------------------------------------------------------------------

  private safeFallbackResponse(message: string): AgentResponse {
    return {
      type: 'message',
      payload: { message, error: true },
    };
  }
}
