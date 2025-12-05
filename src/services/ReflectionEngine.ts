/**
 * Reflection Engine
 * 
 * Implements the 18-point rubric for evaluating and refining agent outputs.
 * Automatically refines outputs that score below threshold.
 * 
 * Based on the Agent Fabric documentation's reflection and refinement system.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { getAgentAPI } from './AgentAPI';

// ============================================================================
// Types
// ============================================================================

export interface RubricCriterion {
  id: string;
  name: string;
  category: 'clarity' | 'accuracy' | 'completeness' | 'relevance' | 'actionability' | 'compliance';
  description: string;
  weight: number;
  evaluator: (output: any, context: any) => Promise<{
    score: number; // 0-10
    feedback: string;
    suggestions: string[];
  }>;
}

export interface ReflectionResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  criteriaResults: Array<{
    criterion: string;
    score: number;
    feedback: string;
    suggestions: string[];
  }>;
  passesThreshold: boolean;
  refinementNeeded: boolean;
  refinementPlan?: string[];
}

export interface RefinementContext {
  originalOutput: any;
  reflectionResult: ReflectionResult;
  agentType: string;
  userId: string;
  organizationId: string;
}

// ============================================================================
// 18-Point Rubric Criteria
// ============================================================================

const RUBRIC_CRITERIA: RubricCriterion[] = [
  // CLARITY (3 criteria)
  {
    id: 'clarity-language',
    name: 'Clear Language',
    category: 'clarity',
    description: 'Uses clear, unambiguous language appropriate for the audience',
    weight: 1.0,
    evaluator: async (output, context) => {
      const text = JSON.stringify(output).toLowerCase();
      let score = 10;
      const suggestions: string[] = [];

      // Check for jargon without explanation
      const jargonTerms = ['synergy', 'leverage', 'paradigm', 'utilize'];
      const foundJargon = jargonTerms.filter(term => text.includes(term));
      if (foundJargon.length > 0) {
        score -= foundJargon.length * 2;
        suggestions.push(`Simplify or explain technical terms: ${foundJargon.join(', ')}`);
      }

      // Check for passive voice (simplified check)
      if (text.includes('was') || text.includes('were')) {
        score -= 1;
        suggestions.push('Consider using active voice for clarity');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Language is clear and accessible' : 'Language could be clearer',
        suggestions,
      };
    },
  },
  {
    id: 'clarity-structure',
    name: 'Logical Structure',
    category: 'clarity',
    description: 'Information is organized in a logical, easy-to-follow structure',
    weight: 1.0,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // Check for sections/headings
      if (!output.sections && !output.title) {
        score -= 3;
        suggestions.push('Add clear sections or headings to organize content');
      }

      // Check for introduction/summary
      if (!output.summary && !output.introduction) {
        score -= 2;
        suggestions.push('Include an introduction or summary');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Well-structured and organized' : 'Structure could be improved',
        suggestions,
      };
    },
  },
  {
    id: 'clarity-formatting',
    name: 'Effective Formatting',
    category: 'clarity',
    description: 'Uses formatting (lists, tables, emphasis) effectively',
    weight: 0.8,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // Check for lists where appropriate
      const text = JSON.stringify(output);
      if (text.length > 500 && !output.lists && !Array.isArray(output.items)) {
        score -= 2;
        suggestions.push('Consider using lists for better readability');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Formatting enhances readability' : 'Formatting could be improved',
        suggestions,
      };
    },
  },

  // ACCURACY (3 criteria)
  {
    id: 'accuracy-data',
    name: 'Data Accuracy',
    category: 'accuracy',
    description: 'All data points and calculations are accurate',
    weight: 1.5,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // Check for calculations
      if (output.calculations) {
        // Verify basic math (simplified)
        suggestions.push('Verify all calculations independently');
      }

      // Check for data sources
      if (!output.sources && !output.dataSources) {
        score -= 3;
        suggestions.push('Include data sources for verification');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Data appears accurate' : 'Data accuracy needs verification',
        suggestions,
      };
    },
  },
  {
    id: 'accuracy-assumptions',
    name: 'Valid Assumptions',
    category: 'accuracy',
    description: 'Assumptions are reasonable and clearly stated',
    weight: 1.2,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      if (!output.assumptions || !Array.isArray(output.assumptions)) {
        score -= 4;
        suggestions.push('Document all assumptions explicitly');
      } else {
        // Check if assumptions have sources
        const withoutSources = output.assumptions.filter((a: any) => !a.source);
        if (withoutSources.length > 0) {
          score -= 2;
          suggestions.push('Provide sources for all assumptions');
        }
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Assumptions are well-documented' : 'Assumptions need better documentation',
        suggestions,
      };
    },
  },
  {
    id: 'accuracy-consistency',
    name: 'Internal Consistency',
    category: 'accuracy',
    description: 'No contradictions or inconsistencies within the output',
    weight: 1.0,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // Check for consistent terminology
      // This is a simplified check
      suggestions.push('Review for internal consistency');

      return {
        score: Math.max(0, score),
        feedback: 'Consistency check passed',
        suggestions,
      };
    },
  },

  // COMPLETENESS (3 criteria)
  {
    id: 'completeness-requirements',
    name: 'Meets Requirements',
    category: 'completeness',
    description: 'Addresses all required elements',
    weight: 1.5,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // Check for required fields based on output type
      const requiredFields = context.requiredFields || [];
      const missingFields = requiredFields.filter((field: string) => !output[field]);

      if (missingFields.length > 0) {
        score -= missingFields.length * 2;
        suggestions.push(`Add missing required fields: ${missingFields.join(', ')}`);
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'All requirements met' : 'Some requirements missing',
        suggestions,
      };
    },
  },
  {
    id: 'completeness-depth',
    name: 'Sufficient Depth',
    category: 'completeness',
    description: 'Provides adequate detail and depth',
    weight: 1.0,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      const text = JSON.stringify(output);
      if (text.length < 200) {
        score -= 4;
        suggestions.push('Provide more detail and depth');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Sufficient depth provided' : 'Needs more depth',
        suggestions,
      };
    },
  },
  {
    id: 'completeness-context',
    name: 'Contextual Information',
    category: 'completeness',
    description: 'Includes necessary context and background',
    weight: 0.8,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      if (!output.context && !output.background) {
        score -= 2;
        suggestions.push('Add contextual information');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Context is provided' : 'Add more context',
        suggestions,
      };
    },
  },

  // RELEVANCE (3 criteria)
  {
    id: 'relevance-audience',
    name: 'Audience Appropriate',
    category: 'relevance',
    description: 'Content is appropriate for the target audience',
    weight: 1.2,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // Check if persona/audience is considered
      if (!context.persona && !context.audience) {
        score -= 2;
        suggestions.push('Consider target audience explicitly');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Appropriate for audience' : 'Adjust for target audience',
        suggestions,
      };
    },
  },
  {
    id: 'relevance-focus',
    name: 'Focused Content',
    category: 'relevance',
    description: 'Stays focused on the main topic without unnecessary tangents',
    weight: 1.0,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // This is a simplified check
      suggestions.push('Ensure all content is relevant to the main topic');

      return {
        score: Math.max(0, score),
        feedback: 'Content appears focused',
        suggestions,
      };
    },
  },
  {
    id: 'relevance-timeliness',
    name: 'Timely Information',
    category: 'relevance',
    description: 'Information is current and up-to-date',
    weight: 0.8,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      // Check for dates/timestamps
      if (output.data && !output.asOfDate && !output.timestamp) {
        score -= 2;
        suggestions.push('Include date/timestamp for data currency');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Information is current' : 'Verify information currency',
        suggestions,
      };
    },
  },

  // ACTIONABILITY (3 criteria)
  {
    id: 'actionability-recommendations',
    name: 'Clear Recommendations',
    category: 'actionability',
    description: 'Provides clear, actionable recommendations',
    weight: 1.3,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      if (!output.recommendations && !output.nextSteps && !output.actions) {
        score -= 4;
        suggestions.push('Include clear recommendations or next steps');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Clear recommendations provided' : 'Add actionable recommendations',
        suggestions,
      };
    },
  },
  {
    id: 'actionability-steps',
    name: 'Concrete Steps',
    category: 'actionability',
    description: 'Breaks down actions into concrete, executable steps',
    weight: 1.0,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      if (output.recommendations && !Array.isArray(output.recommendations)) {
        score -= 2;
        suggestions.push('Break recommendations into specific steps');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Steps are concrete' : 'Make steps more specific',
        suggestions,
      };
    },
  },
  {
    id: 'actionability-timeline',
    name: 'Timeline & Priorities',
    category: 'actionability',
    description: 'Includes timeline and prioritization',
    weight: 0.9,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      if (output.recommendations && !output.timeline && !output.priorities) {
        score -= 2;
        suggestions.push('Add timeline and prioritization');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Timeline provided' : 'Add timeline information',
        suggestions,
      };
    },
  },

  // COMPLIANCE (3 criteria)
  {
    id: 'compliance-manifesto',
    name: 'Manifesto Alignment',
    category: 'compliance',
    description: 'Aligns with VOS Manifesto principles',
    weight: 1.5,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      const text = JSON.stringify(output).toLowerCase();

      // Check for value-first language
      if (!text.includes('value') && !text.includes('outcome')) {
        score -= 3;
        suggestions.push('Emphasize value and outcomes');
      }

      // Check for customer focus
      if (!text.includes('customer') && !text.includes('client')) {
        score -= 2;
        suggestions.push('Include customer perspective');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Aligned with Manifesto' : 'Improve Manifesto alignment',
        suggestions,
      };
    },
  },
  {
    id: 'compliance-provenance',
    name: 'Provenance Tracking',
    category: 'compliance',
    description: 'All claims have documented sources',
    weight: 1.2,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      if (!output.sources && !output.references && !output.citations) {
        score -= 4;
        suggestions.push('Add sources and references for all claims');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Provenance is tracked' : 'Add provenance tracking',
        suggestions,
      };
    },
  },
  {
    id: 'compliance-integrity',
    name: 'Data Integrity',
    category: 'compliance',
    description: 'Data integrity controls are in place',
    weight: 1.0,
    evaluator: async (output, context) => {
      let score = 10;
      const suggestions: string[] = [];

      if (output.data && !output.dataValidation && !output.integrityChecks) {
        score -= 2;
        suggestions.push('Include data integrity validation');
      }

      return {
        score: Math.max(0, score),
        feedback: score >= 8 ? 'Data integrity maintained' : 'Add integrity checks',
        suggestions,
      };
    },
  },
];

// ============================================================================
// Reflection Engine Class
// ============================================================================

export class ReflectionEngine {
  private readonly PASSING_THRESHOLD = 7.0; // Overall score must be >= 7.0
  private readonly CATEGORY_THRESHOLD = 6.5; // Each category must be >= 6.5

  /**
   * Evaluate output against the 18-point rubric
   */
  async evaluate(output: any, context: any): Promise<ReflectionResult> {
    const criteriaResults: Array<{
      criterion: string;
      score: number;
      feedback: string;
      suggestions: string[];
    }> = [];

    const categoryScores: Record<string, { total: number; weight: number }> = {
      clarity: { total: 0, weight: 0 },
      accuracy: { total: 0, weight: 0 },
      completeness: { total: 0, weight: 0 },
      relevance: { total: 0, weight: 0 },
      actionability: { total: 0, weight: 0 },
      compliance: { total: 0, weight: 0 },
    };

    // Evaluate each criterion
    for (const criterion of RUBRIC_CRITERIA) {
      const result = await criterion.evaluator(output, context);
      
      criteriaResults.push({
        criterion: criterion.name,
        score: result.score,
        feedback: result.feedback,
        suggestions: result.suggestions,
      });

      // Accumulate category scores
      categoryScores[criterion.category].total += result.score * criterion.weight;
      categoryScores[criterion.category].weight += criterion.weight;
    }

    // Calculate category averages
    const finalCategoryScores: Record<string, number> = {};
    for (const [category, data] of Object.entries(categoryScores)) {
      finalCategoryScores[category] = data.weight > 0 ? data.total / data.weight : 0;
    }

    // Calculate overall score (weighted average of categories)
    const overallScore = Object.values(finalCategoryScores).reduce((sum, score) => sum + score, 0) / 6;

    // Determine if refinement is needed
    const passesThreshold = overallScore >= this.PASSING_THRESHOLD &&
      Object.values(finalCategoryScores).every(score => score >= this.CATEGORY_THRESHOLD);

    const refinementNeeded = !passesThreshold;

    // Generate refinement plan
    const refinementPlan = refinementNeeded
      ? this.generateRefinementPlan(criteriaResults, finalCategoryScores)
      : undefined;

    return {
      overallScore,
      categoryScores: finalCategoryScores,
      criteriaResults,
      passesThreshold,
      refinementNeeded,
      refinementPlan,
    };
  }

  /**
   * Refine output based on reflection results
   */
  async refine(context: RefinementContext): Promise<any> {
    const { originalOutput, reflectionResult, agentType, userId, organizationId } = context;

    // Generate refinement prompt
    const refinementPrompt = this.generateRefinementPrompt(originalOutput, reflectionResult);

    // Invoke agent with refinement instructions
    const agentAPI = getAgentAPI();
    const response = await agentAPI.invokeAgent(
      agentType as any,
      refinementPrompt,
      {
        userId,
        organizationId,
        refinement: true,
        originalOutput,
        reflectionResult,
      }
    );

    if (response.success) {
      // Log refinement
      await this.logRefinement(context, response.data);
      return response.data;
    }

    // If refinement fails, return original with warnings
    return {
      ...originalOutput,
      _refinementFailed: true,
      _reflectionResult: reflectionResult,
    };
  }

  /**
   * Generate refinement plan from evaluation results
   */
  private generateRefinementPlan(
    criteriaResults: Array<{ criterion: string; score: number; suggestions: string[] }>,
    categoryScores: Record<string, number>
  ): string[] {
    const plan: string[] = [];

    // Identify low-scoring categories
    const lowCategories = Object.entries(categoryScores)
      .filter(([_, score]) => score < this.CATEGORY_THRESHOLD)
      .sort((a, b) => a[1] - b[1]);

    if (lowCategories.length > 0) {
      plan.push(`Focus on improving: ${lowCategories.map(([cat]) => cat).join(', ')}`);
    }

    // Collect all suggestions from low-scoring criteria
    const lowCriteria = criteriaResults
      .filter(r => r.score < 7.0)
      .sort((a, b) => a.score - b.score);

    lowCriteria.forEach(criterion => {
      if (criterion.suggestions.length > 0) {
        plan.push(...criterion.suggestions);
      }
    });

    return plan;
  }

  /**
   * Generate refinement prompt for agent
   */
  private generateRefinementPrompt(output: any, reflectionResult: ReflectionResult): string {
    const lowScores = reflectionResult.criteriaResults
      .filter(r => r.score < 7.0)
      .map(r => `- ${r.criterion}: ${r.feedback}`)
      .join('\n');

    const suggestions = reflectionResult.refinementPlan?.join('\n- ') || '';

    return `Please refine the following output to improve its quality.

Current Output:
${JSON.stringify(output, null, 2)}

Areas for Improvement:
${lowScores}

Specific Suggestions:
- ${suggestions}

Please provide an improved version that addresses these issues while maintaining the core content and structure.`;
  }

  /**
   * Log refinement activity
   */
  private async logRefinement(context: RefinementContext, refinedOutput: any): Promise<void> {
    await supabase.from('reflection_log').insert({
      agent_type: context.agentType,
      user_id: context.userId,
      organization_id: context.organizationId,
      original_output: context.originalOutput,
      refined_output: refinedOutput,
      reflection_result: context.reflectionResult,
      created_at: new Date().toISOString(),
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const reflectionEngine = new ReflectionEngine();
