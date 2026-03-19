/**
 * Database table type definitions for Supabase client
 */
interface Database {
  prompt_versions: {
    Row: {
      id: string;
      organization_id: string;
      prompt_key: string;
      version: number;
      template: string;
      variables: string[];
      metadata: Record<string, unknown>;
      performance: Record<string, unknown>;
      status: 'draft' | 'testing' | 'active' | 'deprecated';
      created_at: string;
      activated_at?: string;
      deprecated_at?: string;
    };
    Insert: Omit<Database['prompt_versions']['Row'], 'id'>;
    Update: Partial<Database['prompt_versions']['Row']>;
  };
  prompt_executions: {
    Row: {
      id: string;
      organization_id: string;
      prompt_version_id: string;
      user_id: string;
      variables: Record<string, unknown>;
      rendered_prompt: string;
      response?: string;
      latency?: number;
      cost?: number;
      tokens?: { prompt: number; completion: number; total: number };
      success?: boolean;
      error?: string;
      feedback?: { rating: number; comment?: string };
      created_at: string;
    };
    Insert: Omit<Database['prompt_executions']['Row'], 'id' | 'response' | 'latency' | 'cost' | 'tokens' | 'success' | 'error' | 'feedback'>;
    Update: Partial<Database['prompt_executions']['Row']>;
  };
  ab_tests: {
    Row: {
      id: string;
      organization_id: string;
      name: string;
      prompt_key: string;
      variants: { name: string; versionId: string; weight: number }[];
      status: 'draft' | 'running' | 'completed';
      start_date?: string;
      end_date?: string;
    };
    Insert: Omit<Database['ab_tests']['Row'], 'id'>;
    Update: Partial<Database['ab_tests']['Row']>;
  };
}

