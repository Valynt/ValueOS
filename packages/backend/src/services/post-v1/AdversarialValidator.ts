/**
 * Adversarial Validation Service
 *
 * Implements adversarial challenge-response validation for AI-generated content.
 * Critical for detecting hallucinated structures and ensuring output integrity.
 *
 * Responsibilities:
 * - Challenge AI responses with adversarial prompts
 * - Validate logical consistency and reasoning
 * - Detect hallucinated sources and fabricated data
 * - Provide confidence-reasoning mismatch detection
 */

import { SDUIPageDefinition } from '@valueos/sdui';

import { llmConfig } from '../config/llm.js'
import { LLMGateway } from '../../lib/agent-fabric/LLMGateway';
import { logger } from '../../lib/logger.js'


// ============================================================================
// Types
// ============================================================================

export interface AdversarialValidationRequest {
  originalResponse: SDUIPageDefinition;
  agentType: string;
  confidence: number;
  reasoning: string[];
  context: Record<string, any>;
  traceId: string;
}

export interface ValidationResult {
  valid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  recommendations: string[];
  adversarialScore: number;
  validatedAt: Date;
}

export interface ValidationIssue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string;
  suggestedFix: string;
}

export enum IssueType {
  HALLUCINATED_STRUCTURE = 'hallucinated_structure',
  INCONSISTENT_REASONING = 'inconsistent_reasoning',
  FABRICATED_SOURCES = 'fabricated_sources',
  CONFIDENCE_MISMATCH = 'confidence_mismatch',
  LOGICAL_CONTRADICTION = 'logical_contradiction',
  UNVERIFIABLE_CLAIMS = 'unverifiable_claims',
  SUSPICIOUS_METRICS = 'suspicious_metrics',
  CONTEXT_MISMATCH = 'context_mismatch',
}

export interface ChallengePrompt {
  id: string;
  type: ChallengeType;
  prompt: string;
  expectedResponses: string[];
  validationCriteria: ValidationCriteria;
}

export enum ChallengeType {
  STRUCTURAL_VALIDATION = 'structural_validation',
  REASONING_ANALYSIS = 'reasoning_analysis',
  SOURCE_VERIFICATION = 'source_verification',
  LOGICAL_CONSISTENCY = 'logical_consistency',
  METRIC_VERIFICATION = 'metric_verification',
}

export interface ValidationCriteria {
  minConfidence: number;
  requiredElements: string[];
  forbiddenPatterns: string[];
  consistencyChecks: string[];
}

// ============================================================================
// Adversarial Validator
// ============================================================================

export class AdversarialValidator {
  private llm: LLMGateway;
  private challengePrompts: Map<ChallengeType, ChallengePrompt[]>;

  constructor() {
    this.llm = createLLMGateway();
    this.initializeChallengePrompts();
  }

  /**
   * Validate AI response with adversarial challenges
   */
  async validateResponse(request: AdversarialValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];
    let totalConfidence = request.confidence;

