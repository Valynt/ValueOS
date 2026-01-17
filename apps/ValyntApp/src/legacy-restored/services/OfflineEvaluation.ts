/**
 * Offline Evaluation Service
 * 
 * Eval-Driven Development: Test agents against golden datasets before deployment.
 * Prevents prompt regressions and validates agent performance.
 */

import { logger } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';

export interface GoldenExample {
  id: string;
  name: string;
  description: string;
  agentType: 'OpportunityAgent' | 'TargetAgent' | 'IntegrityAgent' | 'ReflectionEngine';
  input: any;
  expectedOutput: any;
  evaluationCriteria: {
    metric: string;
    threshold: number;
    weight: number;
  }[];
  metadata: {
    industry?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
  };
  createdAt: Date;
}

export interface EvaluationResult {
  exampleId: string;
  exampleName: string;
  agentType: string;
  actualOutput: any;
  scores: {
    metric: string;
    score: number;
    threshold: number;
    passed: boolean;
    weight: number;
  }[];
  overallScore: number;
  passed: boolean;
  duration: number;
  timestamp: Date;
}

export interface EvaluationRun {
  id: string;
  name: string;
  agentType?: string;
  promptVersion?: string;
  results: EvaluationResult[];
  summary: {
    totalExamples: number;
    passed: number;
    failed: number;
    passRate: number;
    avgScore: number;
    avgDuration: number;
  };
  createdAt: Date;
}

