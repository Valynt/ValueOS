/**
 * Data Binding Resolver
 * 
 * Resolves dynamic data bindings from various sources (agents, MCP tools, Supabase).
 * Supports caching, transforms, live refresh, and tenant-aware permissions.
 */

import { logger } from '../lib/logger';
import {
  DataBinding,
  DataSourceType,
  DataSourceContext,
  ResolvedBinding,
  TransformFunction,
  isDataBinding,
  validateDataBinding,
} from './DataBindingSchema';
import { TenantContext, hasPermission } from './TenantContext';
import { ToolRegistry } from '../services/ToolRegistry';
import { SemanticMemoryService } from '../services/SemanticMemory';
import { createClient } from '@supabase/supabase-js';

/**
 * Data source resolver function
 */
type DataSourceResolver = (
  binding: DataBinding,
  context: DataSourceContext
) => Promise<any>;

/**
 * Cache entry
 */
interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
}

/**
 * Data Binding Resolver Service
 */
export class DataBindingResolver {
  private cache: Map<string, CacheEntry> = new Map();
  private resolvers: Map<DataSourceType, DataSourceResolver> = new Map();
  private toolRegistry?: ToolRegistry;
  private semanticMemory?: SemanticMemoryService;
  private supabaseClient?: ReturnType<typeof createClient>;

  constructor(options?: {
    toolRegistry?: ToolRegistry;
    semanticMemory?: SemanticMemoryService;
    supabaseUrl?: string;
    supabaseKey?: string;
  }) {
    this.toolRegistry = options?.toolRegistry;
    this.semanticMemory = options?.semanticMemory;

    if (options?.supabaseUrl && options?.supabaseKey) {
      this.supabaseClient = createClient(options.supabaseUrl, options.supabaseKey);
    }

    this.initializeResolvers();
  }

