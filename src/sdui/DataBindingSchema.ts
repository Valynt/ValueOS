/**
 * Dynamic Data Binding Schema for SDUI
 * 
 * Enables live data bindings in SDUI components instead of static values.
 * Agents write "pointers" to data sources, and the renderer resolves them at runtime.
 * 
 * Example:
 * Instead of: { value: "$1.2M" }
 * Use: { value: { $bind: "metrics.revenue_uplift", $source: "realization_engine" } }
 */

import { z } from 'zod';

/**
 * Supported data source types
 */
export type DataSourceType =
  | 'realization_engine'    // RealizationAgent metrics
  | 'system_mapper'         // SystemMapperAgent entities/relationships
  | 'intervention_designer' // TargetAgent interventions
  | 'outcome_engineer'      // OpportunityAgent hypotheses
  | 'value_eval'            // IntegrityAgent scores
  | 'semantic_memory'       // SemanticMemoryService
  | 'tool_registry'         // ToolRegistry execution results
  | 'supabase'              // Direct Supabase query
  | 'mcp_tool'              // MCP tool execution
  | 'realtime_stream';      // WebSocket real-time data stream

/**
 * Data binding configuration
 */
export interface DataBinding {
  /**
   * Path to the data within the source
   * Examples:
   * - "metrics.revenue_uplift"
   * - "loops[0].loop_strength"
   * - "entities.filter(type=actor).count"
   */
  $bind: string;

  /**
   * Data source to fetch from
   */
  $source: DataSourceType;

  /**
   * Fallback value if binding fails
   */
  $fallback?: any;

  /**
   * Refresh interval in milliseconds (optional)
   * If not set, data is fetched once on mount
   */
  $refresh?: number;

  /**
   * Transform function name (optional)
   * Applied to the resolved value before rendering
   */
  $transform?: TransformFunction;

  /**
   * Additional parameters for the data source
   */
  $params?: Record<string, any>;

  /**
   * Cache key (optional)
   * If set, resolved value is cached with this key
   */
  $cache?: string;

  /**
   * Cache TTL in milliseconds (optional)
   */
  $cacheTTL?: number;
}

/**
 * Transform functions that can be applied to resolved values
 */
export type TransformFunction =
  | 'currency'           // Format as currency: 1200000 → "$1.2M"
  | 'percentage'         // Format as percentage: 0.85 → "85%"
  | 'number'             // Format as number: 1234567 → "1,234,567"
  | 'date'               // Format as date: ISO string → "Jan 15, 2024"
  | 'relative_time'      // Format as relative time: ISO string → "2 hours ago"
  | 'round'              // Round to 2 decimals: 3.14159 → 3.14
  | 'uppercase'          // Convert to uppercase
  | 'lowercase'          // Convert to lowercase
  | 'truncate'           // Truncate long strings
  | 'array_length'       // Get array length
  | 'sum'                // Sum array of numbers
  | 'average'            // Average array of numbers
  | 'max'                // Max value in array
  | 'min';               // Min value in array

/**
 * Zod schema for data binding validation
 */
export const DataBindingSchema = z.object({
  $bind: z.string().min(1, 'Binding path cannot be empty'),
  $source: z.enum([
    'realization_engine',
    'system_mapper',
    'intervention_designer',
    'outcome_engineer',
    'value_eval',
    'semantic_memory',
    'tool_registry',
    'supabase',
    'mcp_tool',
    'realtime_stream',
  ]),
  $fallback: z.any().optional(),
  $refresh: z.number().positive().optional(),
  $transform: z.enum([
    'currency',
    'percentage',
    'number',
    'date',
    'relative_time',
    'round',
    'uppercase',
    'lowercase',
    'truncate',
    'array_length',
    'sum',
    'average',
    'max',
    'min',
  ]).optional(),
  $params: z.record(z.any()).optional(),
  $cache: z.string().optional(),
  $cacheTTL: z.number().positive().optional(),
});

/**
 * Type guard to check if a value is a data binding
 */
export function isDataBinding(value: any): value is DataBinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$bind' in value &&
    '$source' in value
  );
}

/**
 * Validate data binding
 */
