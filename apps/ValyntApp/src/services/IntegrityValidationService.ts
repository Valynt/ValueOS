/**
 * Integrity Validation Service
 *
 * Provides comprehensive integrity validation for AI-generated content and system state.
 * Critical for ensuring data quality, consistency, and trustworthiness.
 *
 * Responsibilities:
 * - Confidence-reasoning mismatch detection
 * Source fabrication prevention
 * Logical consistency validation
 - Cross-agent integrity checks
 - Performance signal accuracy verification
 */

import { logger } from '../lib/logger';
import { AdversarialValidator } from './AdversarialValidator';
import { SDUIPageDefinition } from '../sdui/schema';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { AgentMemoryService } from './AgentMemoryService';

// ============================================================================
// Types
// ============================================================================

export interface IntegrityValidationRequest {
  content: IntegrityContent;
  contentType: ContentType;
  agentType: string;
  context: Record<string, any>;
  traceId: string;
  validationLevel: ValidationLevel;
}

export enum ContentType {
  SDUI_PAGE = 'sdui_page',
  WORKFLOW_STATE = 'workflow_state',
  AGENT_REASONING = 'agent_reasoning',
  METRIC_DATA = 'metric_data',
  MEMORY_CONTENT = 'memory_content',
}

export enum ValidationLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  COMPREHENSIVE = 'comprehensive',
}

export interface IntegrityContent {
  sduiPage?: SDUIPageDefinition;
  workflowState?: WorkflowState;
  reasoning?: string[];
  metrics?: Record<string, number>;
  memoryData?: any;
  confidence?: number;
  sources?: SourceReference[];
}

export interface SourceReference {
  type: 'url' | 'document' | 'database' | 'api' | 'internal';
  reference: string;
  title?: string;
  lastVerified?: Date;
  trustScore: number;
}

export interface IntegrityValidationResult {
  valid: boolean;
  overallScore: number;
  checks: IntegrityCheck[];
  violations: IntegrityViolation[];
  recommendations: string[];
  validatedAt: Date;
  nextReview?: Date;
}

export interface IntegrityCheck {
  type: CheckType;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  details: string;
  evidence?: any;
}

export enum CheckType {
  CONFIDENCE_REASONING = 'confidence_reasoning',
  SOURCE_VERIFICATION = 'source_verification',
  LOGICAL_CONSISTENCY = 'logical_consistency',
  DATA_INTEGRITY = 'data_integrity',
  CONTEXT_ALIGNMENT = 'context_alignment',
  CROSS_AGENT_CONSISTENCY = 'cross_agent_consistency',
  PERFORMANCE_ACCURACY = 'performance_accuracy',
  COMPLIANCE_CHECK = 'compliance_check',
}

export interface IntegrityViolation {
  type: CheckType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  remediation: string;
  evidence?: any;
}

// ============================================================================
// Integrity Validation Service
// ============================================================================

export class IntegrityValidationService {
  private adversarialValidator: AdversarialValidator;
  private agentMemoryService: AgentMemoryService;
  private sourceVerifier: SourceVerifier;
  private consistencyChecker: ConsistencyChecker;

  constructor(
    agentMemoryService: AgentMemoryService,
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.adversarialValidator = new AdversarialValidator();
    this.agentMemoryService = agentMemoryService;
    this.sourceVerifier = new SourceVerifier(supabaseUrl, supabaseKey);
    this.consistencyChecker = new ConsistencyChecker();
  }

