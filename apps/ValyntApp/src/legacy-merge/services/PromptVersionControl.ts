/**
 * Prompt Version Control System
 * 
 * Manages versioning, A/B testing, and optimization of LLM prompts
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface PromptVersion {
  id: string;
  promptKey: string;
  version: number;
  template: string;
  variables: string[];
  metadata: {
    author: string;
    description: string;
    tags: string[];
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  performance: {
    avgLatency?: number;
    avgCost?: number;
    avgTokens?: number;
    successRate?: number;
    userSatisfaction?: number;
  };
  status: 'draft' | 'testing' | 'active' | 'deprecated';
  createdAt: Date;
  activatedAt?: Date;
  deprecatedAt?: Date;
}

export interface PromptExecution {
  id: string;
  promptVersionId: string;
  userId: string;
  variables: Record<string, any>;
  renderedPrompt: string;
  response: string;
  latency: number;
  cost: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  success: boolean;
  error?: string;
  feedback?: {
    rating: number;
    comment?: string;
  };
  createdAt: Date;
}

export interface ABTest {
  id: string;
  name: string;
  promptKey: string;
  variants: {
    name: string;
    versionId: string;
    weight: number; // 0-100
  }[];
  status: 'draft' | 'running' | 'completed';
  startDate?: Date;
  endDate?: Date;
  results?: {
    variant: string;
    executions: number;
    avgLatency: number;
    avgCost: number;
    successRate: number;
    userSatisfaction: number;
  }[];
}

export class PromptVersionControlService {
  private supabase: ReturnType<typeof createClient>;
  private cache: Map<string, PromptVersion> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }

  /**
   * Create a new prompt version
   */
  async createVersion(data: {
    promptKey: string;
    template: string;
    variables: string[];
    metadata: PromptVersion['metadata'];
  }): Promise<PromptVersion> {
    // Get next version number
    const { data: existingVersions } = await this.supabase
      .from('prompt_versions')
      .select('version')
      .eq('prompt_key', data.promptKey)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingVersions && existingVersions.length > 0
      ? existingVersions[0].version + 1
      : 1;

    const version: Omit<PromptVersion, 'id'> = {
      promptKey: data.promptKey,
      version: nextVersion,
      template: data.template,
      variables: data.variables,
      metadata: data.metadata,
      performance: {},
      status: 'draft',
      createdAt: new Date(),
    };

    const { data: created, error } = await this.supabase
      .from('prompt_versions')
      .insert(version)
      .select()
      .single();

    if (error) throw error;

    logger.info('Prompt version created', {
      promptKey: data.promptKey,
      version: nextVersion,
      author: data.metadata.author
    });

    return created;
  }

  /**
   * Get active version for a prompt key
   */
  async getActiveVersion(promptKey: string): Promise<PromptVersion | null> {
    // Check cache first
    const cacheKey = `active:${promptKey}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const { data, error } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_key', promptKey)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    if (!data) return null;

    // Cache for 5 minutes
    this.cache.set(cacheKey, data);
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

    return data;
  }

  /**
   * Get specific version
   */
  async getVersion(promptKey: string, version: number): Promise<PromptVersion | null> {
    const { data, error } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_key', promptKey)
      .eq('version', version)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * List all versions for a prompt key
   */
  async listVersions(promptKey: string): Promise<PromptVersion[]> {
    const { data, error } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_key', promptKey)
      .order('version', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Activate a version
   */
  async activateVersion(promptKey: string, version: number): Promise<void> {
    // Deactivate current active version
    await this.supabase
      .from('prompt_versions')
      .update({ status: 'deprecated', deprecatedAt: new Date() })
      .eq('prompt_key', promptKey)
      .eq('status', 'active');

    // Activate new version
    const { error } = await this.supabase
      .from('prompt_versions')
      .update({ status: 'active', activatedAt: new Date() })
      .eq('prompt_key', promptKey)
      .eq('version', version);

    if (error) throw error;

    // Clear cache
    this.cache.delete(`active:${promptKey}`);

    logger.info('Prompt version activated', {
      promptKey,
      version
    });
  }

  /**
   * Render prompt with variables
   */
  renderPrompt(template: string, variables: Record<string, any>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(placeholder, String(value));
    }

    // Check for unresolved variables
    const unresolved = rendered.match(/{{[^}]+}}/g);
    if (unresolved) {
      logger.warn('Unresolved variables in prompt', {
        unresolved
      });
    }

    return rendered;
  }

  /**
   * Execute prompt and track performance
   */
  async executePrompt(
    promptKey: string,
    variables: Record<string, any>,
    userId: string,
    options?: {
      version?: number;
      abTestId?: string;
    }
  ): Promise<{
    prompt: string;
    version: PromptVersion;
    executionId: string;
  }> {
    // Get version (from A/B test, specific version, or active)
    let version: PromptVersion | null = null;

    if (options?.abTestId) {
      version = await this.getVersionFromABTest(options.abTestId, userId);
    } else if (options?.version) {
      version = await this.getVersion(promptKey, options.version);
    } else {
      version = await this.getActiveVersion(promptKey);
    }

    if (!version) {
      throw new Error(`No active version found for prompt: ${promptKey}`);
    }

    // Render prompt
    const renderedPrompt = this.renderPrompt(version.template, variables);

    // Create execution record
    const execution: Omit<PromptExecution, 'id' | 'response' | 'latency' | 'cost' | 'tokens' | 'success'> = {
      promptVersionId: version.id,
      userId,
      variables,
      renderedPrompt,
      createdAt: new Date(),
    };

    const { data: created, error } = await this.supabase
      .from('prompt_executions')
      .insert(execution)
      .select()
      .single();

    if (error) throw error;

    return {
      prompt: renderedPrompt,
      version,
      executionId: created.id,
    };
  }

  /**
   * Record execution results
   */
  async recordExecution(
    executionId: string,
    results: {
      response: string;
      latency: number;
      cost: number;
      tokens: PromptExecution['tokens'];
      success: boolean;
      error?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('prompt_executions')
      .update(results)
      .eq('id', executionId);

    if (error) throw error;

    // Update version performance metrics asynchronously
    this.updateVersionPerformance(executionId).catch(err =>
      logger.error('Failed to update version performance', err)
    );
  }

  /**
   * Add user feedback
   */
  async addFeedback(
    executionId: string,
    feedback: {
      rating: number;
      comment?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('prompt_executions')
      .update({ feedback })
      .eq('id', executionId);

    if (error) throw error;

    logger.info('Prompt feedback recorded', {
      executionId,
      rating: feedback.rating
    });
  }

  /**
   * Update version performance metrics
   */
  private async updateVersionPerformance(executionId: string): Promise<void> {
    // Get execution
    const { data: execution } = await this.supabase
      .from('prompt_executions')
      .select('prompt_version_id')
      .eq('id', executionId)
      .single();

    if (!execution) return;

    // Calculate aggregate metrics
    const { data: metrics } = await this.supabase
      .from('prompt_executions')
      .select('latency, cost, tokens, success, feedback')
      .eq('prompt_version_id', execution.prompt_version_id);

    if (!metrics || metrics.length === 0) return;

    const performance = {
      avgLatency: metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length,
      avgCost: metrics.reduce((sum, m) => sum + (m.cost || 0), 0) / metrics.length,
      avgTokens: metrics.reduce((sum, m) => sum + (m.tokens?.total || 0), 0) / metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length,
      userSatisfaction: metrics
        .filter(m => m.feedback?.rating)
        .reduce((sum, m) => sum + (m.feedback?.rating || 0), 0) /
        metrics.filter(m => m.feedback?.rating).length || 0,
    };

    // Update version
    await this.supabase
      .from('prompt_versions')
      .update({ performance })
      .eq('id', execution.prompt_version_id);
  }

  /**
   * Create A/B test
   */
  async createABTest(data: {
    name: string;
    promptKey: string;
    variants: ABTest['variants'];
  }): Promise<ABTest> {
    // Validate weights sum to 100
    const totalWeight = data.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100');
    }

    const test: Omit<ABTest, 'id'> = {
      name: data.name,
      promptKey: data.promptKey,
      variants: data.variants,
      status: 'draft',
    };

    const { data: created, error } = await this.supabase
      .from('ab_tests')
      .insert(test)
      .select()
      .single();

    if (error) throw error;

    logger.info('A/B test created', {
      name: data.name,
      promptKey: data.promptKey,
      variants: data.variants.length
    });

    return created;
  }

  /**
   * Start A/B test
   */
  async startABTest(testId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ab_tests')
      .update({
        status: 'running',
        startDate: new Date(),
      })
      .eq('id', testId);

    if (error) throw error;

    logger.info('A/B test started', { testId });
  }

  /**
   * Get version from A/B test (weighted random selection)
   */
  private async getVersionFromABTest(
    testId: string,
    userId: string
  ): Promise<PromptVersion | null> {
    // Get test
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (!test || test.status !== 'running') return null;

    // Deterministic selection based on user ID
    const hash = crypto.createHash('md5').update(userId + testId).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const selection = hashValue % 100;

    // Select variant based on weights
    let cumulative = 0;
    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (selection < cumulative) {
        const { data: version } = await this.supabase
          .from('prompt_versions')
          .select('*')
          .eq('id', variant.versionId)
          .single();

        return version;
      }
    }

    return null;
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<ABTest['results']> {
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (!test) return [];

    const results = [];

    for (const variant of test.variants) {
      const { data: executions } = await this.supabase
        .from('prompt_executions')
        .select('latency, cost, success, feedback')
        .eq('prompt_version_id', variant.versionId);

      if (!executions || executions.length === 0) continue;

      results.push({
        variant: variant.name,
        executions: executions.length,
        avgLatency: executions.reduce((sum, e) => sum + (e.latency || 0), 0) / executions.length,
        avgCost: executions.reduce((sum, e) => sum + (e.cost || 0), 0) / executions.length,
        successRate: executions.filter(e => e.success).length / executions.length,
        userSatisfaction: executions
          .filter(e => e.feedback?.rating)
          .reduce((sum, e) => sum + (e.feedback?.rating || 0), 0) /
          executions.filter(e => e.feedback?.rating).length || 0,
      });
    }

    return results;
  }

  /**
   * Complete A/B test and select winner
   */
  async completeABTest(testId: string, winnerVariantName: string): Promise<void> {
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (!test) throw new Error('Test not found');

    const winner = test.variants.find(v => v.name === winnerVariantName);
    if (!winner) throw new Error('Winner variant not found');

    // Get winner version
    const { data: winnerVersion } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('id', winner.versionId)
      .single();

    if (!winnerVersion) throw new Error('Winner version not found');

    // Activate winner
    await this.activateVersion(test.promptKey, winnerVersion.version);

    // Mark test as completed
    await this.supabase
      .from('ab_tests')
      .update({
        status: 'completed',
        endDate: new Date(),
      })
      .eq('id', testId);

    logger.info('A/B test completed', {
      testId,
      winner: winnerVariantName,
      promptKey: test.promptKey,
      version: winnerVersion.version
    });
  }

  /**
   * Compare versions
   */
  async compareVersions(
    promptKey: string,
    versions: number[]
  ): Promise<{
    version: number;
    performance: PromptVersion['performance'];
  }[]> {
    const results = [];

    for (const version of versions) {
      const { data } = await this.supabase
        .from('prompt_versions')
        .select('version, performance')
        .eq('prompt_key', promptKey)
        .eq('version', version)
        .single();

      if (data) {
        results.push(data);
      }
    }

    return results;
  }
}

// Export singleton instance
export const promptVersionControl = new PromptVersionControlService();
