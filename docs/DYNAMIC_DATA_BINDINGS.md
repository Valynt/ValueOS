# Dynamic Data Bindings for SDUI

## Overview

Dynamic Data Bindings enable SDUI components to display **live data** that updates automatically without requiring LLM regeneration. Instead of hardcoding values like `"$1.2M"`, agents write "pointers" to data sources that are resolved at runtime.

This solves the critical problem of **stale reports**: when underlying data (CRM, telemetry, metrics) changes, the UI stays fresh automatically.

## The Problem

**Before (Static Values)**:
```typescript
// Agent generates this once
{
  type: 'metric-card',
  props: {
    title: 'Revenue Uplift',
    value: '$1.2M'  // ❌ Hardcoded - becomes stale immediately
  }
}
```

When the actual revenue changes to $1.5M, the report still shows $1.2M until the agent regenerates the entire UI.

## The Solution

**After (Dynamic Bindings)**:
```typescript
// Agent generates this once
{
  type: 'metric-card',
  props: {
    title: 'Revenue Uplift',
    value: {
      $bind: 'metrics.revenue_uplift',
      $source: 'realization_engine',
      $transform: 'currency',
      $fallback: 'Calculating...',
      $refresh: 30000  // Update every 30 seconds
    }
  }
}
```

The UI automatically fetches and displays the latest value every 30 seconds. No LLM regeneration needed.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SDUI Renderer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Component Props                                      │  │
│  │  { value: { $bind: "...", $source: "..." } }        │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DataBindingResolver                                  │  │
│  │  - Validates binding schema                          │  │
│  │  - Routes to appropriate data source                 │  │
│  │  - Applies transforms (currency, percentage, etc.)   │  │
│  │  - Caches results                                    │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐          ┌────────────────┐
│ Data Sources  │          │  MCP Tools     │
│ - Supabase    │          │ - Web Search   │
│ - Agents      │          │ - Financial    │
│ - Memory      │          │ - Custom       │
└───────────────┘          └────────────────┘
```

## Data Binding Schema

### Basic Structure

```typescript
interface DataBinding {
  $bind: string;              // Path to data (e.g., "metrics.revenue_uplift")
  $source: DataSourceType;    // Where to fetch from
  $fallback?: any;            // Value to show while loading or on error
  $refresh?: number;          // Auto-refresh interval in milliseconds
  $transform?: TransformFunction;  // Format the value
  $params?: Record<string, any>;   // Additional parameters
  $cache?: string;            // Cache key
  $cacheTTL?: number;         // Cache time-to-live in milliseconds
}
```

### Data Sources

| Source | Description | Example Use Case |
|--------|-------------|------------------|
| `realization_engine` | RealizationLoopAgent metrics | Revenue uplift, loop strength, behavior changes |
| `system_mapper` | SystemMapperAgent entities | Entity counts, relationship graphs |
| `intervention_designer` | InterventionDesignerAgent | Intervention status, feasibility scores |
| `outcome_engineer` | OutcomeEngineerAgent | Outcome hypotheses, KPI targets |
| `value_eval` | ValueEvalAgent | Value scores, evaluation results |
| `semantic_memory` | SemanticMemoryService | Past successes, similar cases |
| `tool_registry` | ToolRegistry | MCP tool execution results |
| `mcp_tool` | MCP tools (alias) | Web search, financial calculations |
| `supabase` | Direct Supabase queries | Custom queries, aggregations |

### Transform Functions

| Transform | Input | Output | Use Case |
|-----------|-------|--------|----------|
| `currency` | `1200000` | `"$1.2M"` | Money values |
| `percentage` | `0.85` | `"85%"` | Percentages |
| `number` | `1234567` | `"1,234,567"` | Large numbers |
| `date` | `"2024-01-15"` | `"Jan 15, 2024"` | Dates |
| `relative_time` | `"2024-01-15T10:00:00Z"` | `"2 hours ago"` | Timestamps |
| `round` | `3.14159` | `3.14` | Decimals |
| `array_length` | `[1,2,3]` | `3` | Count items |
| `sum` | `[10,20,30]` | `60` | Total |
| `average` | `[10,20,30]` | `20` | Mean |
| `max` | `[10,20,30]` | `30` | Maximum |
| `min` | `[10,20,30]` | `10` | Minimum |

## Usage Examples

### Example 1: Live Revenue Metric

```typescript
{
  type: 'metric-card',
  props: {
    title: 'Revenue Uplift',
    value: {
      $bind: 'metrics.revenue_uplift',
      $source: 'realization_engine',
      $transform: 'currency',
      $fallback: 'Calculating...',
      $refresh: 30000  // Update every 30 seconds
    },
    icon: 'dollar-sign',
    trend: 'up'
  }
}
```

### Example 2: Active Feedback Loops Count

```typescript
{
  type: 'metric-card',
  props: {
    title: 'Active Loops',
    value: {
      $bind: 'loops.filter(realization_stage=active).length',
      $source: 'realization_engine',
      $transform: 'number',
      $fallback: 0,
      $refresh: 30000
    }
  }
}
```

### Example 3: Loop Strength

```typescript
{
  type: 'metric-card',
  props: {
    title: 'Loop Strength',
    value: {
      $bind: 'loops[0].loop_strength',
      $source: 'realization_engine',
      $fallback: 'Unknown',
      $refresh: 30000
    }
  }
}
```

### Example 4: Recent Behavior Changes (Table)

```typescript
{
  type: 'data-table',
  props: {
    title: 'Recent Behavior Changes',
    headers: ['Entity', 'Change', 'Evidence', 'Time'],
    rows: {
      $bind: 'behavior_changes',
      $source: 'realization_engine',
      $params: { limit: 5 },
      $fallback: [],
      $refresh: 60000  // Update every minute
    }
  }
}
```

### Example 5: Web Search Results (MCP Tool)

```typescript
{
  type: 'data-list',
  props: {
    title: 'Industry Trends',
    items: {
      $bind: 'results',
      $source: 'mcp_tool',
      $params: {
        tool: 'web_search',
        parameters: {
          query: 'enterprise AI trends 2025'
        }
      },
      $fallback: [],
      $cache: 'industry_trends',
      $cacheTTL: 3600000  // Cache for 1 hour
    }
  }
}
```

### Example 6: Semantic Memory Search

```typescript
{
  type: 'insight-panel',
  props: {
    title: 'Similar Past Successes',
    insights: {
      $bind: 'memories',
      $source: 'semantic_memory',
      $params: {
        type: 'workflow_result',
        limit: 3
      },
      $fallback: []
    }
  }
}
```

### Example 7: Custom Supabase Query

```typescript
{
  type: 'metric-card',
  props: {
    title: 'Total Active Interventions',
    value: {
      $bind: 'count',
      $source: 'supabase',
      $params: {
        table: 'intervention_points',
        select: 'count',
        filter: { status: 'active' }
      },
      $transform: 'number',
      $fallback: 0
    }
  }
}
```

## Path Syntax

The `$bind` path supports several powerful patterns:

### Simple Property Access
```typescript
$bind: 'metrics.revenue'  // data.metrics.revenue
```

### Array Index
```typescript
$bind: 'loops[0].strength'  // data.loops[0].strength
```

### Array Filter
```typescript
$bind: 'loops.filter(status=active)'  // data.loops.filter(l => l.status === 'active')
```

### Array Methods
```typescript
$bind: 'loops.length'           // data.loops.length
$bind: 'values.sum'             // sum of all values
$bind: 'values.average'         // average of all values
$bind: 'values.max'             // maximum value
$bind: 'values.min'             // minimum value
```

### Chaining
```typescript
$bind: 'loops.filter(status=active).length'  // Count active loops
```

## Helper Functions

### createBinding
```typescript
import { createBinding } from '../sdui/DataBindingSchema';

