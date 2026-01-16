/**
 * Default Value Case Templates
 * 
 * Pre-built templates for common value case scenarios.
 */

import type { 
  ValueCaseTemplate, 
  MetricDefinition, 
  ValueDriverTemplate,
  AssumptionTemplate,
} from './types';

// ============================================
// METRIC DEFINITIONS
// ============================================

export const DEFAULT_METRICS: Record<string, MetricDefinition> = {
  // Justification Metrics (CFO View)
  roi: {
    id: 'roi',
    type: 'roi',
    name: 'Return on Investment',
    description: 'Percentage return relative to the investment cost',
    category: 'justification',
    format: 'percent',
    icon: 'TrendingUp',
    color: 'emerald',
    formula: '((Total Benefits - Total Costs) / Total Costs) × 100',
    bestUsedFor: 'Final budget approval',
    stakeholder: 'cfo',
    inputs: [
      { id: 'total_benefits', label: 'Total Benefits', type: 'currency', defaultValue: 1000000 },
      { id: 'total_costs', label: 'Total Costs', type: 'currency', defaultValue: 250000 },
    ],
  },
  
  npv: {
    id: 'npv',
    type: 'npv',
    name: 'Net Present Value',
    description: 'Total value of future cash flows minus initial investment, adjusted for time value of money',
    category: 'justification',
    format: 'currency',
    icon: 'DollarSign',
    color: 'emerald',
    formula: 'Σ(Cash Flow / (1 + r)^t) - Initial Investment',
    bestUsedFor: 'Proving project generates real cash value',
    stakeholder: 'cfo',
    inputs: [
      { id: 'initial_investment', label: 'Initial Investment', type: 'currency', defaultValue: 250000 },
      { id: 'annual_benefit', label: 'Annual Benefit', type: 'currency', defaultValue: 500000 },
      { id: 'discount_rate', label: 'Discount Rate', type: 'percent', defaultValue: 10 },
      { id: 'years', label: 'Time Horizon (Years)', type: 'number', defaultValue: 3 },
    ],
  },
  
  tco: {
    id: 'tco',
    type: 'tco',
    name: 'Total Cost of Ownership',
    description: 'Complete cost including purchase, implementation, operation, and maintenance',
    category: 'justification',
    format: 'currency',
    icon: 'Calculator',
    color: 'slate',
    formula: 'Initial Cost + Implementation + (Annual Operating Cost × Years)',
    bestUsedFor: 'Comparing solution costs over time',
    stakeholder: 'cfo',
    inputs: [
      { id: 'initial_cost', label: 'Initial Cost', type: 'currency', defaultValue: 100000 },
      { id: 'implementation', label: 'Implementation Cost', type: 'currency', defaultValue: 50000 },
      { id: 'annual_operating', label: 'Annual Operating Cost', type: 'currency', defaultValue: 30000 },
      { id: 'years', label: 'Time Horizon (Years)', type: 'number', defaultValue: 3 },
    ],
  },
  
  irr: {
    id: 'irr',
    type: 'irr',
    name: 'Internal Rate of Return',
    description: 'Expected compound annual rate of return on the investment',
    category: 'justification',
    format: 'percent',
    icon: 'Percent',
    color: 'blue',
    formula: 'Rate where NPV = 0',
    bestUsedFor: 'Comparing against other internal investments',
    stakeholder: 'cfo',
  },

  // Speed Metrics (Risk View)
  ttv: {
    id: 'ttv',
    type: 'ttv',
    name: 'Time to Value',
    description: 'Time from purchase to first measurable value realization',
    category: 'speed',
    format: 'months',
    icon: 'Clock',
    color: 'blue',
    bestUsedFor: 'Setting expectations and reducing perceived risk',
    stakeholder: 'executive',
    inputs: [
      { id: 'implementation_weeks', label: 'Implementation (Weeks)', type: 'number', defaultValue: 8 },
      { id: 'adoption_weeks', label: 'Adoption Ramp (Weeks)', type: 'number', defaultValue: 4 },
    ],
  },
  
  payback: {
    id: 'payback',
    type: 'payback',
    name: 'Payback Period',
    description: 'Time for savings/revenue to cover the initial investment',
    category: 'speed',
    format: 'months',
    icon: 'Timer',
    color: 'amber',
    formula: 'Initial Investment / Monthly Benefit',
    bestUsedFor: 'Measuring investment risk - shorter is better',
    stakeholder: 'cfo',
    inputs: [
      { id: 'initial_investment', label: 'Initial Investment', type: 'currency', defaultValue: 250000 },
      { id: 'monthly_benefit', label: 'Monthly Benefit', type: 'currency', defaultValue: 35000 },
    ],
  },

  // Impact Metrics (User View)
  fte_savings: {
    id: 'fte_savings',
    type: 'fte_savings',
    name: 'FTE Savings',
    description: 'Time saved expressed as full-time employee equivalents',
    category: 'impact',
    format: 'headcount',
    icon: 'Users',
    color: 'purple',
    formula: 'Hours Saved / 2080 (annual work hours)',
    bestUsedFor: 'Justifying staff reallocation to higher-value work',
    stakeholder: 'user',
    inputs: [
      { id: 'hours_saved', label: 'Annual Hours Saved', type: 'number', defaultValue: 10000 },
      { id: 'hourly_rate', label: 'Avg Hourly Rate', type: 'currency', defaultValue: 75 },
    ],
  },
  
  revenue_uplift: {
    id: 'revenue_uplift',
    type: 'revenue_uplift',
    name: 'Revenue Uplift',
    description: 'New revenue enabled by the solution',
    category: 'impact',
    format: 'currency',
    icon: 'TrendingUp',
    color: 'emerald',
    bestUsedFor: 'Growth-focused business cases',
    stakeholder: 'executive',
    inputs: [
      { id: 'current_revenue', label: 'Current Revenue', type: 'currency', defaultValue: 10000000 },
      { id: 'uplift_percent', label: 'Expected Uplift', type: 'percent', defaultValue: 5 },
    ],
  },
  
  nrr: {
    id: 'nrr',
    type: 'nrr',
    name: 'Net Revenue Retention',
    description: 'Revenue retained from existing customers including expansion',
    category: 'impact',
    format: 'percent',
    icon: 'RefreshCw',
    color: 'blue',
    bestUsedFor: 'Customer success and expansion metrics',
    stakeholder: 'executive',
    inputs: [
      { id: 'starting_mrr', label: 'Starting MRR', type: 'currency', defaultValue: 100000 },
      { id: 'expansion', label: 'Expansion Revenue', type: 'currency', defaultValue: 15000 },
      { id: 'churn', label: 'Churned Revenue', type: 'currency', defaultValue: 5000 },
    ],
  },

  // Urgency Metrics (Sales View)
  coi: {
    id: 'coi',
    type: 'coi',
    name: 'Cost of Inaction',
    description: 'The cost incurred every month the decision is delayed',
    category: 'urgency',
    format: 'currency',
    icon: 'AlertTriangle',
    color: 'red',
    formula: 'Monthly Waste + Opportunity Cost',
    bestUsedFor: 'Creating urgency to close the deal',
    stakeholder: 'sales',
    inputs: [
      { id: 'monthly_waste', label: 'Monthly Operational Waste', type: 'currency', defaultValue: 25000 },
      { id: 'opportunity_cost', label: 'Monthly Opportunity Cost', type: 'currency', defaultValue: 20000 },
    ],
  },
  
  rmv: {
    id: 'rmv',
    type: 'rmv',
    name: 'Risk Mitigation Value',
    description: 'Value of avoiding negative events (breaches, fines, downtime)',
    category: 'urgency',
    format: 'currency',
    icon: 'Shield',
    color: 'amber',
    formula: 'Probability of Risk × Cost of Event',
    bestUsedFor: 'Security and compliance solutions',
    stakeholder: 'executive',
    inputs: [
      { id: 'risk_probability', label: 'Annual Risk Probability', type: 'percent', defaultValue: 15 },
      { id: 'event_cost', label: 'Cost if Event Occurs', type: 'currency', defaultValue: 2000000 },
    ],
  },
};

