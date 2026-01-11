/**
 * SaaS Industry Calculator Template
 */

import type { CalculatorTemplate } from '../../types/calculatorTemplate';
import { Industry, MetricCategory, InputFieldType } from '../../types/calculatorTemplate';

export const saasTemplate: CalculatorTemplate = {
  id: 'saas-v1',
  industry: Industry.SAAS,
  name: 'SaaS Business Calculator',
  description: 'Calculate ROI for SaaS companies focusing on customer acquisition, retention, and revenue growth',
  version: '1.0.0',
  estimatedTimeMinutes: 10,
  
  painPoints: [
    {
      id: 'high-cac',
      label: 'High Customer Acquisition Cost',
      description: 'Spending too much to acquire new customers',
      category: MetricCategory.COST,
      impactLevel: 'high',
      commonSolutions: ['Marketing automation', 'Lead scoring', 'Sales enablement'],
    },
    {
      id: 'high-churn',
      label: 'High Customer Churn',
      description: 'Losing customers faster than acquiring them',
      category: MetricCategory.CUSTOMER,
      impactLevel: 'high',
      commonSolutions: ['Customer success platform', 'Onboarding automation', 'Usage analytics'],
    },
    {
      id: 'low-expansion',
      label: 'Low Expansion Revenue',
      description: 'Not growing revenue from existing customers',
      category: MetricCategory.REVENUE,
      impactLevel: 'medium',
      commonSolutions: ['Upsell automation', 'Usage-based pricing', 'Feature adoption tracking'],
    },
  ],
  
  metrics: [
    {
      id: 'mrr',
      name: 'Monthly Recurring Revenue',
      description: 'Current MRR',
      category: MetricCategory.REVENUE,
      unit: 'USD',
      inputType: InputFieldType.CURRENCY,
      required: true,
      min: 0,
      helpText: 'Total monthly recurring revenue',
    },
    {
      id: 'customers',
      name: 'Active Customers',
      description: 'Number of paying customers',
      category: MetricCategory.CUSTOMER,
      unit: 'count',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 1,
    },
    {
      id: 'cac',
      name: 'Customer Acquisition Cost',
      description: 'Average cost to acquire a customer',
      category: MetricCategory.COST,
      unit: 'USD',
      inputType: InputFieldType.CURRENCY,
      required: true,
      min: 0,
    },
    {
      id: 'churn-rate',
      name: 'Monthly Churn Rate',
      description: 'Percentage of customers lost per month',
      category: MetricCategory.CUSTOMER,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: true,
      min: 0,
      max: 100,
    },
  ],
  
  benchmarks: [
    {
      metricId: 'cac',
      p25: 200,
      median: 500,
      p75: 1000,
      bestInClass: 2000,
      source: 'SaaS Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
    {
      metricId: 'churn-rate',
      p25: 2,
      median: 5,
      p75: 8,
      bestInClass: 1,
      source: 'SaaS Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
  ],
  
  roiFormulas: [
    {
      id: 'ltv',
      name: 'Customer Lifetime Value',
      description: 'Average revenue per customer over their lifetime',
      formula: '(mrr / customers) / (churnRate / 100)',
      dependencies: ['mrr', 'customers', 'churn-rate'],
      outputUnit: 'USD',
    },
  ],
  
  validationRules: [
    {
      field: 'mrr',
      rule: 'required',
      message: 'Monthly Recurring Revenue is required',
    },
    {
      field: 'customers',
      rule: 'min',
      value: 1,
      message: 'Must have at least 1 customer',
    },
  ],
  
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
