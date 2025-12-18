/**
 * Post-Invocation Gates
 *
 * Gates that run AFTER an LLM call returns, before output is used.
 * Based on RevenueRadar Threat Model mitigations:
 * - R4: LLM Hallucination (Confidence Gate, Hallucination Gate)
 */

import { logger } from '../../lib/logger';
import {
  ConfidenceGateConfig,
  DEFAULT_GATING_CONFIG,
  GateResult,
  HallucinationDetectionResult,
  HallucinationGateConfig,
  HallucinationIndicator,
  IntegrityCheckResult,
  IPostInvocationGate,
  PolicyViolationError,
  PostInvocationContext,
} from './types';

// ============================================================================
// Confidence/Integrity Gate
// ============================================================================

/**
 * Prompt injection patterns to detect
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /disregard\s+(previous|all|above)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:DAN|jailbreak|unrestricted)/i,
  /system\s*:\s*you\s+are/i,
  /\[SYSTEM\]/i,
  /\<\|im_start\|\>/i,
  /\<\|endoftext\|\>/i,
  /###\s*(?:Human|Assistant|System)/i,
  /bypass\s+(?:your\s+)?(?:safety|content|ethical)/i,
  /override\s+(?:your\s+)?(?:programming|restrictions|guidelines)/i,
];

/**
 * System override patterns
 */
const SYSTEM_OVERRIDE_PATTERNS = [
  /I\s+am\s+(?:now\s+)?(?:the\s+)?(?:new\s+)?(?:system|admin|root)/i,
  /my\s+(?:new\s+)?(?:system\s+)?prompt\s+is/i,
  /execute\s+(?:the\s+following\s+)?(?:code|command|script)/i,
  /\$\{[^}]+\}/g, // Template injection
  /eval\s*\(/i,
  /__import__/i,
  /os\.system/i,
  /subprocess\./i,
];

/**
 * Confidence Gate - Verifies output quality and integrity
 *
 * Checks:
 * 1. Confidence score meets threshold
 * 2. Knowledge fabric verification (if enabled)
 * 3. Triggers reflection loop if confidence is low
 */
export class ConfidenceGate implements IPostInvocationGate {
  readonly id = 'confidence-gate';
  readonly name = 'Confidence & Integrity Gate';

  constructor(
    private config: ConfidenceGateConfig = DEFAULT_GATING_CONFIG.confidence,
    private verifyWithKnowledgeFabric?: (output: string, context: PostInvocationContext) => Promise<IntegrityCheckResult>
  ) {}

  isEnabled(): boolean {
    return true; // Always enabled, just changes behavior
  }