// ============================================
// VALUE DRIVER TEMPLATES
// ============================================

const COMMON_ASSUMPTIONS: AssumptionTemplate[] = [
  {
    id: 'employee_count',
    label: 'Employee Count',
    description: 'Number of employees affected',
    type: 'number',
    defaultValue: 500,
    min: 10,
    max: 50000,
    step: 10,
    unit: '',
    impactMultiplier: 0.3,
  },
  {
    id: 'adoption_rate',
    label: 'Adoption Rate',
    description: 'Expected user adoption in year 1',
    type: 'percent',
    defaultValue: 80,
    min: 20,
    max: 100,
    step: 5,
    unit: '%',
    impactMultiplier: 0.5,
  },
  {
    id: 'efficiency_gain',
    label: 'Efficiency Gain',
    description: 'Expected productivity improvement',
    type: 'percent',
    defaultValue: 15,
    min: 5,
    max: 40,
    step: 1,
    unit: '%',
    impactMultiplier: 0.6,
  },
];

export const DEFAULT_VALUE_DRIVERS: ValueDriverTemplate[] = [
  {
    id: 'sales_efficiency',
    name: 'Sales Efficiency',
    description: 'Reduced time-to-quote and improved win rates through data-driven proposals',
    category: 'Revenue',
    impactType: 'revenue_increase',
    baseImpact: 500000,
    defaultConfidence: 0.85,
    assumptions: [
      ...COMMON_ASSUMPTIONS,
      {
        id: 'deal_velocity',
        label: 'Deal Velocity Improvement',
        type: 'percent',
        defaultValue: 20,
        min: 5,
        max: 50,
        step: 5,
        unit: '%',
        impactMultiplier: 0.4,
      },
    ],
  },
  {
    id: 'customer_retention',
    name: 'Customer Retention',
    description: 'Proactive value tracking reduces churn and improves renewal rates',
    category: 'Revenue',
    impactType: 'revenue_increase',
    baseImpact: 300000,
    defaultConfidence: 0.78,
    assumptions: [
      {
        id: 'current_churn',
        label: 'Current Annual Churn',
        type: 'percent',
        defaultValue: 15,
        min: 5,
        max: 40,
        step: 1,
        unit: '%',
        impactMultiplier: 0.5,
      },
      {
        id: 'churn_reduction',
        label: 'Expected Churn Reduction',
        type: 'percent',
        defaultValue: 30,
        min: 10,
        max: 60,
        step: 5,
        unit: '%',
        impactMultiplier: 0.6,
      },
    ],
  },
  {
    id: 'operational_efficiency',
    name: 'Operational Efficiency',
    description: 'Automated workflows and reduced manual processes',
    category: 'Cost Savings',
    impactType: 'cost_savings',
    baseImpact: 200000,
    defaultConfidence: 0.92,
    assumptions: [
      ...COMMON_ASSUMPTIONS,
      {
        id: 'hours_per_task',
        label: 'Hours Saved per Task',
        type: 'number',
        defaultValue: 2,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: 'hrs',
        impactMultiplier: 0.3,
      },
    ],
  },
  {
    id: 'risk_reduction',
    name: 'Risk & Compliance',
    description: 'Reduced exposure to compliance violations and security incidents',
    category: 'Risk',
    impactType: 'risk_reduction',
    baseImpact: 150000,
    defaultConfidence: 0.70,
    assumptions: [
      {
        id: 'incident_probability',
        label: 'Annual Incident Probability',
        type: 'percent',
        defaultValue: 10,
        min: 1,
        max: 50,
        step: 1,
        unit: '%',
        impactMultiplier: 0.8,
      },
      {
        id: 'incident_cost',
        label: 'Average Incident Cost',
        type: 'currency',
        defaultValue: 500000,
        min: 10000,
        max: 10000000,
        step: 10000,
        unit: '',
        impactMultiplier: 0.5,
      },
    ],
  },
];

