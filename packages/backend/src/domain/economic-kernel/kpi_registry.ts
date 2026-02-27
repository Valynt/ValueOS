/**
 * Canonical KPI Registry
 *
 * Maps stable metric IDs (UUIDs) to neutral metric definitions.
 * No narrative strings, no sector-specific labels — those belong in overlays.
 *
 * Each metric has:
 * - A stable UUID that never changes (used in calculations and storage)
 * - A neutral internal name (snake_case, no marketing language)
 * - A category from the EVF schema (revenue, cost, risk, efficiency)
 * - A unit type for dimensional consistency
 * - Driver mappings linking to value driver categories
 */

import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const MetricCategory = z.enum(['revenue', 'cost', 'risk', 'efficiency']);
export type MetricCategory = z.infer<typeof MetricCategory>;

export const MetricUnit = z.enum([
  'currency',
  'percentage',
  'ratio',
  'months',
  'days',
  'count',
  'hours',
  'basis_points',
]);
export type MetricUnit = z.infer<typeof MetricUnit>;

export const DriverCategory = z.enum([
  'revenue_growth',
  'cost_reduction',
  'risk_mitigation',
  'efficiency_gain',
  'capital_efficiency',
]);
export type DriverCategory = z.infer<typeof DriverCategory>;

export const AggregationMethod = z.enum(['sum', 'average', 'weighted_average', 'latest', 'min', 'max']);
export type AggregationMethod = z.infer<typeof AggregationMethod>;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const MetricDefinitionSchema = z.object({
  /** Stable UUID — never changes across versions */
  id: z.string().uuid(),
  /** Internal name — snake_case, no narrative */
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Must be snake_case'),
  /** EVF category */
  category: MetricCategory,
  /** Measurement unit */
  unit: MetricUnit,
  /** How to aggregate across periods or entities */
  aggregation: AggregationMethod,
  /** Which driver categories feed into this metric */
  driverCategories: z.array(DriverCategory),
  /** Whether higher values are better (true) or worse (false) */
  higherIsBetter: z.boolean(),
  /** Minimum valid value (inclusive) */
  validRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }),
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

// ─── Canonical Metric IDs ────────────────────────────────────────────────────
// These UUIDs are frozen. Do not change them.

export const METRIC_IDS = {
  NET_PRESENT_VALUE: '550e8400-e29b-41d4-a716-446655440001',
  INTERNAL_RATE_OF_RETURN: '550e8400-e29b-41d4-a716-446655440002',
  RETURN_ON_INVESTMENT: '550e8400-e29b-41d4-a716-446655440003',
  PAYBACK_PERIOD: '550e8400-e29b-41d4-a716-446655440004',
  TOTAL_COST_OF_OWNERSHIP: '550e8400-e29b-41d4-a716-446655440005',
  REVENUE_UPLIFT: '550e8400-e29b-41d4-a716-446655440006',
  COST_REDUCTION: '550e8400-e29b-41d4-a716-446655440007',
  RISK_ADJUSTED_VALUE: '550e8400-e29b-41d4-a716-446655440008',
  EFFICIENCY_GAIN: '550e8400-e29b-41d4-a716-446655440009',
  CUSTOMER_ACQUISITION_COST: '550e8400-e29b-41d4-a716-446655440010',
  CUSTOMER_LIFETIME_VALUE: '550e8400-e29b-41d4-a716-446655440011',
  NET_REVENUE_RETENTION: '550e8400-e29b-41d4-a716-446655440012',
  CHURN_RATE: '550e8400-e29b-41d4-a716-446655440013',
  GROSS_MARGIN: '550e8400-e29b-41d4-a716-446655440014',
  OPERATING_MARGIN: '550e8400-e29b-41d4-a716-446655440015',
  DISCOUNT_RATE: '550e8400-e29b-41d4-a716-446655440016',
  TIME_TO_VALUE: '550e8400-e29b-41d4-a716-446655440017',
  ANNUAL_CONTRACT_VALUE: '550e8400-e29b-41d4-a716-446655440018',
} as const;