  async check(context: PostInvocationContext): Promise<GateResult> {
    try {
      const integrityResult = await this.performIntegrityCheck(context);

      // Check confidence threshold
      if (integrityResult.score < this.config.minConfidenceScore) {
        if (this.config.enableReflection) {
          return {
            allowed: true, // Allow but trigger reflection
            gateId: this.id,
            reason: `Confidence score (${integrityResult.score.toFixed(2)}) below threshold (${this.config.minConfidenceScore}). Triggering reflection.`,
            severity: 'warning',
            suggestedAction: {
              type: 'retry',
              retryDelayMs: 0, // Immediate retry with reflection
              auditMessage: `Confidence gate: triggering reflection (score: ${integrityResult.score.toFixed(2)})`,
            },
            metadata: { integrityResult },
          };
        }

        return {
          allowed: false,
          gateId: this.id,
          reason: `Confidence score (${integrityResult.score.toFixed(2)}) below threshold (${this.config.minConfidenceScore})`,
          severity: 'error',
          suggestedAction: {
            type: 'block',
            auditMessage: `Confidence gate blocked: low confidence (${integrityResult.score.toFixed(2)})`,
          },
          metadata: { integrityResult },
        };
      }

      // Check individual integrity checks
      const failedChecks = integrityResult.checks.filter((c) => !c.passed);
      if (failedChecks.length > 0) {
        const failedNames = failedChecks.map((c) => c.name).join(', ');
        return {
          allowed: true,
          gateId: this.id,
          reason: `Some integrity checks failed: ${failedNames}`,
          severity: 'warning',
          metadata: { integrityResult, failedChecks },
        };
      }

      return {
        allowed: true,
        gateId: this.id,
        reason: `Confidence check passed (score: ${integrityResult.score.toFixed(2)})`,
        severity: 'info',
        metadata: { integrityResult },
      };
    } catch (error) {
      logger.error('Confidence gate check failed', { error, context });
      // Fail open with warning
      return {
        allowed: true,
        gateId: this.id,
        reason: 'Confidence gate check failed - proceeding with caution',
        severity: 'warning',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private async performIntegrityCheck(context: PostInvocationContext): Promise<IntegrityCheckResult> {
    const checks: IntegrityCheckResult['checks'] = [];
    let totalScore = 0;
    let checkCount = 0;

    // 1. Check for valid JSON structure if expected
    const jsonCheck = this.checkJSONValidity(context.rawOutput);
    checks.push(jsonCheck);
    totalScore += jsonCheck.score;
    checkCount++;

    // 2. Check output length sanity
    const lengthCheck = this.checkOutputLength(context.rawOutput, context.actualOutputTokens);
    checks.push(lengthCheck);
    totalScore += lengthCheck.score;
    checkCount++;

    // 3. Check for self-consistency markers
    const consistencyCheck = this.checkSelfConsistency(context.rawOutput);
    checks.push(consistencyCheck);
    totalScore += consistencyCheck.score;
    checkCount++;

    // 4. Use reported confidence if available
    if (context.reportedConfidence !== undefined) {
      checks.push({
        name: 'llm_reported_confidence',
        passed: context.reportedConfidence >= this.config.minConfidenceScore,
        score: context.reportedConfidence,
        details: `LLM reported confidence: ${context.reportedConfidence}`,
      });
      totalScore += context.reportedConfidence;
      checkCount++;
    }

    // 5. Knowledge fabric verification (if configured)
    let knowledgeFabricVerified = false;
    if (this.config.enableKnowledgeFabricVerification && this.verifyWithKnowledgeFabric) {
      try {
        const kfResult = await this.verifyWithKnowledgeFabric(context.rawOutput, context);
        checks.push(...kfResult.checks);
        totalScore += kfResult.score * kfResult.checks.length;
        checkCount += kfResult.checks.length;
        knowledgeFabricVerified = true;
      } catch (error) {
        logger.warn('Knowledge fabric verification failed', { error });
        checks.push({
          name: 'knowledge_fabric_verification',
          passed: false,
          score: 0.5, // Neutral score on failure
          details: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        totalScore += 0.5;
        checkCount++;
      }
    }

    const averageScore = checkCount > 0 ? totalScore / checkCount : 0.5;

    return {
      score: averageScore,
      passed: averageScore >= this.config.minConfidenceScore,
      checks,
      knowledgeFabricVerified,
    };
  }

  private checkJSONValidity(output: string): IntegrityCheckResult['checks'][0] {
    // Try to find JSON in output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        name: 'json_validity',
        passed: true, // Not all outputs need to be JSON
        score: 0.8,
        details: 'No JSON structure detected (may be plain text response)',
      };
    }

    try {
      JSON.parse(jsonMatch[0]);
      return {
        name: 'json_validity',
        passed: true,
        score: 1.0,
        details: 'Valid JSON structure',
      };
    } catch {
      return {
        name: 'json_validity',
        passed: false,
        score: 0.3,
        details: 'Invalid JSON structure detected',
      };
    }
  }

  private checkOutputLength(output: string, tokens: number): IntegrityCheckResult['checks'][0] {
    // Check for suspiciously short or truncated outputs
    if (output.length < 10) {
      return {
        name: 'output_length',
        passed: false,
        score: 0.2,
        details: 'Output suspiciously short',
      };
    }

    // Check for truncation indicators
    if (output.endsWith('...') || output.includes('[truncated]')) {
      return {
        name: 'output_length',
        passed: true,
        score: 0.7,
        details: 'Output may be truncated',
      };
    }

    return {
      name: 'output_length',
      passed: true,
      score: 1.0,
      details: `Output length: ${output.length} chars, ${tokens} tokens`,
    };
  }

  private checkSelfConsistency(output: string): IntegrityCheckResult['checks'][0] {
    // Look for confidence/certainty markers in the output
    const lowConfidenceMarkers = [
      'i\'m not sure',
      'i don\'t know',
      'uncertain',
      'might be',
      'could be',
      'possibly',
      'i cannot',
      'unable to',
    ];

    const highConfidenceMarkers = [
      'definitely',
      'certainly',
      'absolutely',
      'confident',
      'clearly',
    ];

    const lowerOutput = output.toLowerCase();
    const lowCount = lowConfidenceMarkers.filter((m) => lowerOutput.includes(m)).length;
    const highCount = highConfidenceMarkers.filter((m) => lowerOutput.includes(m)).length;

    if (lowCount > 2) {
      return {
        name: 'self_consistency',
        passed: true,
        score: 0.5,
        details: `Multiple uncertainty markers detected (${lowCount})`,
      };
    }

    if (highCount > lowCount) {
      return {
        name: 'self_consistency',
        passed: true,
        score: 0.9,
        details: 'Output indicates high confidence',
      };
    }

    return {
      name: 'self_consistency',
      passed: true,
      score: 0.75,
      details: 'Neutral confidence level',
    };
  }
}

// ============================================================================
// Hallucination Gate
// ============================================================================

/**
 * Hallucination Gate - Detects potential hallucinations and prompt injections
 *
 * Checks:
 * 1. Prompt injection patterns
 * 2. System override attempts
 * 3. Factual inconsistency indicators
 */
export class HallucinationGate implements IPostInvocationGate {
  readonly id = 'hallucination-gate';
  readonly name = 'Hallucination Detection Gate';

  constructor(private config: HallucinationGateConfig = DEFAULT_GATING_CONFIG.hallucination) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async check(context: PostInvocationContext): Promise<GateResult> {
    if (!this.isEnabled()) {
      return {
        allowed: true,
        gateId: this.id,
        reason: 'Hallucination gate disabled',
        severity: 'info',
      };
    }

    try {
      const result = this.detectHallucination(context.rawOutput);

      // Critical: Prompt injection or system override
      if (result.hasPromptInjection || result.hasSystemOverride) {
        const type = result.hasPromptInjection ? 'prompt injection' : 'system override';

        logger.error('Security threat detected in LLM output', {
          type,
          userId: context.preContext.userId,
          organizationId: context.preContext.organizationId,
          agentId: context.preContext.agentId,
          indicators: result.indicators,
        });

        throw new PolicyViolationError(
          `${type} detected in LLM output - discarding response`,
          [{
            allowed: false,
            gateId: this.id,
            reason: `${type} detected`,
            severity: 'critical',
            metadata: { result },
          }],
          this.id,
          'critical'
        );
      }

      // High hallucination risk
      if (result.riskScore > this.config.maxRiskScore) {
        const action = this.config.actionOnHallucination;

        if (action === 'block') {
          return {
            allowed: false,
            gateId: this.id,
            reason: `Hallucination risk score (${result.riskScore.toFixed(2)}) exceeds threshold (${this.config.maxRiskScore})`,
            severity: 'error',
            suggestedAction: {
              type: 'block',
              auditMessage: `Hallucination gate blocked: high risk score (${result.riskScore.toFixed(2)})`,
            },
            metadata: { result },
          };
        }

        if (action === 'retry') {
          return {
            allowed: true,
            gateId: this.id,
            reason: `Hallucination risk detected. Triggering retry.`,
            severity: 'warning',
            suggestedAction: {
              type: 'retry',
              retryDelayMs: 0,
              auditMessage: `Hallucination gate: retry triggered (risk: ${result.riskScore.toFixed(2)})`,
            },
            metadata: { result },
          };
        }

        // Warn action
        return {
          allowed: true,
          gateId: this.id,
          reason: `Possible hallucination detected (risk: ${result.riskScore.toFixed(2)})`,
          severity: 'warning',
          metadata: { result },
        };
      }

      return {
        allowed: true,
        gateId: this.id,
        reason: `Hallucination check passed (risk: ${result.riskScore.toFixed(2)})`,
        severity: 'info',
        metadata: { result },
      };
    } catch (error) {
      if (error instanceof PolicyViolationError) {
        throw error;
      }

      logger.error('Hallucination gate check failed', { error, context });
      // Fail closed for security
      return {
        allowed: false,
        gateId: this.id,
        reason: 'Hallucination gate check failed - blocking for safety',
        severity: 'error',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private detectHallucination(output: string): HallucinationDetectionResult {
    const indicators: HallucinationIndicator[] = [];
    let hasPromptInjection = false;
    let hasSystemOverride = false;

    // Check prompt injection patterns
    if (this.config.enablePromptInjectionDetection) {
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        const match = output.match(pattern);
        if (match) {
          hasPromptInjection = true;
          indicators.push({
            type: 'prompt_injection',
            confidence: 0.9,
            description: `Prompt injection pattern detected: ${match[0].substring(0, 50)}`,
            location: {
              start: match.index || 0,
              end: (match.index || 0) + match[0].length,
            },
          });
        }
      }
    }

    // Check system override patterns
    if (this.config.enableSystemOverrideDetection) {
      for (const pattern of SYSTEM_OVERRIDE_PATTERNS) {
        const match = output.match(pattern);
        if (match) {
          hasSystemOverride = true;
          indicators.push({
            type: 'system_override',
            confidence: 0.85,
            description: `System override pattern detected: ${match[0].substring(0, 50)}`,
            location: {
              start: match.index || 0,
              end: (match.index || 0) + match[0].length,
            },
          });
        }
      }
    }

    // Check for factual inconsistency indicators
    const inconsistencyPatterns = [
      { pattern: /as of my (?:last )?(?:knowledge )?(?:cut-?off|training)/i, type: 'temporal_error' as const },
      { pattern: /I (?:don't|cannot) have (?:access to|real-time)/i, type: 'factual_inconsistency' as const },
      { pattern: /according to (?:my )?(?:training|data)/i, type: 'source_fabrication' as const },
    ];

    for (const { pattern, type } of inconsistencyPatterns) {
      const match = output.match(pattern);
      if (match) {
        indicators.push({
          type,
          confidence: 0.5,
          description: `Potential ${type.replace('_', ' ')}: ${match[0]}`,
          location: {
            start: match.index || 0,
            end: (match.index || 0) + match[0].length,
          },
        });
      }
    }

    // Calculate risk score
    let riskScore = 0;
    for (const indicator of indicators) {
      const weight =
        indicator.type === 'prompt_injection' ? 1.0 :
        indicator.type === 'system_override' ? 0.95 :
        indicator.type === 'factual_inconsistency' ? 0.3 :
        0.2;
      riskScore = Math.max(riskScore, indicator.confidence * weight);
    }

    return {
      hasHallucination: indicators.length > 0 && riskScore > 0.3,
      riskScore,
      indicators,
      hasPromptInjection,
      hasSystemOverride,
    };
  }
}

// ============================================================================
// Post-Invocation Gate Manager
// ============================================================================

/**
 * Manages and executes all post-invocation gates
 */
export class PostInvocationGateManager {
  private gates: IPostInvocationGate[] = [];

  constructor(gates?: IPostInvocationGate[]) {
    if (gates) {
      this.gates = gates;
    }
  }

  addGate(gate: IPostInvocationGate): void {
    this.gates.push(gate);
  }

  async checkAll(context: PostInvocationContext): Promise<{
    allowed: boolean;
    results: GateResult[];
    shouldRetry: boolean;
    confidenceMultiplier: number;
  }> {
    const startTime = Date.now();
    const results: GateResult[] = [];
    let shouldRetry = false;
    let confidenceMultiplier = 1.0;

    for (const gate of this.gates) {
      if (!gate.isEnabled()) continue;

      const result = await gate.check(context);
      results.push(result);

      // Track retry suggestions
      if (result.suggestedAction?.type === 'retry') {
        shouldRetry = true;
      }

      // Adjust confidence based on gate results
      if (result.severity === 'warning') {
        confidenceMultiplier *= 0.9;
      } else if (result.severity === 'error') {
        confidenceMultiplier *= 0.7;
      }

      // If any gate blocks, stop processing
      if (!result.allowed) {
        logger.warn('Post-invocation gate blocked output', {
          gateId: gate.id,
          reason: result.reason,
          context: {
            userId: context.preContext.userId,
            organizationId: context.preContext.organizationId,
            agentId: context.preContext.agentId,
          },
        });
        break;
      }
    }

    const duration = Date.now() - startTime;
    const allowed = results.every((r) => r.allowed);

    logger.debug('Post-invocation gates completed', {
      allowed,
      gateCount: results.length,
      durationMs: duration,
      shouldRetry,
      confidenceMultiplier,
    });

    return { allowed, results, shouldRetry, confidenceMultiplier };
  }
}

/**
 * Create default post-invocation gate manager
 */
export function createDefaultPostInvocationGates(
  config = DEFAULT_GATING_CONFIG,
  verifyWithKnowledgeFabric?: (output: string, context: PostInvocationContext) => Promise<IntegrityCheckResult>
): PostInvocationGateManager {
  const manager = new PostInvocationGateManager();

  manager.addGate(new ConfidenceGate(config.confidence, verifyWithKnowledgeFabric));
  manager.addGate(new HallucinationGate(config.hallucination));

  return manager;
}
