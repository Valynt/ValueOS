"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXAMPLE_BINDINGS = exports.DataBindingSchema = void 0;
exports.isDataBinding = isDataBinding;
exports.validateDataBinding = validateDataBinding;
exports.createBinding = createBinding;
exports.createMetricBinding = createMetricBinding;
exports.createCurrencyBinding = createCurrencyBinding;
exports.createPercentageBinding = createPercentageBinding;
const zod_1 = require("zod");
/**
 * Zod schema for data binding validation
 */
exports.DataBindingSchema = zod_1.z.object({
    $bind: zod_1.z.string().min(1, 'Binding path cannot be empty'),
    $source: zod_1.z.enum([
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
    $fallback: zod_1.z.any().optional(),
    $refresh: zod_1.z.number().positive().optional(),
    $transform: zod_1.z.enum([
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
    $params: zod_1.z.record(zod_1.z.any()).optional(),
    $cache: zod_1.z.string().optional(),
    $cacheTTL: zod_1.z.number().positive().optional(),
});
/**
 * Type guard to check if a value is a data binding
 */
function isDataBinding(value) {
    return (typeof value === 'object' &&
        value !== null &&
        '$bind' in value &&
        '$source' in value);
}
/**
 * Validate data binding
 */
function validateDataBinding(value) {
    try {
        exports.DataBindingSchema.parse(value);
        return { valid: true, errors: [] };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                valid: false,
                errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
            };
        }
        return { valid: false, errors: ['Unknown validation error'] };
    }
}
/**
 * Example bindings for common use cases
 */
exports.EXAMPLE_BINDINGS = {
    // Realization metrics
    revenueUplift: {
        $bind: 'metrics.revenue_uplift',
        $source: 'realization_engine',
        $transform: 'currency',
        $fallback: 'Calculating...',
        $refresh: 30000, // Refresh every 30 seconds
    },
    // Loop strength
    loopStrength: {
        $bind: 'loops[0].loop_strength',
        $source: 'realization_engine',
        $fallback: 'Unknown',
    },
    // Active loops count
    activeLoopsCount: {
        $bind: 'loops.filter(status=active).length',
        $source: 'realization_engine',
        $transform: 'number',
        $fallback: 0,
    },
    // System entities count
    entitiesCount: {
        $bind: 'entities.length',
        $source: 'system_mapper',
        $transform: 'number',
        $fallback: 0,
    },
    // Intervention status
    interventionStatus: {
        $bind: 'intervention.implementation_status',
        $source: 'intervention_designer',
        $fallback: 'Unknown',
    },
    // Value score
    valueScore: {
        $bind: 'evaluation.total_score',
        $source: 'value_eval',
        $transform: 'percentage',
        $fallback: 'N/A',
    },
    // Recent memories
    recentMemories: {
        $bind: 'memories',
        $source: 'semantic_memory',
        $params: {
            type: 'workflow_result',
            limit: 5,
        },
        $fallback: [],
    },
    // MCP tool result
    webSearchResults: {
        $bind: 'results',
        $source: 'mcp_tool',
        $params: {
            tool: 'web_search',
            query: 'latest industry trends',
        },
        $fallback: [],
    },
    // Supabase query
    totalInterventions: {
        $bind: 'count',
        $source: 'supabase',
        $params: {
            table: 'intervention_points',
            select: 'count',
            filter: { status: 'active' },
        },
        $fallback: 0,
    },
};
/**
 * Helper to create a data binding
 */
function createBinding(path, source, options) {
    return {
        $bind: path,
        $source: source,
        ...options,
    };
}
/**
 * Helper to create a metric binding
 */
function createMetricBinding(metricPath, options) {
    return createBinding(metricPath, 'realization_engine', {
        $transform: 'number',
        $refresh: 30000,
        ...options,
    });
}
/**
 * Helper to create a currency binding
 */
function createCurrencyBinding(path, source, options) {
    return createBinding(path, source, {
        $transform: 'currency',
        ...options,
    });
}
/**
 * Helper to create a percentage binding
 */
function createPercentageBinding(path, source, options) {
    return createBinding(path, source, {
        $transform: 'percentage',
        ...options,
    });
}
exports.default = exports.DataBindingSchema;
//# sourceMappingURL=DataBindingSchema.js.map