/**
 * ValueEvalAgent - Artifact Quality Evaluation
 * 
 * Responsible for:
 * - Evaluating artifact quality
 * - Scoring completeness, accuracy, usefulness
 * - Generating improvement recommendations
 * - Supporting reinforcement learning
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { llmConfig } from '../config/llm';

export interface ImprovementSuggestion {
  category: string;
  priority: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}

export interface ScoreResult {
  overall_score: number;
  quality_score: number;
  completeness_score: number;
  accuracy_score: number;
  usefulness_score: number;
  metrics: Record<string, number | string | boolean>;
  recommendations: string[];
  improvement_suggestions: ImprovementSuggestion[];
}

export interface CustomRule {
  name: string;
  condition: (artifact: Record<string, unknown>) => boolean;
  weight: number;
  message: string;
}

export interface EvaluationCriteria {
  artifact_type: string;
  required_fields?: string[];
  quality_thresholds?: {
    excellent: number;
    good: number;
    acceptable: number;
  };
  custom_rules?: CustomRule[];
}

export class ValueEvalAgent {
  private llmGateway: LLMGateway;
  private agentName: string;

  constructor() {
    this.llmGateway = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
    this.agentName = 'ValueEvalAgent';
  }

  /**
   * Evaluate an artifact and return comprehensive scores
   */
  async evaluateArtifact(
    artifactType: string,
    artifactId: string,
    artifact: Record<string, unknown>,
    criteria?: EvaluationCriteria
  ): Promise<ScoreResult> {
    // Get evaluation criteria
    const evalCriteria = criteria || this.getDefaultCriteria(artifactType);

    // Calculate individual scores
    const completenessScore = this.evaluateCompleteness(artifact, evalCriteria);
    const accuracyScore = await this.evaluateAccuracy(artifact, evalCriteria);
    const usefulnessScore = this.evaluateUsefulness(artifact, evalCriteria);
    const qualityScore = this.evaluateQuality(artifact, evalCriteria);

    // Calculate overall score (weighted average)
    const overallScore = this.calculateOverallScore({
      completeness: completenessScore,
      accuracy: accuracyScore,
      usefulness: usefulnessScore,
      quality: qualityScore,
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      artifact,
      {
        completeness: completenessScore,
        accuracy: accuracyScore,
        usefulness: usefulnessScore,
        quality: qualityScore,
      },
      evalCriteria
    );

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(
      artifact,
      recommendations
    );

    // Calculate detailed metrics
    const metrics = this.calculateMetrics(artifact, evalCriteria);

    const result: ScoreResult = {
      overall_score: overallScore,
      quality_score: qualityScore,
      completeness_score: completenessScore,
      accuracy_score: accuracyScore,
      usefulness_score: usefulnessScore,
      metrics,
      recommendations,
      improvement_suggestions: improvementSuggestions,
    };

    // Store score in database
    await this.storeScore(artifactType, artifactId, result);

    return result;
  }

  /**
   * Evaluate completeness (0-100)
   */
  private evaluateCompleteness(
    artifact: any,
    criteria: EvaluationCriteria
  ): number {
    if (!criteria.required_fields) {
      return 100;
    }

    const totalFields = criteria.required_fields.length;
    const presentFields = criteria.required_fields.filter(
      (field) => this.hasField(artifact, field)
    ).length;

    return (presentFields / totalFields) * 100;
  }

  /**
   * Evaluate accuracy (0-100)
   */
  private async evaluateAccuracy(
    artifact: any,
    criteria: EvaluationCriteria
  ): Promise<number> {
    // Base accuracy on data consistency and validity
    let score = 100;

    // Check for data inconsistencies
    if (artifact.entities && artifact.relationships) {
      const entityIds = new Set(artifact.entities.map((e: any) => e.id));
      const invalidRelationships = artifact.relationships.filter(
        (r: any) =>
          !entityIds.has(r.source_entity_id) || !entityIds.has(r.target_entity_id)
      );

      if (invalidRelationships.length > 0) {
        score -= (invalidRelationships.length / artifact.relationships.length) * 30;
      }
    }

    // Check for logical consistency
    if (artifact.causal_chain) {
      const hasCircularDependency = this.detectCircularDependency(
        artifact.causal_chain
      );
      if (hasCircularDependency) {
        score -= 20;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Evaluate usefulness (0-100)
   */
  private evaluateUsefulness(
    artifact: any,
    criteria: EvaluationCriteria
  ): number {
    let score = 50; // Base score

    // Higher score if artifact has actionable insights
    if (artifact.recommendations || artifact.leverage_points) {
      score += 20;
    }

    // Higher score if artifact has clear outcomes
    if (artifact.outcome_hypotheses || artifact.expected_impact) {
      score += 15;
    }

    // Higher score if artifact has measurable metrics
    if (artifact.kpi_mappings || artifact.success_criteria) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Evaluate quality (0-100)
   */
  private evaluateQuality(
    artifact: any,
    criteria: EvaluationCriteria
  ): number {
    let score = 70; // Base quality score

    // Check for detailed descriptions
    if (artifact.description && artifact.description.length > 100) {
      score += 10;
    }

    // Check for reasoning/rationale
    if (artifact.reasoning || artifact.rationale) {
      score += 10;
    }

    // Check for confidence scores
    if (artifact.confidence_score !== undefined) {
      score += 5;
    }

    // Check for metadata
    if (artifact.metadata && Object.keys(artifact.metadata).length > 0) {
      score += 5;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate overall score (weighted average)
   */
  private calculateOverallScore(scores: {
    completeness: number;
    accuracy: number;
    usefulness: number;
    quality: number;
  }): number {
    const weights = {
      completeness: 0.25,
      accuracy: 0.35,
      usefulness: 0.25,
      quality: 0.15,
    };

    return (
      scores.completeness * weights.completeness +
      scores.accuracy * weights.accuracy +
      scores.usefulness * weights.usefulness +
      scores.quality * weights.quality
    );
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    artifact: any,
    scores: Record<string, number>,
    criteria: EvaluationCriteria
  ): string[] {
    const recommendations: string[] = [];

    if (scores.completeness < 80) {
      recommendations.push('Add missing required fields to improve completeness');
    }

    if (scores.accuracy < 80) {
      recommendations.push('Review data consistency and fix any logical errors');
    }

    if (scores.usefulness < 70) {
      recommendations.push('Add more actionable insights and clear outcomes');
    }

    if (scores.quality < 70) {
      recommendations.push('Enhance descriptions and provide more detailed reasoning');
    }

    // Artifact-specific recommendations
    if (criteria.artifact_type === 'system_map') {
      if (!artifact.leverage_points || artifact.leverage_points.length === 0) {
        recommendations.push('Identify and document leverage points in the system');
      }
    }

    if (criteria.artifact_type === 'intervention_point') {
      if (!artifact.intervention_sequence) {
        recommendations.push('Define a clear implementation sequence');
      }
    }

    return recommendations;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(
    artifact: any,
    recommendations: string[]
  ): any[] {
    return recommendations.map((rec, index) => ({
      id: `suggestion-${index}`,
      recommendation: rec,
      priority: index < 2 ? 'high' : 'medium',
      estimated_impact: index < 2 ? 'high' : 'medium',
    }));
  }

  /**
   * Calculate detailed metrics
   */
  private calculateMetrics(
    artifact: any,
    criteria: EvaluationCriteria
  ): Record<string, any> {
    const metrics: Record<string, any> = {};

    // Count various elements
    if (artifact.entities) {
      metrics.entity_count = artifact.entities.length;
    }

    if (artifact.relationships) {
      metrics.relationship_count = artifact.relationships.length;
    }

    if (artifact.leverage_points) {
      metrics.leverage_point_count = artifact.leverage_points.length;
    }

    // Calculate complexity
    metrics.complexity_score = this.calculateComplexity(artifact);

    // Calculate confidence
    if (artifact.confidence_score !== undefined) {
      metrics.confidence = artifact.confidence_score;
    }

    return metrics;
  }

  /**
   * Calculate artifact complexity
   */
  private calculateComplexity(artifact: any): number {
    let complexity = 0;

    if (artifact.entities) {
      complexity += artifact.entities.length * 0.1;
    }

    if (artifact.relationships) {
      complexity += artifact.relationships.length * 0.15;
    }

    if (artifact.causal_chain) {
      complexity += artifact.causal_chain.length * 0.2;
    }

    return Math.min(complexity, 1);
  }

  /**
   * Store score in database
   */
  private async storeScore(
    artifactType: string,
    artifactId: string,
    result: ScoreResult
  ): Promise<void> {
    try {
      await supabase.rpc('store_artifact_score', {
        p_artifact_type: artifactType,
        p_artifact_id: artifactId,
        p_overall_score: result.overall_score,
        p_quality_score: result.quality_score,
        p_completeness_score: result.completeness_score,
        p_accuracy_score: result.accuracy_score,
        p_usefulness_score: result.usefulness_score,
        p_evaluator_type: 'agent',
        p_evaluator_id: this.agentName,
        p_recommendations: result.recommendations,
        p_metrics: result.metrics,
      });
    } catch (error) {
      logger.error('Failed to store artifact score', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get default evaluation criteria for artifact type
   */
  private getDefaultCriteria(artifactType: string): EvaluationCriteria {
    const criteriaMap: Record<string, EvaluationCriteria> = {
      system_map: {
        artifact_type: 'system_map',
        required_fields: ['entities', 'relationships', 'map_name'],
        quality_thresholds: { excellent: 90, good: 75, acceptable: 60 },
      },
      intervention_point: {
        artifact_type: 'intervention_point',
        required_fields: [
          'intervention_description',
          'expected_impact',
          'intervention_type',
        ],
        quality_thresholds: { excellent: 85, good: 70, acceptable: 55 },
      },
      outcome_hypothesis: {
        artifact_type: 'outcome_hypothesis',
        required_fields: ['hypothesis_statement', 'causal_chain', 'success_criteria'],
        quality_thresholds: { excellent: 90, good: 75, acceptable: 60 },
      },
      feedback_loop: {
        artifact_type: 'feedback_loop',
        required_fields: ['loop_type', 'trigger_conditions', 'monitored_behaviors'],
        quality_thresholds: { excellent: 85, good: 70, acceptable: 55 },
      },
    };

    return (
      criteriaMap[artifactType] || {
        artifact_type: artifactType,
        quality_thresholds: { excellent: 85, good: 70, acceptable: 55 },
      }
    );
  }

  /**
   * Helper: Check if artifact has a field (supports nested paths)
   */
  private hasField(obj: any, path: string): boolean {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        return false;
      }
      current = current[part];
    }

    return current !== null && current !== undefined;
  }

  /**
   * Helper: Detect circular dependencies in causal chain
   */
  private detectCircularDependency(causalChain: any[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: any): boolean => {
      if (!node || !node.id) return false;

      if (recursionStack.has(node.id)) return true;
      if (visited.has(node.id)) return false;

      visited.add(node.id);
      recursionStack.add(node.id);

      if (node.next) {
        if (hasCycle(node.next)) return true;
      }

      recursionStack.delete(node.id);
      return false;
    };

    for (const node of causalChain) {
      if (hasCycle(node)) return true;
    }

    return false;
  }

  /**
   * Get artifact score from database
   */
  async getArtifactScore(
    artifactType: string,
    artifactId: string
  ): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_artifact_score', {
        p_artifact_type: artifactType,
        p_artifact_id: artifactId,
      })
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get statistics for artifact type
   */
  async getArtifactTypeStats(artifactType: string): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_artifact_type_stats', {
        p_artifact_type: artifactType,
      })
      .single();

    if (error) throw error;
    return data;
  }
}

export default ValueEvalAgent;