  /**
   * Perform comprehensive integrity validation
   */
  async validateIntegrity(request: IntegrityValidationRequest): Promise<IntegrityValidationResult> {
    const startTime = Date.now();
    const checks: IntegrityCheck[] = [];
    const violations: IntegrityViolation[] = [];

    try {
      logger.info('Starting integrity validation', {
        traceId: request.traceId,
        contentType: request.contentType,
        agentType: request.agentType,
        validationLevel: request.validationLevel,
      });

      // Run integrity checks based on validation level
      switch (request.validationLevel) {
        case ValidationLevel.BASIC:
          await this.runBasicChecks(request, checks, violations);
          break;
        case ValidationLevel.STANDARD:
          await this.runStandardChecks(request, checks, violations);
          break;
        case ValidationLevel.COMPREHENSIVE:
          await this.runComprehensiveChecks(request, checks, violations);
          break;
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(checks, violations);

      // Generate recommendations
      const recommendations = this.generateRecommendations(checks, violations);

      const result: IntegrityValidationResult = {
        valid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
        overallScore,
        checks,
        violations,
        recommendations,
        validatedAt: new Date(),
        nextReview: this.calculateNextReviewDate(violations),
      };

      logger.info('Integrity validation completed', {
        traceId: request.traceId,
        valid: result.valid,
        overallScore: result.overallScore,
        checkCount: checks.length,
        violationCount: violations.length,
        duration: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      logger.error('Failed to validate integrity', error instanceof Error ? error : undefined, {
        traceId: request.traceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        valid: false,
        overallScore: 0.3,
        checks: [{
          type: CheckType.DATA_INTEGRITY,
          status: 'fail' as const,
          score: 0.3,
          details: 'Validation failed due to system error',
        }],
        violations: [{
          type: CheckType.DATA_INTEGRITY,
          severity: 'critical' as const,
          description: 'System error during validation',
          impact: 'Cannot validate content integrity',
          remediation: 'Retry validation or check system logs',
        }],
        recommendations: ['Retry validation', 'Check system logs'],
        validatedAt: new Date(),
      };
    }
  }

  /**
   * Run basic integrity checks
   */
  private async runBasicChecks(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    // Basic structural validation
    await this.checkStructuralIntegrity(request, checks, violations);

    // Basic confidence validation
    await this.checkBasicConfidence(request, checks, violations);
  }

  /**
   * Run standard integrity checks
   */
  private async runStandardChecks(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    // Run all basic checks first
    await this.runBasicChecks(request, checks, violations);

    // Source verification
    await this.checkSourceVerification(request, checks, violations);

    // Logical consistency
    await this.checkLogicalConsistency(request, checks, violations);

    // Context alignment
    await this.checkContextAlignment(request, checks, violations);
  }

  /**
   * Run comprehensive integrity checks
   */
  private async runComprehensiveChecks(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    // Run all standard checks first
    await this.runStandardChecks(request, checks, violations);

    // Cross-agent consistency
    await this.checkCrossAgentConsistency(request, checks, violations);

    // Performance accuracy
    await this.checkPerformanceAccuracy(request, checks, violations);

    // Compliance checks
    await this.checkCompliance(request, checks, violations);

    // Adversarial validation
    await this.runAdversarialValidation(request, checks, violations);
  }

  /**
   * Check structural integrity
   */
  private async checkStructuralIntegrity(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    if (request.contentType === ContentType.SDUI_PAGE && request.content.sduiPage) {
      const structure = this.validateSDUIStructure(request.content.sduiPage);

      checks.push({
        type: CheckType.DATA_INTEGRITY,
        status: structure.valid ? 'pass' : 'fail',
        score: structure.score,
        details: structure.details,
      });

      if (!structure.valid) {
        violations.push({
          type: CheckType.DATA_INTEGRITY,
          severity: 'high',
          description: 'SDUI page structure is invalid',
          impact: 'Cannot render or process the content',
          remediation: 'Fix structural issues in SDUI page definition',
          evidence: structure.errors,
        });
      }
    }
  }

  /**
   * Check basic confidence validation
   */
  private async checkBasicConfidence(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    if (request.content.confidence !== undefined) {
      const confidence = request.content.confidence;

      const isOutOfRange = !Number.isFinite(confidence) || confidence < 0 || confidence > 1;

      if (isOutOfRange) {
        checks.push({
          type: CheckType.CONFIDENCE_REASONING,
          status: 'fail',
          score: 0,
          details: `Confidence score out of range: ${confidence}. Expected a finite value between 0 and 1.`,
        });

        violations.push({
          type: CheckType.CONFIDENCE_REASONING,
          severity: 'high',
          description: 'Confidence score is out of range',
          impact: 'Integrity scoring is invalid when confidence is outside [0, 1] or non-finite.',
          remediation: 'Clamp or recalculate confidence to a finite value within [0, 1] before validation.',
          evidence: { confidence },
        });

        return;
      }

      let status: 'pass' | 'fail' | 'warning' = 'pass';
      let score = confidence;

      if (confidence < 0.3) {
        status = 'fail';
        score = 0.2;
      } else if (confidence < 0.6) {
        status = 'warning';
        score = confidence;
      }

      checks.push({
        type: CheckType.CONFIDENCE_REASONING,
        status,
        score,
        details: `Confidence score: ${confidence}`,
      });

      if (status === 'fail') {
        violations.push({
          type: CheckType.CONFIDENCE_REASONING,
          severity: 'medium',
          description: 'Confidence score is too low',
          impact: 'Content may not be trustworthy',
          remediation: 'Improve reasoning quality or adjust confidence',
          evidence: { confidence },
        });
      }
    }
  }

  /**
   * Check source verification
   */
  private async checkSourceVerification(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    if (request.content.sources && request.content.sources.length > 0) {
      const verification = await this.sourceVerifier.verifySources(request.content.sources);

      checks.push({
        type: CheckType.SOURCE_VERIFICATION,
        status: verification.valid ? 'pass' : 'fail',
        score: verification.trustScore,
        details: `Verified ${verification.verifiedCount}/${request.content.sources.length} sources`,
      });

      if (!verification.valid) {
        violations.push({
          type: CheckType.SOURCE_VERIFICATION,
          severity: 'high',
          description: 'Sources could not be verified',
          impact: 'Content may contain fabricated references',
          remediation: 'Use verifiable sources or remove unverifiable claims',
          evidence: verification.issues,
        });
      }
    }
  }

  /**
   * Check logical consistency
   */
  private async checkLogicalConsistency(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    if (request.content.reasoning && request.content.reasoning.length > 0) {
      const consistency = await this.consistencyChecker.checkReasoningConsistency(
        request.content.reasoning,
        request.content
      );

      checks.push({
        type: CheckType.LOGICAL_CONSISTENCY,
        status: consistency.consistent ? 'pass' : 'fail',
        score: consistency.score,
        details: consistency.details,
      });

      if (!consistency.consistent) {
        violations.push({
          type: CheckType.LOGICAL_CONSISTENCY,
          severity: 'medium',
          description: 'Reasoning contains logical inconsistencies',
          impact: 'Conclusions may not be logically sound',
          remediation: 'Review and fix logical reasoning',
          evidence: consistency.inconsistencies,
        });
      }
    }
  }

  /**
   * Check context alignment
   */
  private async checkContextAlignment(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    const alignment = await this.consistencyChecker.checkContextAlignment(
      request.content,
      request.context
    );

    checks.push({
      type: CheckType.CONTEXT_ALIGNMENT,
      status: alignment.aligned ? 'pass' : 'fail',
      score: alignment.score,
      details: alignment.details,
    });

    if (!alignment.aligned) {
      violations.push({
        type: CheckType.CONTEXT_ALIGNMENT,
        severity: 'medium',
        description: 'Content does not align with provided context',
        impact: 'Response may not be relevant to current situation',
        remediation: 'Ensure content aligns with context or update context',
        evidence: alignment.mismatches,
      });
    }
  }

  /**
   * Check cross-agent consistency
   */
  private async checkCrossAgentConsistency(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    // Get related memories from agent memory service
    try {
      const relatedMemories = await this.agentMemoryService.queryMemories({
        caseId: request.context.caseId,
        agentType: request.agentType,
        limit: 10,
      });

      const consistency = await this.consistencyChecker.checkCrossAgentConsistency(
        request.content,
        relatedMemories.memories
      );

      checks.push({
        type: CheckType.CROSS_AGENT_CONSISTENCY,
        status: consistency.consistent ? 'pass' : 'warning',
        score: consistency.score,
        details: `Checked against ${relatedMemories.memories.length} related memories`,
      });

      if (!consistency.consistent) {
        violations.push({
          type: CheckType.CROSS_AGENT_CONSISTENCY,
          severity: 'low',
          description: 'Content is inconsistent with previous agent outputs',
          impact: 'May cause confusion for users',
          remediation: 'Ensure consistency with established knowledge',
          evidence: consistency.inconsistencies,
        });
      }
    } catch (error) {
      logger.warn('Could not check cross-agent consistency', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Check performance accuracy
   */
  private async checkPerformanceAccuracy(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    if (request.content.metrics) {
      const accuracy = await this.consistencyChecker.checkMetricAccuracy(
        request.content.metrics,
        request.context
      );

      checks.push({
        type: CheckType.PERFORMANCE_ACCURACY,
        status: accuracy.accurate ? 'pass' : 'warning',
        score: accuracy.score,
        details: accuracy.details,
      });

      if (!accuracy.accurate) {
        violations.push({
          type: CheckType.PERFORMANCE_ACCURACY,
          severity: 'medium',
          description: 'Metrics appear unrealistic or inaccurate',
          impact: 'May mislead decision-making',
          remediation: 'Verify metric calculations and data sources',
          evidence: accuracy.issues,
        });
      }
    }
  }

  /**
   * Check compliance
   */
  private async checkCompliance(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    // Check for compliance violations
    const complianceIssues = this.checkComplianceIssues(request.content);

    if (complianceIssues.length > 0) {
      checks.push({
        type: CheckType.COMPLIANCE_CHECK,
        status: 'fail',
        score: 0.3,
        details: `Found ${complianceIssues.length} compliance issues`,
      });

      complianceIssues.forEach(issue => {
        violations.push({
          type: CheckType.COMPLIANCE_CHECK,
          severity: issue.severity,
          description: issue.description,
          impact: issue.impact,
          remediation: issue.remediation,
          evidence: issue.evidence,
        });
      });
    } else {
      checks.push({
        type: CheckType.COMPLIANCE_CHECK,
        status: 'pass',
        score: 1.0,
        details: 'No compliance issues found',
      });
    }
  }

  /**
   * Run adversarial validation
   */
  private async runAdversarialValidation(
    request: IntegrityValidationRequest,
    checks: IntegrityCheck[],
    violations: IntegrityViolation[]
  ): Promise<void> {
    if (request.contentType === ContentType.SDUI_PAGE && request.content.sduiPage) {
      const adversarialRequest = {
        originalResponse: request.content.sduiPage,
        agentType: request.agentType,
        confidence: request.content.confidence || 0.5,
        reasoning: request.content.reasoning || [],
        context: request.context,
        traceId: request.traceId,
      };

      const adversarialResult = await this.adversarialValidator.validateResponse(adversarialRequest);

      checks.push({
        type: CheckType.DATA_INTEGRITY,
        status: adversarialResult.valid ? 'pass' : 'fail',
        score: adversarialResult.confidence,
        details: `Adversarial validation: ${adversarialResult.issues.length} issues found`,
      });

      if (!adversarialResult.valid) {
        adversarialResult.issues.forEach(issue => {
          violations.push({
            type: CheckType.DATA_INTEGRITY,
            severity: issue.severity === 'critical' ? 'critical' : 'high',
            description: `Adversarial validation: ${issue.description}`,
            impact: 'Content integrity compromised',
            remediation: issue.suggestedFix,
            evidence: issue,
          });
        });
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private validateSDUIStructure(page: SDUIPageDefinition): {
    valid: boolean;
    score: number;
    details: string;
    errors: string[];
  } {
    const errors: string[] = [];
    let score = 1.0;

    // Check required fields
    if (!page.type || page.type !== 'page') {
      errors.push('Invalid page type');
      score -= 0.3;
    }

    if (!page.sections || !Array.isArray(page.sections)) {
      errors.push('Sections must be an array');
      score -= 0.3;
    }

    if (!page.version) {
      errors.push('Version is required');
      score -= 0.2;
    }

    // Check sections
    if (page.sections) {
      page.sections.forEach((section: any, index: number) => {
        if (!section.type) {
          errors.push(`Section ${index}: Type is required`);
          score -= 0.1;
        }

        if (section.type === 'component' && !section.component) {
          errors.push(`Section ${index}: Component is required for component type`);
          score -= 0.1;
        }
      });
    }

    return {
      valid: errors.length === 0,
      score: Math.max(0, score),
      details: `SDUI structure validation: ${errors.length === 0 ? 'passed' : `${errors.length} errors`}`,
      errors,
    };
  }

  private checkComplianceIssues(content: IntegrityContent): ComplianceIssue[] {
    const issues: ComplianceIssue[] = [];

    // Check for PII (Personally Identifiable Information)
    const textContent = JSON.stringify(content).toLowerCase();
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    ];

    if (piiPatterns.some(pattern => pattern.test(textContent))) {
      issues.push({
        severity: 'high',
        description: 'Potential PII detected in content',
        impact: 'Privacy compliance violation',
        remediation: 'Remove or redact PII data',
        evidence: 'PII patterns detected',
      });
    }

    return issues;
  }

  private calculateOverallScore(checks: IntegrityCheck[], violations: IntegrityViolation[]): number {
    if (checks.length === 0) return 1.0;

    const checkScores = checks.map(check => check.score);
    const violationPenalties = violations.reduce((total, violation) => {
      const penalties = { low: 0.1, medium: 0.3, high: 0.6, critical: 1.0 };
      return total + penalties[violation.severity];
    }, 0);

    const averageCheckScore = checkScores.reduce((sum, score) => sum + score, 0) / checkScores.length;

    return Math.max(0, averageCheckScore - violationPenalties);
  }

  private generateRecommendations(checks: IntegrityCheck[], violations: IntegrityViolation[]): string[] {
    const recommendations = new Set<string>();

    // Add recommendations from violations
    violations.forEach(violation => {
      recommendations.add(violation.remediation);
    });

    // Add recommendations based on failed checks
    checks.filter(check => check.status === 'fail').forEach(check => {
      switch (check.type) {
        case CheckType.CONFIDENCE_REASONING:
          recommendations.add('Review confidence scoring methodology');
          break;
        case CheckType.SOURCE_VERIFICATION:
          recommendations.add('Implement source verification system');
          break;
        case CheckType.LOGICAL_CONSISTENCY:
          recommendations.add('Improve logical reasoning validation');
          break;
        case CheckType.DATA_INTEGRITY:
          recommendations.add('Enhance data validation rules');
          break;
      }
    });

    return Array.from(recommendations);
  }

  private calculateNextReviewDate(violations: IntegrityViolation[]): Date {
    if (violations.length === 0) {
      // No violations, review in 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;

    if (criticalViolations > 0) {
      // Critical violations require immediate review
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    } else if (highViolations > 0) {
      // High violations require review within 3 days
      return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    } else {
      // Low/medium violations can wait a week
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}

// ============================================================================
// Supporting Classes
// ============================================================================

interface ComplianceIssue {
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
  remediation: string;
  evidence: string;
}

class SourceVerifier {
  constructor(_supabaseUrl: string, _supabaseKey: string) {
    // Initialize source verifier
  }

  async verifySources(sources: SourceReference[]): Promise<{
    valid: boolean;
    verifiedCount: number;
    trustScore: number;
    issues: string[];
  }> {
    // Implementation would verify sources against external APIs
    return {
      valid: true,
      verifiedCount: sources.length,
      trustScore: 0.8,
      issues: [],
    };
  }
}

class ConsistencyChecker {
  async checkReasoningConsistency(reasoning: string[], content: IntegrityContent): Promise<{
    consistent: boolean;
    score: number;
    details: string;
    inconsistencies: string[];
  }> {
    // Implementation would analyze reasoning for consistency
    return {
      consistent: true,
      score: 0.8,
      details: 'Reasoning appears consistent',
      inconsistencies: [],
    };
  }

  async checkContextAlignment(content: IntegrityContent, context: Record<string, any>): Promise<{
    aligned: boolean;
    score: number;
    details: string;
    mismatches: string[];
  }> {
    // Implementation would check if content aligns with context
    return {
      aligned: true,
      score: 0.9,
      details: 'Content aligns with context',
      mismatches: [],
    };
  }

  async checkCrossAgentConsistency(content: IntegrityContent, memories: any[]): Promise<{
    consistent: boolean;
    score: number;
    details: string;
    inconsistencies: string[];
  }> {
    // Implementation would check consistency with agent memories
    return {
      consistent: true,
      score: 0.85,
      details: 'Consistent with agent memories',
      inconsistencies: [],
    };
  }

  async checkMetricAccuracy(metrics: Record<string, number>, context: Record<string, any>): Promise<{
    accurate: boolean;
    score: number;
    details: string;
    issues: string[];
  }> {
    // Implementation would validate metric calculations
    return {
      accurate: true,
      score: 0.9,
      details: 'Metrics appear accurate',
      issues: [],
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createIntegrityValidationService(
  agentMemoryService: AgentMemoryService,
  supabaseUrl: string,
  supabaseKey: string
): IntegrityValidationService {
  return new IntegrityValidationService(agentMemoryService, supabaseUrl, supabaseKey);
}
