/**
 * VMRT (Value Metrics Reference Templates) Part 1 - Seed Data
 * 
 * Predefined templates for common value metrics across different industries
 * and lifecycle stages.
 */

import { VMRTSeed } from './vos';

// ============================================================================
// Opportunity Stage Seeds
// ============================================================================

const OPPORTUNITY_SEEDS: VMRTSeed[] = [
  {
    id: 'opp_cost_reduction',
    name: 'Cost Reduction Opportunity',
    description: 'Identify opportunities to reduce operational costs',
    category: 'financial',
    lifecycle_stage: 'opportunity',
    default_kpis: [
      'Current operational cost',
      'Target cost reduction %',
      'Estimated annual savings',
    ],
    suggested_benchmarks: ['Industry average cost per unit', 'Best-in-class efficiency'],
    template_data: {
      metric_types: ['financial', 'operational'],
      common_areas: ['labor', 'materials', 'overhead', 'waste'],
    },
  },
  {
    id: 'opp_revenue_growth',
    name: 'Revenue Growth Opportunity',
    description: 'Identify opportunities for revenue expansion',
    category: 'financial',
    lifecycle_stage: 'opportunity',
    default_kpis: [
      'Current revenue',
      'Target revenue growth %',
      'Market size',
      'Market share',
    ],
    suggested_benchmarks: ['Industry growth rate', 'Competitor revenue growth'],
    template_data: {
      metric_types: ['financial', 'strategic'],
      common_areas: ['new_markets', 'new_products', 'pricing', 'upsell'],
    },
  },
];

// ============================================================================
// Target Stage Seeds
// ============================================================================

const TARGET_SEEDS: VMRTSeed[] = [
  {
    id: 'tgt_efficiency_improvement',
    name: 'Efficiency Improvement Target',
    description: 'Set targets for operational efficiency gains',
    category: 'operational',
    lifecycle_stage: 'target',
    default_kpis: [
      'Baseline efficiency metric',
      'Target efficiency metric',
      'Timeline to achieve',
      'Resources required',
    ],
    suggested_benchmarks: ['Industry standard efficiency', 'Best practice targets'],
    template_data: {
      metric_types: ['operational', 'financial'],
      success_criteria: ['throughput', 'cycle_time', 'utilization'],
    },
  },
];

// ============================================================================
// Realization Stage Seeds
// ============================================================================

const REALIZATION_SEEDS: VMRTSeed[] = [
  {
    id: 'real_implementation',
    name: 'Implementation Tracking',
    description: 'Track implementation progress and early results',
    category: 'operational',
    lifecycle_stage: 'realization',
    default_kpis: [
      'Milestone completion %',
      'Budget spent vs planned',
      'Early results vs baseline',
      'Risk materialization',
    ],
    suggested_benchmarks: ['Project management benchmarks', 'Change management success rates'],
    template_data: {
      metric_types: ['operational', 'financial'],
      tracking_areas: ['milestones', 'budget', 'resources', 'risks'],
    },
  },
];

// ============================================================================
// Expansion Stage Seeds
// ============================================================================

const EXPANSION_SEEDS: VMRTSeed[] = [
  {
    id: 'exp_scale',
    name: 'Scaling Strategy',
    description: 'Plan for scaling successful initiatives',
    category: 'strategic',
    lifecycle_stage: 'expansion',
    default_kpis: [
      'Current deployment scope',
      'Target deployment scope',
      'Scaling timeline',
      'Incremental value capture',
    ],
    suggested_benchmarks: ['Scaling success rates', 'Time to scale'],
    template_data: {
      metric_types: ['strategic', 'operational', 'financial'],
      scaling_dimensions: ['geographic', 'departmental', 'product_line'],
    },
  },
];

// ============================================================================
// Integrity Stage Seeds
// ============================================================================

const INTEGRITY_SEEDS: VMRTSeed[] = [
  {
    id: 'int_validation',
    name: 'Value Validation',
    description: 'Validate claimed value against actual results',
    category: 'strategic',
    lifecycle_stage: 'integrity',
    default_kpis: [
      'Claimed value',
      'Actual value realized',
      'Variance %',
      'Confidence level',
    ],
    suggested_benchmarks: ['Value realization rates', 'Forecast accuracy'],
    template_data: {
      metric_types: ['financial', 'operational', 'strategic'],
      validation_methods: ['data_analysis', 'stakeholder_feedback', 'audit'],
    },
  },
];

// ============================================================================
// All Seeds Export
// ============================================================================

export const ALL_VMRT_SEEDS: VMRTSeed[] = [
  ...OPPORTUNITY_SEEDS,
  ...TARGET_SEEDS,
  ...REALIZATION_SEEDS,
  ...EXPANSION_SEEDS,
  ...INTEGRITY_SEEDS,
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getSeedsByStage(stage: string): VMRTSeed[] {
  return ALL_VMRT_SEEDS.filter(seed => seed.lifecycle_stage === stage);
}

export function getSeedById(id: string): VMRTSeed | undefined {
  return ALL_VMRT_SEEDS.find(seed => seed.id === id);
}

export function getSeedsByCategory(category: string): VMRTSeed[] {
  return ALL_VMRT_SEEDS.filter(seed => seed.category === category);
}
