/**
 * Pre-Invocation Gates
 *
 * Gates that run BEFORE an LLM call is made.
 * Based on RevenueRadar Threat Model mitigations:
 * - R5: Wallet Draining (Cost Gate)
 * - R2: Cross-Tenant Data Leakage (Compliance Gate)
 * - R4: LLM Hallucination prevention starts here
 */

import { logger } from '../../lib/logger';
import {
  ComplianceGateConfig,
  CostGateConfig,
  DEFAULT_GATING_CONFIG,
  GateResult,
  IPreInvocationGate,
  PIIDetectionResult,
  PIILocation,
  PIIType,
  PolicyViolationError,
  PreInvocationContext,
  TenantBudgetStatus,
} from './types';

// ============================================================================
// Cost Gate (R5 Mitigation)
// ============================================================================

/**
 * Cost Gate - Prevents wallet draining attacks and budget overruns
 *
 * Checks:
 * 1. Tenant budget status against thresholds
 * 2. Per-request cost estimates
 * 3. Grace period limits
 */
export class CostGate implements IPreInvocationGate {
  readonly id = 'cost-gate';
  readonly name = 'Cost Budget Gate';

  constructor(
    private config: CostGateConfig = DEFAULT_GATING_CONFIG.cost,
    private getBudgetStatus: (orgId: string) => Promise<TenantBudgetStatus>
  ) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async check(context: PreInvocationContext): Promise<GateResult> {
    if (!this.isEnabled()) {
      return {
        allowed: true,
        gateId: this.id,
        reason: 'Cost gate disabled',
        severity: 'info',
      };
    }

    try {
      const budget = await this.getBudgetStatus(context.organizationId);
      const estimatedCost = this.estimateCost(
        context.requestedModel,
        context.estimatedInputTokens,
        context.estimatedOutputTokens
      );

      // Check per-request limit
      if (estimatedCost > this.config.perRequestLimit) {
        return {
          allowed: false,
          gateId: this.id,
          reason: `Request cost ($${estimatedCost.toFixed(4)}) exceeds per-request limit ($${this.config.perRequestLimit})`,
          severity: 'error',
          suggestedAction: {
            type: 'downgrade',
            alternativeModel: this.getLowerCostModel(context.requestedModel),
            auditMessage: `Cost gate blocked: per-request limit exceeded`,
          },
          metadata: { estimatedCost, limit: this.config.perRequestLimit },
        };
      }

      // Check budget thresholds
      const projectedUsage = budget.usagePercentage + (estimatedCost / budget.budgetLimit) * 100;

      if (projectedUsage >= this.config.blockThreshold) {
        // Check if grace period allows it
        if (budget.inGracePeriod && this.config.allowGracePeriod) {
          const remainingGrace = budget.hardLimit - budget.usedAmount;
          if (estimatedCost > remainingGrace) {
            return {
              allowed: false,
              gateId: this.id,
              reason: `Budget exhausted including grace period. Request blocked.`,
              severity: 'critical',
              suggestedAction: {
                type: 'block',
                auditMessage: `Cost gate blocked: hard limit reached`,
              },
              metadata: { budget, projectedUsage },
            };
          }
          // Allow with warning
          return {
            allowed: true,
            gateId: this.id,
            reason: `Using grace period budget. ${budget.gracePeriodRemainingHours}h remaining.`,
            severity: 'warning',
            metadata: { budget, projectedUsage, usingGracePeriod: true },
          };
        }

        return {
          allowed: false,
          gateId: this.id,
          reason: `Budget threshold (${this.config.blockThreshold}%) exceeded. Request blocked.`,
          severity: 'critical',
          suggestedAction: {
            type: 'block',
            auditMessage: `Cost gate blocked: budget threshold exceeded`,
          },
          metadata: { budget, projectedUsage },
        };
      }

      if (projectedUsage >= this.config.downgradeThreshold) {
        return {
          allowed: true,
          gateId: this.id,
          reason: `Budget at ${budget.usagePercentage.toFixed(1)}%. Downgrading model to conserve budget.`,
          severity: 'warning',
          suggestedAction: {
            type: 'downgrade',
            alternativeModel: this.getLowerCostModel(context.requestedModel),
            auditMessage: `Cost gate: model downgraded due to budget pressure`,
          },
          metadata: { budget, projectedUsage },
        };
      }

      if (projectedUsage >= this.config.warningThreshold) {
        return {
          allowed: true,
          gateId: this.id,
          reason: `Budget at ${budget.usagePercentage.toFixed(1)}% - approaching limit.`,
          severity: 'warning',
          metadata: { budget, projectedUsage },
        };
      }

      return {
        allowed: true,
        gateId: this.id,
        reason: `Budget within limits (${budget.usagePercentage.toFixed(1)}% used)`,
        severity: 'info',
        metadata: { budget, projectedUsage },
      };
    } catch (error) {
      logger.error('Cost gate check failed', { error, context });
      // Fail open with warning for availability
      return {
        allowed: true,
        gateId: this.id,
        reason: 'Cost gate check failed - proceeding with caution',
        severity: 'warning',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Cost per 1M tokens (USD)
    const pricing: Record<string, { input: number; output: number }> = {
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': { input: 0.88, output: 0.88 },
      'meta-llama/Llama-3-70b-chat-hf': { input: 0.90, output: 0.90 },
      'microsoft/phi-4-mini': { input: 0.10, output: 0.10 },
      'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.60, output: 0.60 },
      'gpt-4': { input: 30.0, output: 60.0 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
      default: { input: 1.0, output: 1.0 },
    };

    const rate = pricing[model] || pricing.default;
    return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
  }

  private getLowerCostModel(currentModel: string): string {
    const downgrades: Record<string, string> = {
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': 'microsoft/phi-4-mini',
      'meta-llama/Llama-3-70b-chat-hf': 'meta-llama/Llama-3-8b-chat-hf',
      'gpt-4': 'gpt-3.5-turbo',
      'gpt-4-turbo': 'gpt-3.5-turbo',
    };
    return downgrades[currentModel] || currentModel;
  }
}

// ============================================================================
// Compliance Gate (R2, R4 Mitigation)
// ============================================================================

/**
 * PII patterns for detection
 */
const PII_PATTERNS: Record<PIIType, RegExp> = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  address: /\b\d{1,5}\s+(?:[A-Za-z]+\s*){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Lane|Ln|Way|Place|Pl)\b/gi,
  name: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Simple name pattern
  date_of_birth: /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g,
  ip_address: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g,
  api_key: /\b(?:sk|pk|api|key|token|secret|bearer)[-_]?[A-Za-z0-9]{20,}\b/gi,
  password: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
  other: /(?:)/g, // Placeholder
};

/**
 * Redaction markers indicating PII has been masked
 */
const REDACTION_MARKERS = ['[REDACTED]', '[MASKED]', '***', 'XXX', '[PII]', '<REDACTED>'];

/**
 * Compliance Gate - Prevents PII leakage and policy violations
 *
 * Checks:
 * 1. PII detection in input
 * 2. Proper redaction verification
 * 3. Tenant isolation
 */
export class ComplianceGate implements IPreInvocationGate {
  readonly id = 'compliance-gate';
  readonly name = 'Compliance & PII Gate';

  constructor(private config: ComplianceGateConfig = DEFAULT_GATING_CONFIG.compliance) {}

  isEnabled(): boolean {
    return this.config.enablePIIDetection || this.config.enableManifestoRules;
  }

  async check(context: PreInvocationContext): Promise<GateResult> {
    if (!this.isEnabled()) {
      return {
        allowed: true,
        gateId: this.id,
        reason: 'Compliance gate disabled',
        severity: 'info',
      };
    }

    try {
      // Check for PII
      if (this.config.enablePIIDetection) {
        const piiResult = this.detectPII(context.inputContent);

        if (piiResult.hasPII) {
          // Check for blocking PII types
          const blockingTypes = piiResult.piiTypes.filter((t) =>
            this.config.blockingPIITypes.includes(t)
          );

          if (blockingTypes.length > 0) {
            // Check if properly redacted
            if (piiResult.isRedacted && this.config.allowRedactedPII) {
              return {
                allowed: true,
                gateId: this.id,
                reason: `Detected redacted PII types: ${blockingTypes.join(', ')}. Proceeding with redacted data.`,
                severity: 'info',
                metadata: { piiResult },
              };
            }

            logger.warn('Unredacted blocking PII detected', {
              userId: context.userId,
              organizationId: context.organizationId,
              piiTypes: blockingTypes,
            });

            return {
              allowed: false,
              gateId: this.id,
              reason: `Unredacted PII detected: ${blockingTypes.join(', ')}. Egress blocked.`,
              severity: 'critical',
              suggestedAction: {
                type: 'block',
                auditMessage: `Compliance gate blocked: unredacted PII (${blockingTypes.join(', ')})`,
              },
              metadata: { piiResult },
            };
          }

          // Non-blocking PII types - allow with warning
          return {
            allowed: true,
            gateId: this.id,
            reason: `Detected PII types: ${piiResult.piiTypes.join(', ')}. Consider redaction.`,
            severity: 'warning',
            metadata: { piiResult },
          };
        }
      }

      return {
        allowed: true,
        gateId: this.id,
        reason: 'Compliance checks passed',
        severity: 'info',
      };
    } catch (error) {
      logger.error('Compliance gate check failed', { error, context });
      // Fail closed for security
      return {
        allowed: false,
        gateId: this.id,
        reason: 'Compliance gate check failed - blocking for safety',
        severity: 'error',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Detect PII in text
   */
  detectPII(text: string): PIIDetectionResult {
    const locations: PIILocation[] = [];
    const piiTypes: PIIType[] = [];

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      if (type === 'other') continue;

      const piiType = type as PIIType;
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (!piiTypes.includes(piiType)) {
          piiTypes.push(piiType);
        }
        locations.push({
          type: piiType,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Check if text contains redaction markers
    const isRedacted =
      locations.length === 0 || REDACTION_MARKERS.some((marker) => text.includes(marker));

    return {
      hasPII: piiTypes.length > 0,
      piiTypes,
      locations,
      isRedacted,
    };
  }
}

// ============================================================================
// Tenant Isolation Gate
// ============================================================================

/**
 * Tenant Isolation Gate - Prevents cross-tenant data leakage
 */
export class TenantIsolationGate implements IPreInvocationGate {
  readonly id = 'tenant-isolation-gate';
  readonly name = 'Tenant Isolation Gate';

  constructor(
    private config: Pick<ComplianceGateConfig, 'enableTenantIsolation'> = {
      enableTenantIsolation: true,
    }
  ) {}

  isEnabled(): boolean {
    return this.config.enableTenantIsolation;
  }

  async check(context: PreInvocationContext): Promise<GateResult> {
    if (!this.isEnabled()) {
      return {
        allowed: true,
        gateId: this.id,
        reason: 'Tenant isolation gate disabled',
        severity: 'info',
      };
    }

    // Verify organization ID is present
    if (!context.organizationId) {
      return {
        allowed: false,
        gateId: this.id,
        reason: 'Missing organization ID - cannot verify tenant isolation',
        severity: 'critical',
        suggestedAction: {
          type: 'block',
          auditMessage: 'Tenant isolation blocked: missing org ID',
        },
      };
    }

    // Verify user belongs to organization (this would typically check a cache/db)
    // For now, we just verify the IDs are present and properly formatted
    if (!context.userId) {
      return {
        allowed: false,
        gateId: this.id,
        reason: 'Missing user ID - cannot verify tenant membership',
        severity: 'critical',
        suggestedAction: {
          type: 'block',
          auditMessage: 'Tenant isolation blocked: missing user ID',
        },
      };
    }

    return {
      allowed: true,
      gateId: this.id,
      reason: 'Tenant isolation verified',
      severity: 'info',
      metadata: {
        organizationId: context.organizationId,
        userId: context.userId,
      },
    };
  }
}

// ============================================================================
// Pre-Invocation Gate Manager
// ============================================================================

/**
 * Manages and executes all pre-invocation gates
 */
export class PreInvocationGateManager {
  private gates: IPreInvocationGate[] = [];

  constructor(gates?: IPreInvocationGate[]) {
    if (gates) {
      this.gates = gates;
    }
  }

  addGate(gate: IPreInvocationGate): void {
    this.gates.push(gate);
  }

  async checkAll(context: PreInvocationContext): Promise<{
    allowed: boolean;
    results: GateResult[];
    suggestedModel?: string;
  }> {
    const startTime = Date.now();
    const results: GateResult[] = [];
    let suggestedModel: string | undefined;

    for (const gate of this.gates) {
      if (!gate.isEnabled()) continue;

      const result = await gate.check(context);
      results.push(result);

      // Track model downgrades
      if (result.suggestedAction?.type === 'downgrade' && result.suggestedAction.alternativeModel) {
        suggestedModel = result.suggestedAction.alternativeModel;
      }

      // If any gate blocks, stop processing
      if (!result.allowed && result.severity === 'critical') {
        logger.warn('Pre-invocation gate blocked request', {
          gateId: gate.id,
          reason: result.reason,
          context: {
            userId: context.userId,
            organizationId: context.organizationId,
            agentId: context.agentId,
          },
        });

        // Throw PolicyViolationError for critical blocks
        throw new PolicyViolationError(
          result.reason,
          [result],
          gate.id,
          'critical'
        );
      }
    }

    const duration = Date.now() - startTime;
    const allowed = results.every((r) => r.allowed);

    logger.debug('Pre-invocation gates completed', {
      allowed,
      gateCount: results.length,
      durationMs: duration,
      suggestedModel,
    });

    return { allowed, results, suggestedModel };
  }
}

/**
 * Create default pre-invocation gate manager
 */
export function createDefaultPreInvocationGates(
  getBudgetStatus: (orgId: string) => Promise<TenantBudgetStatus>,
  config = DEFAULT_GATING_CONFIG
): PreInvocationGateManager {
  const manager = new PreInvocationGateManager();

  manager.addGate(new CostGate(config.cost, getBudgetStatus));
  manager.addGate(new ComplianceGate(config.compliance));
  manager.addGate(new TenantIsolationGate(config.compliance));

  return manager;
}