export function validateDataBinding(value: any): {
  valid: boolean;
  errors: string[];
} {
  try {
    DataBindingSchema.parse(value);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Resolved data binding result
 */
export interface ResolvedBinding {
  /**
   * The resolved value
   */
  value: any;

  /**
   * Whether the binding was successfully resolved
   */
  success: boolean;

  /**
   * Error message if resolution failed
   */
  error?: string;

  /**
   * Timestamp when the value was resolved
   */
  timestamp: string;

  /**
   * Source that provided the value
   */
  source: DataSourceType;

  /**
   * Whether the value came from cache
   */
  cached: boolean;
}

/**
 * Data source context for binding resolution
 */
export interface DataSourceContext {
  /**
   * Organization ID for multi-tenancy
   */
  organizationId: string;

  /**
   * User ID for permissions
   */
  userId?: string;

  /**
   * Session ID for tracking
   */
  sessionId?: string;

  /**
   * Additional context data
   */
  metadata?: Record<string, any>;
}

/**
 * Example bindings for common use cases
 */
export const EXAMPLE_BINDINGS = {
  // Realization metrics
  revenueUplift: {
    $bind: 'metrics.revenue_uplift',
    $source: 'realization_engine' as const,
    $transform: 'currency' as const,
    $fallback: 'Calculating...',
    $refresh: 30000, // Refresh every 30 seconds
  },

  // Loop strength
  loopStrength: {
    $bind: 'loops[0].loop_strength',
    $source: 'realization_engine' as const,
    $fallback: 'Unknown',
  },

  // Active loops count
  activeLoopsCount: {
    $bind: 'loops.filter(status=active).length',
    $source: 'realization_engine' as const,
    $transform: 'number' as const,
    $fallback: 0,
  },

  // System entities count
  entitiesCount: {
    $bind: 'entities.length',
    $source: 'system_mapper' as const,
    $transform: 'number' as const,
    $fallback: 0,
  },

  // Intervention status
  interventionStatus: {
    $bind: 'intervention.implementation_status',
    $source: 'intervention_designer' as const,
    $fallback: 'Unknown',
  },

  // Value score
  valueScore: {
    $bind: 'evaluation.total_score',
    $source: 'value_eval' as const,
    $transform: 'percentage' as const,
    $fallback: 'N/A',
  },

  // Recent memories
  recentMemories: {
    $bind: 'memories',
    $source: 'semantic_memory' as const,
    $params: {
      type: 'workflow_result',
      limit: 5,
    },
    $fallback: [],
  },

  // MCP tool result
  webSearchResults: {
    $bind: 'results',
    $source: 'mcp_tool' as const,
    $params: {
      tool: 'web_search',
      query: 'latest industry trends',
    },
    $fallback: [],
  },

  // Supabase query
  totalInterventions: {
    $bind: 'count',
    $source: 'supabase' as const,
    $params: {
      table: 'intervention_points',
      select: 'count',
      filter: { status: 'active' },
    },
    $fallback: 0,
  },
} as const;

/**
 * Helper to create a data binding
 */
export function createBinding(
  path: string,
  source: DataSourceType,
  options?: Partial<Omit<DataBinding, '$bind' | '$source'>>
): DataBinding {
  return {
    $bind: path,
    $source: source,
    ...options,
  };
}

/**
 * Helper to create a metric binding
 */
export function createMetricBinding(
  metricPath: string,
  options?: Partial<Omit<DataBinding, '$bind' | '$source'>>
): DataBinding {
  return createBinding(metricPath, 'realization_engine', {
    $transform: 'number',
    $refresh: 30000,
    ...options,
  });
}

/**
 * Helper to create a currency binding
 */
export function createCurrencyBinding(
  path: string,
  source: DataSourceType,
  options?: Partial<Omit<DataBinding, '$bind' | '$source' | '$transform'>>
): DataBinding {
  return createBinding(path, source, {
    $transform: 'currency',
    ...options,
  });
}

/**
 * Helper to create a percentage binding
 */
export function createPercentageBinding(
  path: string,
  source: DataSourceType,
  options?: Partial<Omit<DataBinding, '$bind' | '$source' | '$transform'>>
): DataBinding {
  return createBinding(path, source, {
    $transform: 'percentage',
    ...options,
  });
}

export default DataBindingSchema;