// ─── Canonical Registry ──────────────────────────────────────────────────────

export const CANONICAL_METRICS: ReadonlyArray<MetricDefinition> = [
  {
    id: METRIC_IDS.NET_PRESENT_VALUE,
    name: 'net_present_value',
    category: 'revenue',
    unit: 'currency',
    aggregation: 'sum',
    driverCategories: ['revenue_growth', 'cost_reduction'],
    higherIsBetter: true,
    validRange: {},
  },
  {
    id: METRIC_IDS.INTERNAL_RATE_OF_RETURN,
    name: 'internal_rate_of_return',
    category: 'revenue',
    unit: 'percentage',
    aggregation: 'weighted_average',
    driverCategories: ['revenue_growth', 'cost_reduction', 'capital_efficiency'],
    higherIsBetter: true,
    validRange: { min: -1, max: 10 },
  },
  {
    id: METRIC_IDS.RETURN_ON_INVESTMENT,
    name: 'return_on_investment',
    category: 'revenue',
    unit: 'percentage',
    aggregation: 'weighted_average',
    driverCategories: ['revenue_growth', 'cost_reduction'],
    higherIsBetter: true,
    validRange: { min: -1 },
  },
  {
    id: METRIC_IDS.PAYBACK_PERIOD,
    name: 'payback_period',
    category: 'efficiency',
    unit: 'months',
    aggregation: 'average',
    driverCategories: ['revenue_growth', 'cost_reduction'],
    higherIsBetter: false,
    validRange: { min: 0 },
  },
  {
    id: METRIC_IDS.TOTAL_COST_OF_OWNERSHIP,
    name: 'total_cost_of_ownership',
    category: 'cost',
    unit: 'currency',
    aggregation: 'sum',
    driverCategories: ['cost_reduction'],
    higherIsBetter: false,
    validRange: { min: 0 },
  },
  {
    id: METRIC_IDS.REVENUE_UPLIFT,
    name: 'revenue_uplift',
    category: 'revenue',
    unit: 'currency',
    aggregation: 'sum',
    driverCategories: ['revenue_growth'],
    higherIsBetter: true,
    validRange: {},
  },
  {
    id: METRIC_IDS.COST_REDUCTION,
    name: 'cost_reduction',
    category: 'cost',
    unit: 'currency',
    aggregation: 'sum',
    driverCategories: ['cost_reduction'],
    higherIsBetter: true,
    validRange: { min: 0 },
  },
  {
    id: METRIC_IDS.RISK_ADJUSTED_VALUE,
    name: 'risk_adjusted_value',
    category: 'risk',
    unit: 'currency',
    aggregation: 'sum',
    driverCategories: ['risk_mitigation'],
    higherIsBetter: true,
    validRange: {},
  },
  {
    id: METRIC_IDS.EFFICIENCY_GAIN,
    name: 'efficiency_gain',
    category: 'efficiency',
    unit: 'percentage',
    aggregation: 'average',
    driverCategories: ['efficiency_gain'],
    higherIsBetter: true,
    validRange: { min: 0, max: 1 },
  },
  {
    id: METRIC_IDS.CUSTOMER_ACQUISITION_COST,
    name: 'customer_acquisition_cost',
    category: 'cost',
    unit: 'currency',
    aggregation: 'average',
    driverCategories: ['cost_reduction', 'efficiency_gain'],
    higherIsBetter: false,
    validRange: { min: 0 },
  },
  {
    id: METRIC_IDS.CUSTOMER_LIFETIME_VALUE,
    name: 'customer_lifetime_value',
    category: 'revenue',
    unit: 'currency',
    aggregation: 'average',
    driverCategories: ['revenue_growth'],
    higherIsBetter: true,
    validRange: { min: 0 },
  },
  {
    id: METRIC_IDS.NET_REVENUE_RETENTION,
    name: 'net_revenue_retention',
    category: 'revenue',
    unit: 'percentage',
    aggregation: 'weighted_average',
    driverCategories: ['revenue_growth', 'risk_mitigation'],
    higherIsBetter: true,
    validRange: { min: 0 },
  },
  {
    id: METRIC_IDS.CHURN_RATE,
    name: 'churn_rate',
    category: 'risk',
    unit: 'percentage',
    aggregation: 'average',
    driverCategories: ['risk_mitigation'],
    higherIsBetter: false,
    validRange: { min: 0, max: 1 },
  },
  {
    id: METRIC_IDS.GROSS_MARGIN,
    name: 'gross_margin',
    category: 'revenue',
    unit: 'percentage',
    aggregation: 'weighted_average',
    driverCategories: ['revenue_growth', 'cost_reduction'],
    higherIsBetter: true,
    validRange: { min: -1, max: 1 },
  },
  {
    id: METRIC_IDS.OPERATING_MARGIN,
    name: 'operating_margin',
    category: 'revenue',
    unit: 'percentage',
    aggregation: 'weighted_average',
    driverCategories: ['revenue_growth', 'cost_reduction'],
    higherIsBetter: true,
    validRange: { min: -1, max: 1 },
  },
  {
    id: METRIC_IDS.DISCOUNT_RATE,
    name: 'discount_rate',
    category: 'risk',
    unit: 'percentage',
    aggregation: 'latest',
    driverCategories: ['capital_efficiency'],
    higherIsBetter: false,
    validRange: { min: 0, max: 1 },
  },
  {
    id: METRIC_IDS.TIME_TO_VALUE,
    name: 'time_to_value',
    category: 'efficiency',
    unit: 'days',
    aggregation: 'average',
    driverCategories: ['efficiency_gain'],
    higherIsBetter: false,
    validRange: { min: 0 },
  },
  {
    id: METRIC_IDS.ANNUAL_CONTRACT_VALUE,
    name: 'annual_contract_value',
    category: 'revenue',
    unit: 'currency',
    aggregation: 'sum',
    driverCategories: ['revenue_growth'],
    higherIsBetter: true,
    validRange: { min: 0 },
  },
];