    try {
      logger.info('Starting adversarial validation', {
        traceId: request.traceId,
        agentType: request.agentType,
        originalConfidence: request.confidence,
      });

      // Run all challenge types
      const challenges = [
        await this.challengeStructuralValidation(request),
        await this.challengeReasoningAnalysis(request),
        await this.challengeSourceVerification(request),
        await this.challengeLogicalConsistency(request),
        await this.challengeMetricVerification(request),
      ];

      // Collect issues from all challenges
      challenges.forEach(challenge => {
        issues.push(...challenge.issues);
        totalConfidence = Math.min(totalConfidence, challenge.confidence);
      });

      // Calculate adversarial score
      const adversarialScore = this.calculateAdversarialScore(issues);

      // Generate recommendations
      const recommendations = this.generateRecommendations(issues);

      const validationResult: ValidationResult = {
        valid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
        confidence: totalConfidence,
        issues,
        recommendations,
        adversarialScore,
        validatedAt: new Date(),
      };

      logger.info('Adversarial validation completed', {
        traceId: request.traceId,
        valid: validationResult.valid,
        issueCount: issues.length,
        finalConfidence: totalConfidence,
        adversarialScore,
        duration: Date.now() - startTime,
      });

      return validationResult;

    } catch (error) {
      logger.error('Adversarial validation failed', error instanceof Error ? error : undefined, {
        traceId: request.traceId,
      });

      return {
        valid: false,
        confidence: 0,
        issues: [{
          type: IssueType.LOGICAL_CONTRADICTION,
          severity: 'critical',
          description: 'Validation system error',
          evidence: error instanceof Error ? error.message : 'Unknown error',
          suggestedFix: 'Retry validation or check system logs',
        }],
        recommendations: ['Retry validation', 'Check system logs'],
        adversarialScore: 1.0,
        validatedAt: new Date(),
      };
    }
  }

  /**
   * Challenge structural validation
   */
  private async challengeStructuralValidation(
    request: AdversarialValidationRequest
  ): Promise<{ issues: ValidationIssue[]; confidence: number }> {
    const issues: ValidationIssue[] = [];
    const prompt = this.buildStructuralChallenge(request.originalResponse);

    try {
      const response = await this.llm.generate(prompt);
      const analysis = this.parseStructuralResponse(response);

      // Check for hallucinated structures
      if (analysis.hallucinatedComponents.length > 0) {
        issues.push({
          type: IssueType.HALLUCINATED_STRUCTURE,
          severity: 'high',
          description: 'Response contains hallucinated component structures',
          evidence: `Hallucinated components: ${analysis.hallucinatedComponents.join(', ')}`,
          suggestedFix: 'Remove hallucinated components or use valid component types',
        });
      }

      // Check structural consistency
      if (!analysis.structurallyConsistent) {
        issues.push({
          type: IssueType.INCONSISTENT_REASONING,
          severity: 'medium',
          description: 'Response structure is inconsistent',
          evidence: analysis.inconsistencyReason,
          suggestedFix: 'Ensure consistent component hierarchy and data flow',
        });
      }

      return {
        issues,
        confidence: analysis.confidence,
      };

    } catch (error) {
      logger.error('Structural validation challenge failed', error instanceof Error ? error : undefined);
      return {
        issues: [{
          type: IssueType.LOGICAL_CONTRADICTION,
          severity: 'medium',
          description: 'Structural validation could not be completed',
          evidence: error instanceof Error ? error.message : 'Unknown error',
          suggestedFix: 'Retry validation or check LLM availability',
        }],
        confidence: 0.5,
      };
    }
  }

  /**
   * Challenge reasoning analysis
   */
  private async challengeReasoningAnalysis(
    request: AdversarialValidationRequest
  ): Promise<{ issues: ValidationIssue[]; confidence: number }> {
    const issues: ValidationIssue[] = [];
    const prompt = this.buildReasoningChallenge(request.originalResponse, request.reasoning);

    try {
      const response = await this.llm.generate(prompt);
      const analysis = this.parseReasoningResponse(response);

      // Check confidence-reasoning mismatch
      if (analysis.reasoningQuality < request.confidence - 0.3) {
        issues.push({
          type: IssueType.CONFIDENCE_MISMATCH,
          severity: 'high',
          description: 'Confidence score does not match reasoning quality',
          evidence: `Confidence: ${request.confidence}, Reasoning Quality: ${analysis.reasoningQuality}`,
          suggestedFix: 'Adjust confidence to match reasoning quality or improve reasoning',
        });
      }

      // Check logical contradictions
      if (analysis.contradictions.length > 0) {
        issues.push({
          type: IssueType.LOGICAL_CONTRADICTION,
          severity: 'medium',
          description: 'Response contains logical contradictions',
          evidence: `Contradictions: ${analysis.contradictions.join(', ')}`,
          suggestedFix: 'Resolve logical contradictions in reasoning',
        });
      }

      return {
        issues,
        confidence: analysis.confidence,
      };

    } catch (error) {
      logger.error('Reasoning analysis challenge failed', error instanceof Error ? error : undefined);
      return {
        issues: [{
          type: IssueType.INCONSISTENT_REASONING,
          severity: 'medium',
          description: 'Reasoning analysis could not be completed',
          evidence: error instanceof Error ? error.message : 'Unknown error',
          suggestedFix: 'Retry validation or check LLM availability',
        }],
        confidence: 0.5,
      };
    }
  }

  /**
   * Challenge source verification
   */
  private async challengeSourceVerification(
    request: AdversarialValidationRequest
  ): Promise<{ issues: ValidationIssue[]; confidence: number }> {
    const issues: ValidationIssue[] = [];
    const prompt = this.buildSourceChallenge(request.originalResponse);

    try {
      const response = await this.llm.generate(prompt);
      const analysis = this.parseSourceResponse(response);

      // Check for fabricated sources
      if (analysis.fabricatedSources.length > 0) {
        issues.push({
          type: IssueType.FABRICATED_SOURCES,
          severity: 'critical',
          description: 'Response contains fabricated or unverifiable sources',
          evidence: `Fabricated sources: ${analysis.fabricatedSources.join(', ')}`,
          suggestedFix: 'Remove fabricated sources or use verifiable references',
        });
      }

      // Check for unverifiable claims
      if (analysis.unverifiableClaims.length > 0) {
        issues.push({
          type: IssueType.UNVERIFIABLE_CLAIMS,
          severity: 'medium',
          description: 'Response contains unverifiable claims',
          evidence: `Unverifiable claims: ${analysis.unverifiableClaims.join(', ')}`,
          suggestedFix: 'Add verifiable evidence or remove unverifiable claims',
        });
      }

      return {
        issues,
        confidence: analysis.confidence,
      };

    } catch (error) {
      logger.error('Source verification challenge failed', error instanceof Error ? error : undefined);
      return {
        issues: [{
          type: IssueType.FABRICATED_SOURCES,
          severity: 'medium',
          description: 'Source verification could not be completed',
          evidence: error instanceof Error ? error.message : 'Unknown error',
          suggestedFix: 'Retry validation or check LLM availability',
        }],
        confidence: 0.5,
      };
    }
  }

  /**
   * Challenge logical consistency
   */
  private async challengeLogicalConsistency(
    request: AdversarialValidationRequest
  ): Promise<{ issues: ValidationIssue[]; confidence: number }> {
    const issues: ValidationIssue[] = [];
    const prompt = this.buildConsistencyChallenge(request.originalResponse, request.context);

    try {
      const response = await this.llm.generate(prompt);
      const analysis = this.parseConsistencyResponse(response);

      // Check for context mismatch
      if (analysis.contextMismatch) {
        issues.push({
          type: IssueType.CONTEXT_MISMATCH,
          severity: 'medium',
          description: 'Response does not match provided context',
          evidence: analysis.mismatchReason,
          suggestedFix: 'Ensure response aligns with provided context',
        });
      }

      // Check for logical flow issues
      if (analysis.logicalFlowIssues.length > 0) {
        issues.push({
          type: IssueType.LOGICAL_CONTRADICTION,
          severity: 'medium',
          description: 'Response has logical flow issues',
          evidence: `Flow issues: ${analysis.logicalFlowIssues.join(', ')}`,
          suggestedFix: 'Improve logical flow and reasoning consistency',
        });
      }

      return {
        issues,
        confidence: analysis.confidence,
      };

    } catch (error) {
      logger.error('Logical consistency challenge failed', error instanceof Error ? error : undefined);
      return {
        issues: [{
          type: IssueType.LOGICAL_CONTRADICTION,
          severity: 'medium',
          description: 'Logical consistency check could not be completed',
          evidence: error instanceof Error ? error.message : 'Unknown error',
          suggestedFix: 'Retry validation or check LLM availability',
        }],
        confidence: 0.5,
      };
    }
  }

  /**
   * Challenge metric verification
   */
  private async challengeMetricVerification(
    request: AdversarialValidationRequest
  ): Promise<{ issues: ValidationIssue[]; confidence: number }> {
    const issues: ValidationIssue[] = [];
    const prompt = this.buildMetricChallenge(request.originalResponse);

    try {
      const response = await this.llm.generate(prompt);
      const analysis = this.parseMetricResponse(response);

      // Check for suspicious metrics
      if (analysis.suspiciousMetrics.length > 0) {
        issues.push({
          type: IssueType.SUSPICIOUS_METRICS,
          severity: 'high',
          description: 'Response contains suspicious or unrealistic metrics',
          evidence: `Suspicious metrics: ${analysis.suspiciousMetrics.join(', ')}`,
          suggestedFix: 'Verify metric calculations or provide realistic values',
        });
      }

      return {
        issues,
        confidence: analysis.confidence,
      };

    } catch (error) {
      logger.error('Metric verification challenge failed', error instanceof Error ? error : undefined);
      return {
        issues: [{
          type: IssueType.SUSPICIOUS_METRICS,
          severity: 'medium',
          description: 'Metric verification could not be completed',
          evidence: error instanceof Error ? error.message : 'Unknown error',
          suggestedFix: 'Retry validation or check LLM availability',
        }],
        confidence: 0.5,
      };
    }
  }

  // ============================================================================
  // Challenge Prompt Builders
  // ============================================================================

  private buildStructuralChallenge(response: SDUIPageDefinition): string {
    return `You are an expert in SDUI (Server-Driven UI) structure validation.

Analyze the following SDUI response for structural integrity:

${JSON.stringify(response, null, 2)}

Focus on:
1. Are all component types valid and recognized?
2. Is the component hierarchy logically consistent?
3. Are there any hallucinated or made-up components?
4. Is the data flow between components coherent?

Respond with JSON format:
{
  "hallucinatedComponents": ["component1", "component2"],
  "structurallyConsistent": true,
  "inconsistencyReason": "description if inconsistent",
  "confidence": 0.85
}`;
  }

  private buildReasoningChallenge(response: SDUIPageDefinition, reasoning: string[]): string {
    return `You are an expert in logical reasoning analysis.

Analyze the reasoning behind this SDUI response:

Response: ${JSON.stringify(response, null, 2)}
Reasoning: ${reasoning.join(', ')}

Focus on:
1. Does the confidence score match the reasoning quality?
2. Are there any logical contradictions?
3. Is the reasoning sound and well-supported?
4. Are conclusions logically derived from premises?

Respond with JSON format:
{
  "reasoningQuality": 0.75,
  "contradictions": ["contradiction1", "contradiction2"],
  "confidence": 0.80
}`;
  }

  private buildSourceChallenge(response: SDUIPageDefinition): string {
    return `You are an expert in fact-checking and source verification.

Analyze the sources and claims in this SDUI response:

${JSON.stringify(response, null, 2)}

Focus on:
1. Are all cited sources real and verifiable?
2. Are there any fabricated or made-up references?
3. Are claims supported by evidence?
4. Are URLs and references valid?

Respond with JSON format:
{
  "fabricatedSources": ["source1", "source2"],
  "unverifiableClaims": ["claim1", "claim2"],
  "confidence": 0.90
}`;
  }

  private buildConsistencyChallenge(response: SDUIPageDefinition, context: Record<string, any>): string {
    return `You are an expert in logical consistency analysis.

Analyze this SDUI response for consistency with the provided context:

Response: ${JSON.stringify(response, null, 2)}
Context: ${JSON.stringify(context, null, 2)}

Focus on:
1. Does the response align with the provided context?
2. Are there logical inconsistencies?
3. Is the flow of reasoning coherent?
4. Are conclusions contextually appropriate?

Respond with JSON format:
{
  "contextMismatch": false,
  "mismatchReason": "description if mismatched",
  "logicalFlowIssues": ["issue1", "issue2"],
  "confidence": 0.85
}`;
  }

  private buildMetricChallenge(response: SDUIPageDefinition): string {
    return `You are an expert in data analysis and metric validation.

Analyze the metrics and data in this SDUI response:

${JSON.stringify(response, null, 2)}

Focus on:
1. Are the metrics realistic and plausible?
2. Are calculations mathematically sound?
3. Are there any suspicious or made-up numbers?
4. Do metrics align with business logic?

Respond with JSON format:
{
  "suspiciousMetrics": ["metric1", "metric2"],
  "calculationErrors": ["error1", "error2"],
  "confidence": 0.80
}`;
  }

  // ============================================================================
  // Response Parsers
  // ============================================================================

  private parseStructuralResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse structural response', error instanceof Error ? error : undefined);
      return {
        hallucinatedComponents: [],
        structurallyConsistent: false,
        inconsistencyReason: 'Parse error',
        confidence: 0.5,
      };
    }
  }

  private parseReasoningResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse reasoning response', error instanceof Error ? error : undefined);
      return {
        reasoningQuality: 0.5,
        contradictions: [],
        confidence: 0.5,
      };
    }
  }

  private parseSourceResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse source response', error instanceof Error ? error : undefined);
      return {
        fabricatedSources: [],
        unverifiableClaims: [],
        confidence: 0.5,
      };
    }
  }

  private parseConsistencyResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse consistency response', error instanceof Error ? error : undefined);
      return {
        contextMismatch: false,
        mismatchReason: 'Parse error',
        logicalFlowIssues: [],
        confidence: 0.5,
      };
    }
  }

  private parseMetricResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse metric response', error instanceof Error ? error : undefined);
      return {
        suspiciousMetrics: [],
        calculationErrors: [],
        confidence: 0.5,
      };
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private calculateAdversarialScore(issues: ValidationIssue[]): number {
    if (issues.length === 0) return 0.0;

    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0,
    };

    return issues.reduce((score, issue) => {
      return score + severityWeights[issue.severity];
    }, 0) / issues.length;
  }

  private generateRecommendations(issues: ValidationIssue[]): string[] {
    const recommendations = new Set<string>();

    issues.forEach(issue => {
      recommendations.add(issue.suggestedFix);
    });

    // Add general recommendations based on issue types
    const issueTypes = new Set(issues.map(i => i.type));

    if (issueTypes.has(IssueType.CONFIDENCE_MISMATCH)) {
      recommendations.add('Review confidence scoring methodology');
    }

    if (issueTypes.has(IssueType.HALLUCINATED_STRUCTURE)) {
      recommendations.add('Validate component types against registry');
    }

    if (issueTypes.has(IssueType.FABRICATED_SOURCES)) {
      recommendations.add('Implement source verification system');
    }

    return Array.from(recommendations);
  }

  private initializeChallengePrompts(): void {
    // Initialize challenge prompts (could be loaded from config)
    this.challengePrompts = new Map();
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createAdversarialValidator(): AdversarialValidator {
  return new AdversarialValidator();
}
