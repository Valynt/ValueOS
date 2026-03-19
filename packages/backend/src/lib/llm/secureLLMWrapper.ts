/**
 * Secure LLM Wrapper
 *
 * Two exports:
 *
 * 1. `secureLLMComplete` — the approved service/worker/middleware invocation
 *    path. Delegates to LLMGateway.complete() with PII sanitization and
 *    enforces tenant metadata presence. Use this instead of calling
 *    gateway.complete() directly from non-agent code.
 *
 * 2. `SecureLLMWrapper` — input/output validation class used by the wrapper
 *    and available for standalone validation.
 *
 * Agent-owned code must use BaseAgent.secureInvoke() instead.
 */

import { createLogger } from "../logger.js";
import type { LLMMessage } from '../agent-fabric/LLMGateway.js';

const logger = createLogger({ component: "secureLLMComplete" });

/**
 * Minimal interface satisfied by both LLMGateway and LLMGatewayInterface.
 * Allows secureLLMComplete to be used from services that hold either type.
 */
export interface LLMCompletable {
  complete(request: {
    messages: LLMMessage[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    metadata: { organizationId?: string; tenantId?: string; [key: string]: unknown };
  }): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }>;
}

export interface SecureLLMCompleteOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  /** Tenant identifier — required for tenant isolation. */
  organizationId?: string;
  tenantId?: string;
  userId?: string;
  serviceName?: string;
  operation?: string;
  /** Arbitrary extra metadata forwarded to LLMGateway. */
  [key: string]: unknown;
}

/**
 * Approved service-layer LLM invocation path.
 *
 * Enforces tenant metadata presence, runs PII detection on the outbound
 * prompt, and delegates to LLMGateway.complete(). Throws if no tenant
 * identifier is provided (tenant isolation requirement).
 */
export async function secureLLMComplete(
  gateway: LLMCompletable,
  messages: LLMMessage[],
  options: SecureLLMCompleteOptions = {},
): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const organizationId = options.organizationId;
  const tenantId = options.tenantId ?? organizationId;
  if (!organizationId && !tenantId) {
    throw new Error(
      'secureLLMComplete requires a tenant identifier (organizationId or tenantId). ' +
        'Pass it in the options object to satisfy tenant isolation requirements.',
    );
  }

  // PII check on outbound content (non-blocking warn; callers own remediation).
  const wrapper = new SecureLLMWrapper({
    enable_pii_detection: true,
    enable_content_filtering: true,
    enable_rate_limiting: false,
    max_tokens_per_request: options.max_tokens ?? 4096,
  });

  for (const msg of messages) {
    const result = await wrapper.validateInput(msg.content);
    if (!result.is_safe) {
      const severities = result.violations.map((v) => v.severity);
      const hasCritical = severities.includes('critical') || severities.includes('high');
      if (hasCritical) {
        throw new Error(
          `secureLLMComplete blocked request: high/critical PII or content violation detected. ` +
            `Violations: ${result.violations.map((v) => v.message).join('; ')}`,
        );
      }

      logger.warn("secureLLMComplete low/medium PII or content violation detected", {
        tenantId,
        organizationId: organizationId ?? tenantId,
        serviceName: typeof options.serviceName === "string" ? options.serviceName : undefined,
        operation: typeof options.operation === "string" ? options.operation : undefined,
        violations: result.violations,
      });
    }
  }

  // Omit tenant alias fields from rest — tenantId is passed explicitly below.
  // serviceName/operation remain in rest for observability consumers.
  const { userId, model, temperature, max_tokens, ...rawRest } = options;
  const { organizationId: _o, tenantId: _t, ...rest } = rawRest;

  return gateway.complete({
    messages,
    model,
    temperature,
    max_tokens,
    metadata: {
      organizationId: organizationId ?? tenantId,
      tenantId,
      userId: userId ?? 'system',
      ...rest,
    },
  });
}

export interface SecureLLMConfig {
  enable_pii_detection: boolean;
  enable_content_filtering: boolean;
  enable_rate_limiting: boolean;
  max_tokens_per_request: number;
}

export interface LLMSecurityResult {
  is_safe: boolean;
  violations: SecurityViolation[];
  sanitized_input?: string;
  sanitized_output?: string;
}

export interface SecurityViolation {
  type: 'pii' | 'content_filter' | 'rate_limit' | 'token_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
}

export class SecureLLMWrapper {
  private config: SecureLLMConfig;

  constructor(config: SecureLLMConfig) {
    this.config = config;
  }

  async validateInput(input: string): Promise<LLMSecurityResult> {
    const violations: SecurityViolation[] = [];

    if (this.config.enable_pii_detection) {
      const piiViolations = this.detectPII(input);
      violations.push(...piiViolations);
    }

    if (this.config.enable_content_filtering) {
      const contentViolations = this.filterContent(input);
      violations.push(...contentViolations);
    }

    const is_safe = violations.length === 0 || 
      violations.every(v => v.severity === 'low');

    return {
      is_safe,
      violations,
      sanitized_input: is_safe ? input : this.sanitize(input),
    };
  }

  async validateOutput(output: string): Promise<LLMSecurityResult> {
    const violations: SecurityViolation[] = [];

    if (this.config.enable_pii_detection) {
      const piiViolations = this.detectPII(output);
      violations.push(...piiViolations);
    }

    const is_safe = violations.length === 0;

    return {
      is_safe,
      violations,
      sanitized_output: is_safe ? output : this.sanitize(output),
    };
  }

  private detectPII(text: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    // Email detection
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
      violations.push({
        type: 'pii',
        severity: 'medium',
        message: 'Email address detected',
      });
    }

    // Phone number detection
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text)) {
      violations.push({
        type: 'pii',
        severity: 'medium',
        message: 'Phone number detected',
      });
    }

    // SSN detection
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
      violations.push({
        type: 'pii',
        severity: 'high',
        message: 'SSN detected',
      });
    }

    return violations;
  }

  private filterContent(text: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    // Basic content filtering (placeholder)
    const prohibitedPatterns = ['<script', 'javascript:', 'eval('];
    
    for (const pattern of prohibitedPatterns) {
      if (text.toLowerCase().includes(pattern)) {
        violations.push({
          type: 'content_filter',
          severity: 'high',
          message: `Prohibited pattern detected: ${pattern}`,
        });
      }
    }

    return violations;
  }

  private sanitize(text: string): string {
    // Basic sanitization
    return text
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  }
}

export function createSecureLLMWrapper(config: SecureLLMConfig): SecureLLMWrapper {
  return new SecureLLMWrapper(config);
}