// ─── Registry Access ─────────────────────────────────────────────────────────

const _byId = new Map<string, MetricDefinition>(
  CANONICAL_METRICS.map((m) => [m.id, m])
);

const _byName = new Map<string, MetricDefinition>(
  CANONICAL_METRICS.map((m) => [m.name, m])
);

/**
 * Look up a metric by its stable UUID.
 */
export function getMetricById(id: string): MetricDefinition | undefined {
  return _byId.get(id);
}

/**
 * Look up a metric by its internal name.
 */
export function getMetricByName(name: string): MetricDefinition | undefined {
  return _byName.get(name);
}

/**
 * Get all metrics in a given EVF category.
 */
export function getMetricsByCategory(category: MetricCategory): MetricDefinition[] {
  return CANONICAL_METRICS.filter((m) => m.category === category);
}

/**
 * Get all metrics that accept a given driver category.
 */
export function getMetricsByDriverCategory(driverCategory: DriverCategory): MetricDefinition[] {
  return CANONICAL_METRICS.filter((m) => m.driverCategories.includes(driverCategory));
}

/**
 * Validate that all registry entries conform to the schema.
 * Throws on first invalid entry.
 */
export function validateRegistry(): void {
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const metric of CANONICAL_METRICS) {
    MetricDefinitionSchema.parse(metric);

    if (ids.has(metric.id)) {
      throw new Error(`Duplicate metric ID: ${metric.id}`);
    }
    ids.add(metric.id);

    if (names.has(metric.name)) {
      throw new Error(`Duplicate metric name: ${metric.name}`);
    }
    names.add(metric.name);
  }
}