const binding = createBinding(
  'metrics.revenue_uplift',
  'realization_engine',
  {
    $transform: 'currency',
    $fallback: 'Calculating...',
    $refresh: 30000
  }
);
```

### createMetricBinding
```typescript
import { createMetricBinding } from '../sdui/DataBindingSchema';

const binding = createMetricBinding('loops.length', {
  $fallback: 0,
  $refresh: 30000
});
```

### createCurrencyBinding
```typescript
import { createCurrencyBinding } from '../sdui/DataBindingSchema';

const binding = createCurrencyBinding(
  'metrics.revenue_uplift',
  'realization_engine',
  {
    $fallback: 'Calculating...',
    $refresh: 30000
  }
);
```

### createPercentageBinding
```typescript
import { createPercentageBinding } from '../sdui/DataBindingSchema';

const binding = createPercentageBinding(
  'evaluation.total_score',
  'value_eval',
  {
    $fallback: 'N/A'
  }
);
```

## React Integration

### Using the Hook

```typescript
import { useDataBinding } from '../sdui/useDataBinding';

function MyComponent({ value, resolver, context }) {
  const { value: resolvedValue, loading, error } = useDataBinding(value, {
    resolver,
    context,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{resolvedValue}</div>;
}
```

### Using the HOC

```typescript
import { withDataBindings } from '../sdui/useDataBinding';

const MyComponent = ({ value }) => <div>{value}</div>;

const MyComponentWithBindings = withDataBindings(
  MyComponent,
  resolver,
  context
);
```

### Automatic Resolution in SDUIRenderer

```typescript
import { SDUIRenderer } from '../sdui/renderer';
import { DataBindingResolver } from '../sdui/DataBindingResolver';

const resolver = new DataBindingResolver({
  toolRegistry,
  semanticMemory,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
});

const context = {
  organizationId: 'org-123',
  userId: 'user-456',
  sessionId: 'session-789',
};

<SDUIRenderer
  schema={sduiSchema}
  dataBindingResolver={resolver}
  dataSourceContext={context}
/>
```

## Agent Guidelines

When generating SDUI with data bindings, agents should:

### 1. Use Bindings for Dynamic Data

✅ **DO**: Use bindings for metrics that change
```typescript
value: {
  $bind: 'metrics.revenue_uplift',
  $source: 'realization_engine',
  $transform: 'currency',
  $fallback: 'Calculating...'
}
```

❌ **DON'T**: Hardcode values that will change
```typescript
value: '$1.2M'  // Will become stale
```

### 2. Always Provide Fallbacks

✅ **DO**: Provide meaningful fallbacks
```typescript
$fallback: 'Calculating...'  // For loading states
$fallback: 0                 // For numeric values
$fallback: []                // For arrays
$fallback: 'Unknown'         // For status fields
```

❌ **DON'T**: Omit fallbacks
```typescript
// No fallback - shows null/undefined on error
```

### 3. Set Appropriate Refresh Intervals

✅ **DO**: Match refresh rate to data volatility
```typescript
$refresh: 5000    // 5s for real-time metrics
$refresh: 30000   // 30s for frequently changing data
$refresh: 300000  // 5min for slowly changing data
```

❌ **DON'T**: Refresh too frequently
```typescript
$refresh: 1000  // Every second - excessive API calls
```

### 4. Use Transforms for Formatting

✅ **DO**: Let transforms handle formatting
```typescript
value: {
  $bind: 'metrics.revenue',
  $transform: 'currency'  // Handles $1.2M formatting
}
```

❌ **DON'T**: Format in the binding path
```typescript
$bind: 'metrics.revenue_formatted'  // Requires backend formatting
```

### 5. Cache Expensive Operations

✅ **DO**: Cache slow queries
```typescript
{
  $bind: 'results',
  $source: 'mcp_tool',
  $cache: 'web_search_results',
  $cacheTTL: 3600000  // 1 hour
}
```

❌ **DON'T**: Skip caching for expensive operations
```typescript
// No cache - hits API every time
```

## Performance Considerations

### Caching Strategy

1. **Short TTL (1-5 minutes)**: Real-time metrics
2. **Medium TTL (15-60 minutes)**: Frequently accessed data
3. **Long TTL (1-24 hours)**: Rarely changing data

### Refresh Intervals

1. **5-10 seconds**: Critical real-time metrics
2. **30-60 seconds**: Standard dashboard metrics
3. **5-15 minutes**: Background data

### Batch Resolution

The resolver automatically batches multiple bindings from the same source:

```typescript
// These will be resolved in a single query
const bindings = [
  { $bind: 'metrics.revenue', $source: 'realization_engine' },
  { $bind: 'metrics.cost', $source: 'realization_engine' },
  { $bind: 'metrics.roi', $source: 'realization_engine' },
];
```

## Error Handling

### Graceful Degradation

Bindings always fall back to `$fallback` on error:

```typescript
{
  $bind: 'metrics.revenue',
  $source: 'realization_engine',
  $fallback: 'Calculating...'  // Shown on error
}
```

### Error States

The resolver provides detailed error information:

```typescript
const { value, error, success } = await resolver.resolve(binding, context);

if (!success) {
  console.error('Binding failed:', error);
  // value === binding.$fallback
}
```

### Loading States

Components show loading indicators while resolving:

```typescript
const { value, loading } = useDataBinding(binding, options);

if (loading) {
  return <Skeleton />;
}
```

## Testing

### Mock Resolver

```typescript
import { DataBindingResolver } from '../sdui/DataBindingResolver';

const mockResolver = new DataBindingResolver();

mockResolver.registerResolver('realization_engine', async (binding) => {
  return {
    metrics: {
      revenue_uplift: 1200000,
    },
  };
});
```

### Test Bindings

```typescript
import { validateDataBinding } from '../sdui/DataBindingSchema';

test('validates binding schema', () => {
  const binding = {
    $bind: 'metrics.revenue',
    $source: 'realization_engine',
    $transform: 'currency',
  };

  const result = validateDataBinding(binding);
  expect(result.valid).toBe(true);
});
```

## Migration Guide

### From Static to Dynamic

**Before**:
```typescript
{
  type: 'metric-card',
  props: {
    title: 'Revenue',
    value: '$1.2M'
  }
}
```

**After**:
```typescript
{
  type: 'metric-card',
  props: {
    title: 'Revenue',
    value: {
      $bind: 'metrics.revenue_uplift',
      $source: 'realization_engine',
      $transform: 'currency',
      $fallback: 'Calculating...',
      $refresh: 30000
    }
  }
}
```

### Backward Compatibility

Static values still work - no breaking changes:

```typescript
// This still works
value: '$1.2M'

// This also works
value: {
  $bind: 'metrics.revenue',
  $source: 'realization_engine'
}
```

## Best Practices Summary

1. ✅ Use bindings for data that changes over time
2. ✅ Always provide meaningful fallbacks
3. ✅ Set appropriate refresh intervals
4. ✅ Use transforms for formatting
5. ✅ Cache expensive operations
6. ✅ Batch bindings from the same source
7. ✅ Handle loading and error states gracefully
8. ✅ Test bindings with mock resolvers

## Troubleshooting

### Binding Not Resolving

**Problem**: Value shows fallback instead of data

**Solutions**:
1. Check data source is configured
2. Verify binding path is correct
3. Check permissions/authentication
4. Review resolver logs

### Slow Performance

**Problem**: UI feels sluggish

**Solutions**:
1. Increase cache TTL
2. Reduce refresh frequency
3. Batch related bindings
4. Use pagination for large datasets

### Stale Data

**Problem**: Data not updating

**Solutions**:
1. Check refresh interval is set
2. Verify cache TTL is appropriate
3. Clear cache manually if needed
4. Check data source is updating

## API Reference

See:
- [DataBindingSchema.ts](../src/sdui/DataBindingSchema.ts) - Schema definitions
- [DataBindingResolver.ts](../src/sdui/DataBindingResolver.ts) - Resolver implementation
- [useDataBinding.tsx](../src/sdui/useDataBinding.tsx) - React hooks
- [ComponentToolRegistry.ts](../src/sdui/ComponentToolRegistry.ts) - Component documentation

## Examples

See:
- [TemplateLibrary.ts](../src/services/TemplateLibrary.ts) - Live dashboard templates
- [EXAMPLE_BINDINGS](../src/sdui/DataBindingSchema.ts) - Common binding patterns