  /**
   * Initialize data source resolvers
   */
  private initializeResolvers(): void {
    // Realization Engine resolver
    this.resolvers.set('realization_engine', async (binding, context) => {
      return this.resolveFromSupabase(
        'feedback_loops',
        binding.$bind,
        {
          organization_id: context.organizationId,
          realization_stage: 'active',
          ...binding.$params,
        }
      );
    });

    // System Mapper resolver
    this.resolvers.set('system_mapper', async (binding, context) => {
      const table = binding.$bind.startsWith('entities') ? 'entities' : 'relationships';
      return this.resolveFromSupabase(table, binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Intervention Designer resolver
    this.resolvers.set('intervention_designer', async (binding, context) => {
      return this.resolveFromSupabase('intervention_points', binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Outcome Engineer resolver
    this.resolvers.set('outcome_engineer', async (binding, context) => {
      return this.resolveFromSupabase('outcome_hypotheses', binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Value Eval resolver
    this.resolvers.set('value_eval', async (binding, context) => {
      return this.resolveFromSupabase('value_evaluations', binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Semantic Memory resolver
    this.resolvers.set('semantic_memory', async (binding, context) => {
      if (!this.semanticMemory) {
        throw new Error('SemanticMemoryService not configured');
      }

      const params = binding.$params || {};
      const type = params.type;
      const limit = params.limit || 10;

      if (type) {
        return this.semanticMemory.getMemoriesByType(type, limit);
      }

      // Default: search by binding path as query
      return this.semanticMemory.searchSimilar(binding.$bind, { limit });
    });

    // Tool Registry resolver
    this.resolvers.set('tool_registry', async (binding, context) => {
      if (!this.toolRegistry) {
        throw new Error('ToolRegistry not configured');
      }

      const params = binding.$params || {};
      const toolName = params.tool;

      if (!toolName) {
        throw new Error('Tool name required in $params.tool');
      }

      const result = await this.toolRegistry.executeTool(
        toolName,
        params.parameters || {},
        {
          userId: context.userId || 'system',
          organizationId: context.organizationId,
          sessionId: context.sessionId,
        }
      );

      return this.extractValueFromPath(result, binding.$bind);
    });

    // MCP Tool resolver (alias for tool_registry)
    this.resolvers.set('mcp_tool', async (binding, context) => {
      return this.resolvers.get('tool_registry')!(binding, context);
    });

    // Supabase resolver
    this.resolvers.set('supabase', async (binding, context) => {
      const params = binding.$params || {};
      const table = params.table;

      if (!table) {
        throw new Error('Table name required in $params.table');
      }

      return this.resolveFromSupabase(table, binding.$bind, {
        organization_id: context.organizationId,
        ...params.filter,
      });
    });
  }

  /**
   * Resolve a data binding
   */
  async resolve(
    binding: DataBinding,
    context: DataSourceContext
  ): Promise<ResolvedBinding> {
    const startTime = Date.now();

    try {
      // Validate binding
      const validation = validateDataBinding(binding);
      if (!validation.valid) {
        return {
          value: binding.$fallback,
          success: false,
          error: validation.errors.join(', '),
          timestamp: new Date().toISOString(),
          source: binding.$source,
          cached: false,
        };
      }

      // Check cache
      const cacheKey = this.getCacheKey(binding, context);
      const cached = this.getFromCache(cacheKey);
      if (cached !== null) {
        logger.debug('Resolved binding from cache', {
          source: binding.$source,
          path: binding.$bind,
          cacheKey,
        });

        return {
          value: cached,
          success: true,
          timestamp: new Date().toISOString(),
          source: binding.$source,
          cached: true,
        };
      }

      // Resolve from source
      const resolver = this.resolvers.get(binding.$source);
      if (!resolver) {
        throw new Error(`No resolver for source: ${binding.$source}`);
      }

      let value = await resolver(binding, context);

      // Apply transform
      if (binding.$transform) {
        value = this.applyTransform(value, binding.$transform);
      }

      // Cache result
      if (binding.$cache || binding.$cacheTTL) {
        this.setCache(
          cacheKey,
          value,
          binding.$cacheTTL || 60000 // Default 1 minute
        );
      }

      const duration = Date.now() - startTime;
      logger.debug('Resolved binding', {
        source: binding.$source,
        path: binding.$bind,
        duration,
      });

      return {
        value,
        success: true,
        timestamp: new Date().toISOString(),
        source: binding.$source,
        cached: false,
      };
    } catch (error) {
      logger.error('Failed to resolve binding', {
        source: binding.$source,
        path: binding.$bind,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        value: binding.$fallback,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        source: binding.$source,
        cached: false,
      };
    }
  }

  /**
   * Resolve multiple bindings in parallel
   */
  async resolveMany(
    bindings: DataBinding[],
    context: DataSourceContext
  ): Promise<ResolvedBinding[]> {
    return Promise.all(bindings.map((binding) => this.resolve(binding, context)));
  }

  /**
   * Resolve all bindings in an object recursively
   */
  async resolveObject(
    obj: any,
    context: DataSourceContext
  ): Promise<any> {
    if (isDataBinding(obj)) {
      const resolved = await this.resolve(obj, context);
      return resolved.value;
    }

    if (Array.isArray(obj)) {
      return Promise.all(obj.map((item) => this.resolveObject(item, context)));
    }

    if (typeof obj === 'object' && obj !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = await this.resolveObject(value, context);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolve from Supabase
   */
  private async resolveFromSupabase(
    table: string,
    path: string,
    filter: Record<string, any>
  ): Promise<any> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    // Build query
    let query = this.supabaseClient.from(table).select('*');

    // Apply filters
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    // Extract value from path
    return this.extractValueFromPath(data, path);
  }

  /**
   * Extract value from object using path
   * Supports:
   * - Simple paths: "metrics.revenue"
   * - Array access: "loops[0].strength"
   * - Array filters: "loops.filter(status=active)"
   * - Array methods: "loops.length", "values.sum"
   */
  private extractValueFromPath(data: any, path: string): any {
    if (!path || path === '.') {
      return data;
    }

    const parts = path.split('.');
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Array index: loops[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = current[key]?.[parseInt(index, 10)];
        continue;
      }

      // Array filter: filter(status=active)
      const filterMatch = part.match(/^filter\((\w+)=(.+)\)$/);
      if (filterMatch) {
        const [, key, value] = filterMatch;
        if (Array.isArray(current)) {
          current = current.filter((item) => String(item[key]) === value);
        }
        continue;
      }

      // Array methods
      if (part === 'length' && Array.isArray(current)) {
        return current.length;
      }
      if (part === 'sum' && Array.isArray(current)) {
        return current.reduce((sum, val) => sum + (Number(val) || 0), 0);
      }
      if (part === 'average' && Array.isArray(current)) {
        const sum = current.reduce((s, val) => s + (Number(val) || 0), 0);
        return current.length > 0 ? sum / current.length : 0;
      }
      if (part === 'max' && Array.isArray(current)) {
        return Math.max(...current.map((v) => Number(v) || 0));
      }
      if (part === 'min' && Array.isArray(current)) {
        return Math.min(...current.map((v) => Number(v) || 0));
      }

      // Simple property access
      current = current[part];
    }

    return current;
  }

  /**
   * Apply transform function to value
   */
  private applyTransform(value: any, transform: TransformFunction): any {
    switch (transform) {
      case 'currency':
        return this.formatCurrency(value);
      case 'percentage':
        return this.formatPercentage(value);
      case 'number':
        return this.formatNumber(value);
      case 'date':
        return this.formatDate(value);
      case 'relative_time':
        return this.formatRelativeTime(value);
      case 'round':
        return Math.round((Number(value) || 0) * 100) / 100;
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'truncate':
        return this.truncate(String(value), 50);
      case 'array_length':
        return Array.isArray(value) ? value.length : 0;
      case 'sum':
        return Array.isArray(value)
          ? value.reduce((sum, val) => sum + (Number(val) || 0), 0)
          : 0;
      case 'average':
        if (!Array.isArray(value) || value.length === 0) return 0;
        const sum = value.reduce((s, val) => s + (Number(val) || 0), 0);
        return sum / value.length;
      case 'max':
        return Array.isArray(value)
          ? Math.max(...value.map((v) => Number(v) || 0))
          : value;
      case 'min':
        return Array.isArray(value)
          ? Math.min(...value.map((v) => Number(v) || 0))
          : value;
      default:
        return value;
    }
  }

  /**
   * Format as currency
   */
  private formatCurrency(value: any): string {
    const num = Number(value) || 0;
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(1)}K`;
    }
    return `$${num.toLocaleString()}`;
  }

  /**
   * Format as percentage
   */
  private formatPercentage(value: any): string {
    const num = Number(value) || 0;
    // If value is between 0 and 1, treat as decimal
    if (num > 0 && num < 1) {
      return `${(num * 100).toFixed(0)}%`;
    }
    // Otherwise treat as percentage
    return `${num.toFixed(0)}%`;
  }

  /**
   * Format as number
   */
  private formatNumber(value: any): string {
    const num = Number(value) || 0;
    return num.toLocaleString();
  }

  /**
   * Format as date
   */
  private formatDate(value: any): string {
    try {
      const date = new Date(value);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(value);
    }
  }

  /**
   * Format as relative time
   */
  private formatRelativeTime(value: any): string {
    try {
      const date = new Date(value);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return this.formatDate(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Truncate string
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get cache key
   */
  private getCacheKey(binding: DataBinding, context: DataSourceContext): string {
    if (binding.$cache) {
      return `${context.organizationId}:${binding.$cache}`;
    }
    return `${context.organizationId}:${binding.$source}:${binding.$bind}`;
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cache
   */
  private setCache(key: string, value: any, ttl: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Register custom resolver
   */
  registerResolver(source: DataSourceType, resolver: DataSourceResolver): void {
    this.resolvers.set(source, resolver);
  }
}

export default DataBindingResolver;