import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js'

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
  variables: Record<string, unknown>;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: ReturnType<typeof createClient<any>>;
  private cache: Map<string, PromptVersion> = new Map();

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.supabase = createClient<any>(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }

  /**
   * Create a new prompt version
   */
  async createVersion(
    organizationId: string,
    data: {
      promptKey: string;
      template: string;
      variables: string[];
      metadata: PromptVersion['metadata'];
    }
  ): Promise<PromptVersion> {
    // Get next version number scoped to this tenant
    const { data: existingVersions } = await this.supabase
      .from('prompt_versions')
      .select('version')
      .eq('organization_id', organizationId)
      .eq('prompt_key', data.promptKey)
      .order('version', { ascending: false })
      .limit(1) as { data: Array<{ version: number }> | null };

    const nextVersion = existingVersions && existingVersions.length > 0
      ? existingVersions[0].version + 1
      : 1;

    const { data: created, error } = await this.supabase
      .from('prompt_versions')
      .insert({
        organization_id: organizationId,
        prompt_key: data.promptKey,
        version: nextVersion,
        template: data.template,
        variables: data.variables,
        metadata: data.metadata,
        performance: {},
        status: 'draft',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Prompt version created', {
      organizationId,
      promptKey: data.promptKey,
      version: nextVersion,
      author: data.metadata.author
    });

    return created;
  }

  /**
   * Get active version for a prompt key
   */
  async getActiveVersion(organizationId: string, promptKey: string): Promise<PromptVersion | null> {
    const cacheKey = `active:${organizationId}:${promptKey}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const { data, error } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('organization_id', organizationId)
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
  async getVersion(organizationId: string, promptKey: string, version: number): Promise<PromptVersion | null> {
    const { data, error } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('prompt_key', promptKey)
      .eq('version', version)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * List all versions for a prompt key
   */
  async listVersions(organizationId: string, promptKey: string): Promise<PromptVersion[]> {
    const { data, error } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('prompt_key', promptKey)
      .order('version', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Activate a version
   */
  async activateVersion(organizationId: string, promptKey: string, version: number): Promise<void> {
    // Deactivate current active version within this tenant
    await this.supabase
      .from('prompt_versions')
      .update({ status: 'deprecated', deprecated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('organization_id', organizationId)
      .eq('prompt_key', promptKey)
      .eq('status', 'active');

    // Activate new version
    const { error } = await this.supabase
      .from('prompt_versions')
      .update({ status: 'active', activated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('organization_id', organizationId)
      .eq('prompt_key', promptKey)
      .eq('version', version);

    if (error) throw error;

    // Clear cache
    this.cache.delete(`active:${organizationId}:${promptKey}`);

    logger.info('Prompt version activated', {
      organizationId,
      promptKey,
      version
    });
  }

  /**
   * Render prompt with variables
   */
  renderPrompt(template: string, variables: Record<string, unknown>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
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
    organizationId: string,
    promptKey: string,
    variables: Record<string, unknown>,
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
      version = await this.getVersionFromABTest(organizationId, options.abTestId, userId);
    } else if (options?.version) {
      version = await this.getVersion(organizationId, promptKey, options.version);
    } else {
      version = await this.getActiveVersion(organizationId, promptKey);
    }

    if (!version) {
      throw new Error(`No active version found for prompt: ${promptKey}`);
    }

    // Render prompt
    const renderedPrompt = this.renderPrompt(version.template, variables);

    // Create execution record
    const { data: created, error } = await this.supabase
      .from('prompt_executions')
      .insert({
        organization_id: organizationId,
        prompt_version_id: version.id,
        user_id: userId,
        variables,
        rendered_prompt: renderedPrompt,
        created_at: new Date().toISOString(),
      })
      .select('id')
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
    organizationId: string,
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
      .update(results as Record<string, unknown>)
      .eq('organization_id', organizationId)
      .eq('id', executionId);

    if (error) throw error;

    // Update version performance metrics asynchronously
    this.updateVersionPerformance(organizationId, executionId).catch(err =>
      logger.error('Failed to update version performance', err)
    );
  }

  /**
   * Add user feedback
   */
  async addFeedback(
    organizationId: string,
    executionId: string,
    feedback: {
      rating: number;
      comment?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('prompt_executions')
      .update({ feedback } as Record<string, unknown>)
      .eq('organization_id', organizationId)
      .eq('id', executionId);

    if (error) throw error;

    logger.info('Prompt feedback recorded', {
      organizationId,
      executionId,
      rating: feedback.rating
    });
  }

  /**
   * Update version performance metrics
   */
  private async updateVersionPerformance(organizationId: string, executionId: string): Promise<void> {
    // Get execution — scoped to tenant to prevent cross-tenant metric pollution
    const { data: execution } = await this.supabase
      .from('prompt_executions')
      .select('prompt_version_id')
      .eq('organization_id', organizationId)
      .eq('id', executionId)
      .single() as { data: { prompt_version_id: string } | null };

    if (!execution) return;

    // Calculate aggregate metrics within this tenant only
    const { data: metrics } = await this.supabase
      .from('prompt_executions')
      .select('latency, cost, tokens, success, feedback')
      .eq('organization_id', organizationId)
      .eq('prompt_version_id', execution.prompt_version_id);

    if (!metrics || metrics.length === 0) return;

    const ratedMetrics = metrics.filter(m => m.feedback?.rating);
    const performance = {
      avgLatency: metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length,
      avgCost: metrics.reduce((sum, m) => sum + (m.cost || 0), 0) / metrics.length,
      avgTokens: metrics.reduce((sum, m) => sum + (m.tokens?.total || 0), 0) / metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length,
      userSatisfaction: ratedMetrics.length > 0
        ? ratedMetrics.reduce((sum, m) => sum + (m.feedback?.rating || 0), 0) / ratedMetrics.length
        : 0,
    };

    // Update version — scoped to tenant
    await this.supabase
      .from('prompt_versions')
      .update({ performance: performance as Record<string, unknown> })
      .eq('organization_id', organizationId)
      .eq('id', execution.prompt_version_id);
  }

  /**
   * Create A/B test
   */
  async createABTest(
    organizationId: string,
    data: {
      name: string;
      promptKey: string;
      variants: ABTest['variants'];
    }
  ): Promise<ABTest> {
    // Validate weights sum to 100
    const totalWeight = data.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100');
    }

    const { data: created, error } = await this.supabase
      .from('ab_tests')
      .insert({
        organization_id: organizationId,
        name: data.name,
        prompt_key: data.promptKey,
        variants: data.variants,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('A/B test created', {
      organizationId,
      name: data.name,
      promptKey: data.promptKey,
      variants: data.variants.length
    });

    return created;
  }

  /**
   * Start A/B test
   */
  async startABTest(organizationId: string, testId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ab_tests')
      .update({
        status: 'running',
        start_date: new Date(),
      })
      .eq('organization_id', organizationId)
      .eq('id', testId);

    if (error) throw error;

    logger.info('A/B test started', { organizationId, testId });
  }

  /**
   * Get version from A/B test (weighted random selection)
   */
  private async getVersionFromABTest(
    organizationId: string,
    testId: string,
    userId: string
  ): Promise<PromptVersion | null> {
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('organization_id', organizationId)
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
          .eq('organization_id', organizationId)
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
  async getABTestResults(organizationId: string, testId: string): Promise<ABTest['results']> {
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', testId)
      .single();

    if (!test) return [];

    const results: unknown[] = [];

    for (const variant of test.variants) {
      const { data: executions } = await this.supabase
        .from('prompt_executions')
        .select('latency, cost, success, feedback')
        .eq('organization_id', organizationId)
        .eq('prompt_version_id', variant.versionId);

      if (!executions || executions.length === 0) continue;

      const ratedExecs = executions.filter(e => e.feedback?.rating);
      results.push({
        variant: variant.name,
        executions: executions.length,
        avgLatency: executions.reduce((sum, e) => sum + (e.latency || 0), 0) / executions.length,
        avgCost: executions.reduce((sum, e) => sum + (e.cost || 0), 0) / executions.length,
        successRate: executions.filter(e => e.success).length / executions.length,
        userSatisfaction: ratedExecs.length > 0
          ? ratedExecs.reduce((sum, e) => sum + (e.feedback?.rating || 0), 0) / ratedExecs.length
          : 0,
      });
    }

    return results;
  }

  /**
   * Complete A/B test and select winner
   */
  async completeABTest(organizationId: string, testId: string, winnerVariantName: string): Promise<void> {
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', testId)
      .single();

    if (!test) throw new Error('Test not found');

    const winner = test.variants.find((v: { name: string }) => v.name === winnerVariantName);
    if (!winner) throw new Error('Winner variant not found');

    // Get winner version — scoped to tenant
    const { data: winnerVersion } = await this.supabase
      .from('prompt_versions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', winner.versionId)
      .single();

    if (!winnerVersion) throw new Error('Winner version not found');

    // Activate winner
    await this.activateVersion(organizationId, test.prompt_key, winnerVersion.version);

    // Mark test as completed
    await this.supabase
      .from('ab_tests')
      .update({
        status: 'completed',
        end_date: new Date(),
      })
      .eq('organization_id', organizationId)
      .eq('id', testId);

    logger.info('A/B test completed', {
      organizationId,
      testId,
      winner: winnerVariantName,
      promptKey: test.prompt_key,
      version: winnerVersion.version
    });
  }

  /**
   * Compare versions
   */
  async compareVersions(
    organizationId: string,
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
        .eq('organization_id', organizationId)
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