// ============================================
// COMPLETE TEMPLATES
// ============================================

// Helper to safely get metrics
const getMetrics = (...ids: string[]): MetricDefinition[] => 
  ids.map(id => DEFAULT_METRICS[id]).filter((m): m is MetricDefinition => m !== undefined);

// Helper to safely get value drivers
const getDrivers = (...indices: number[]): ValueDriverTemplate[] =>
  indices.map(i => DEFAULT_VALUE_DRIVERS[i]).filter((d): d is ValueDriverTemplate => d !== undefined);

export const DEFAULT_TEMPLATES: ValueCaseTemplate[] = [
  {
    id: 'standard_roi',
    name: 'Standard ROI Analysis',
    description: 'Comprehensive value case with all key financial metrics for CFO approval',
    category: 'general',
    metrics: getMetrics('roi', 'npv', 'payback', 'tco', 'coi'),
    valueDrivers: DEFAULT_VALUE_DRIVERS,
    primaryMetrics: ['roi', 'npv', 'payback'],
    secondaryMetrics: ['tco', 'coi'],
    isDefault: true,
    isCustom: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'saas_value_case',
    name: 'SaaS Value Case',
    description: 'Optimized for software-as-a-service solutions with subscription economics',
    category: 'saas',
    metrics: getMetrics('roi', 'npv', 'ttv', 'payback', 'nrr', 'coi'),
    valueDrivers: getDrivers(0, 1, 2),
    primaryMetrics: ['roi', 'ttv', 'payback'],
    secondaryMetrics: ['npv', 'nrr', 'coi'],
    industry: 'Technology',
    useCase: 'SaaS Platform',
    isDefault: true,
    isCustom: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'security_compliance',
    name: 'Security & Compliance',
    description: 'Risk-focused template for security, compliance, and infrastructure solutions',
    category: 'security',
    metrics: getMetrics('rmv', 'tco', 'payback', 'coi', 'roi'),
    valueDrivers: getDrivers(3, 2),
    primaryMetrics: ['rmv', 'tco', 'payback'],
    secondaryMetrics: ['coi', 'roi'],
    industry: 'Cross-Industry',
    useCase: 'Security & Compliance',
    isDefault: true,
    isCustom: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'productivity_tools',
    name: 'Productivity & Efficiency',
    description: 'User-focused template emphasizing time savings and productivity gains',
    category: 'productivity',
    metrics: getMetrics('fte_savings', 'roi', 'ttv', 'payback', 'coi'),
    valueDrivers: getDrivers(2, 0),
    primaryMetrics: ['fte_savings', 'roi', 'ttv'],
    secondaryMetrics: ['payback', 'coi'],
    industry: 'Cross-Industry',
    useCase: 'Productivity Tools',
    isDefault: true,
    isCustom: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'growth_revenue',
    name: 'Growth & Revenue',
    description: 'Revenue-focused template for solutions that drive top-line growth',
    category: 'general',
    metrics: getMetrics('revenue_uplift', 'roi', 'npv', 'irr', 'payback'),
    valueDrivers: getDrivers(0, 1),
    primaryMetrics: ['revenue_uplift', 'roi', 'npv'],
    secondaryMetrics: ['irr', 'payback'],
    industry: 'Cross-Industry',
    useCase: 'Revenue Growth',
    isDefault: true,
    isCustom: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper to get template by ID
export function getTemplateById(id: string): ValueCaseTemplate | undefined {
  return DEFAULT_TEMPLATES.find(t => t.id === id);
}

// Helper to get templates by category
export function getTemplatesByCategory(category: string): ValueCaseTemplate[] {
  return DEFAULT_TEMPLATES.filter(t => t.category === category);
}

// Helper to get metric by ID
export function getMetricById(id: string): MetricDefinition | undefined {
  return DEFAULT_METRICS[id];
}