export class OfflineEvaluationService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }

  /**
   * Load golden examples from database
   */
  async loadGoldenExamples(agentType?: string): Promise<GoldenExample[]> {
    try {
      let query = this.supabase
        .from('golden_examples')
        .select('*')
        .order('created_at', { ascending: false });

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        agentType: row.agent_type,
        input: row.input,
        expectedOutput: row.expected_output,
        evaluationCriteria: row.evaluation_criteria,
        metadata: row.metadata,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      logger.error('Failed to load golden examples', error as Error);
      throw error;
    }
  }

  /**
   * Evaluate agent output against expected output
   */
  async evaluateOutput(
    example: GoldenExample,
    actualOutput: any
  ): Promise<EvaluationResult['scores']> {
    const scores: EvaluationResult['scores'] = [];

    for (const criterion of example.evaluationCriteria) {
      let score = 0;

      switch (criterion.metric) {
        case 'exact_match':
          score = this.exactMatch(example.expectedOutput, actualOutput);
          break;

        case 'semantic_similarity':
          score = await this.semanticSimilarity(
            JSON.stringify(example.expectedOutput),
            JSON.stringify(actualOutput)
          );
          break;

        case 'contains_keywords':
          score = this.containsKeywords(
            actualOutput,
            example.expectedOutput.keywords || []
          );
          break;

        case 'json_structure':
          score = this.jsonStructureMatch(example.expectedOutput, actualOutput);
          break;

        case 'numeric_range':
          score = this.numericRange(
            actualOutput,
            example.expectedOutput.min,
            example.expectedOutput.max
          );
          break;

        case 'length_range':
          score = this.lengthRange(
            actualOutput,
            example.expectedOutput.minLength,
            example.expectedOutput.maxLength
          );
          break;

        case 'regex_match':
          score = this.regexMatch(actualOutput, example.expectedOutput.pattern);
          break;

        default:
          logger.warn('Unknown evaluation metric', { metric: criterion.metric });
          score = 0;
      }

      scores.push({
        metric: criterion.metric,
        score,
        threshold: criterion.threshold,
        passed: score >= criterion.threshold,
        weight: criterion.weight,
      });
    }

    return scores;
  }

  /**
   * Exact match evaluation
   */
  private exactMatch(expected: any, actual: any): number {
    return JSON.stringify(expected) === JSON.stringify(actual) ? 1.0 : 0.0;
  }

  /**
   * Semantic similarity using embeddings
   */
  private async semanticSimilarity(text1: string, text2: string): Promise<number> {
    try {
      // Generate embeddings
      const [embedding1, embedding2] = await Promise.all([
        this.generateEmbedding(text1),
        this.generateEmbedding(text2),
      ]);

      // Calculate cosine similarity
      return this.cosineSimilarity(embedding1, embedding2);
    } catch (error) {
      logger.error('Semantic similarity calculation failed', error as Error);
      return 0.0;
    }
  }

  /**
   * Generate embedding
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (mag1 * mag2);
  }

  /**
   * Check if output contains required keywords
   */
  private containsKeywords(output: any, keywords: string[]): number {
    const text = JSON.stringify(output).toLowerCase();
    const matchedKeywords = keywords.filter((kw) =>
      text.includes(kw.toLowerCase())
    );
    return matchedKeywords.length / keywords.length;
  }

  /**
   * Check JSON structure match
   */
  private jsonStructureMatch(expected: any, actual: any): number {
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();

    if (expectedKeys.length === 0) return 1.0;

    const matchedKeys = expectedKeys.filter((key) => actualKeys.includes(key));
    return matchedKeys.length / expectedKeys.length;
  }

  /**
   * Check numeric value is in range
   */
  private numericRange(value: any, min: number, max: number): number {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return 0.0;
    return num >= min && num <= max ? 1.0 : 0.0;
  }

  /**
   * Check text length is in range
   */
  private lengthRange(text: any, minLength: number, maxLength: number): number {
    const str = String(text);
    const length = str.length;
    return length >= minLength && length <= maxLength ? 1.0 : 0.0;
  }

  /**
   * Check regex pattern match
   */
  private regexMatch(text: any, pattern: string): number {
    const regex = new RegExp(pattern);
    return regex.test(String(text)) ? 1.0 : 0.0;
  }

  /**
   * Run evaluation on a single example
   */
  async evaluateExample(
    example: GoldenExample,
    agentFunction: (input: any) => Promise<any>
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    try {
      // Execute agent
      const actualOutput = await agentFunction(example.input);

      // Evaluate output
      const scores = await this.evaluateOutput(example, actualOutput);

      // Calculate overall score (weighted average)
      const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
      const overallScore =
        scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;

      // Check if passed (all criteria met)
      const passed = scores.every((s) => s.passed);

      const duration = Date.now() - startTime;

      return {
        exampleId: example.id,
        exampleName: example.name,
        agentType: example.agentType,
        actualOutput,
        scores,
        overallScore,
        passed,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Example evaluation failed', {
        exampleId: example.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        exampleId: example.id,
        exampleName: example.name,
        agentType: example.agentType,
        actualOutput: null,
        scores: [],
        overallScore: 0,
        passed: false,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run full evaluation suite
   */
  async runEvaluation(
    name: string,
    agentType: string,
    agentFunction: (input: any) => Promise<any>,
    promptVersion?: string
  ): Promise<EvaluationRun> {
    logger.info('Starting evaluation run', { name, agentType, promptVersion });

    // Load golden examples
    const examples = await this.loadGoldenExamples(agentType);

    if (examples.length === 0) {
      throw new Error(`No golden examples found for agent type: ${agentType}`);
    }

    // Run evaluations
    const results: EvaluationResult[] = [];
    for (const example of examples) {
      const result = await this.evaluateExample(example, agentFunction);
      results.push(result);

      logger.info('Example evaluated', {
        exampleName: example.name,
        passed: result.passed,
        score: result.overallScore,
      });
    }

    // Calculate summary
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    const passRate = passed / results.length;
    const avgScore =
      results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    const avgDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    const evaluationRun: EvaluationRun = {
      id: `eval_${Date.now()}`,
      name,
      agentType,
      promptVersion,
      results,
      summary: {
        totalExamples: results.length,
        passed,
        failed,
        passRate,
        avgScore,
        avgDuration,
      },
      createdAt: new Date(),
    };

    // Store evaluation run
    await this.storeEvaluationRun(evaluationRun);

    logger.info('Evaluation run completed', {
      name,
      passRate: `${(passRate * 100).toFixed(1)}%`,
      avgScore: avgScore.toFixed(3),
    });

    return evaluationRun;
  }

  /**
   * Store evaluation run in database
   */
  private async storeEvaluationRun(run: EvaluationRun): Promise<void> {
    try {
      const { error } = await this.supabase.from('evaluation_runs').insert({
        id: run.id,
        name: run.name,
        agent_type: run.agentType,
        prompt_version: run.promptVersion,
        results: run.results,
        summary: run.summary,
      });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to store evaluation run', error as Error);
    }
  }

  /**
   * Compare two evaluation runs
   */
  async compareRuns(runId1: string, runId2: string): Promise<{
    run1: EvaluationRun;
    run2: EvaluationRun;
    comparison: {
      passRateDiff: number;
      avgScoreDiff: number;
      regressions: string[];
      improvements: string[];
    };
  }> {
    const [run1, run2] = await Promise.all([
      this.getEvaluationRun(runId1),
      this.getEvaluationRun(runId2),
    ]);

    if (!run1 || !run2) {
      throw new Error('One or both evaluation runs not found');
    }

    const passRateDiff = run2.summary.passRate - run1.summary.passRate;
    const avgScoreDiff = run2.summary.avgScore - run1.summary.avgScore;

    const regressions: string[] = [];
    const improvements: string[] = [];

    // Compare individual examples
    for (const result2 of run2.results) {
      const result1 = run1.results.find((r) => r.exampleId === result2.exampleId);
      if (!result1) continue;

      if (result1.passed && !result2.passed) {
        regressions.push(result2.exampleName);
      } else if (!result1.passed && result2.passed) {
        improvements.push(result2.exampleName);
      }
    }

    return {
      run1,
      run2,
      comparison: {
        passRateDiff,
        avgScoreDiff,
        regressions,
        improvements,
      },
    };
  }

  /**
   * Get evaluation run by ID
   */
  private async getEvaluationRun(runId: string): Promise<EvaluationRun | null> {
    const { data, error } = await this.supabase
      .from('evaluation_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      agentType: data.agent_type,
      promptVersion: data.prompt_version,
      results: data.results,
      summary: data.summary,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Get evaluation history for agent
   */
  async getEvaluationHistory(
    agentType: string,
    limit: number = 10
  ): Promise<EvaluationRun[]> {
    const { data, error } = await this.supabase
      .from('evaluation_runs')
      .select('*')
      .eq('agent_type', agentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      agentType: row.agent_type,
      promptVersion: row.prompt_version,
      results: row.results,
      summary: row.summary,
      createdAt: new Date(row.created_at),
    }));
  }
}

// Export singleton instance
export const offlineEvaluation = new OfflineEvaluationService();
