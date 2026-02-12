/**
 * Calculator Templates
 * 
 * Industry-specific templates for the self-service ROI calculator
 */

import type { CalculatorTemplate } from '../types/calculatorTemplate';
import { Industry } from '../types/calculatorTemplate';
import { saasTemplate } from './templates/saas';

// E-commerce Template
export const ecommerceTemplate: CalculatorTemplate = {
  id: 'ecommerce-v1',
  industry: Industry.ECOMMERCE,
  name: 'E-commerce Business Calculator',
  description: 'Calculate ROI for e-commerce businesses focusing on conversion, cart abandonment, and customer retention',
  version: '1.0.0',
  estimatedTimeMinutes: 10,
  
  painPoints: [
    {
      id: 'low-conversion',
      label: 'Low Conversion Rate',
      description: 'Too many visitors leaving without purchasing',
      category: MetricCategory.REVENUE,
      impactLevel: 'high',
      commonSolutions: ['A/B testing', 'Personalization', 'Checkout optimization'],
    },
    {
      id: 'cart-abandonment',
      label: 'High Cart Abandonment',
      description: 'Customers adding items but not completing purchase',
      category: MetricCategory.REVENUE,
      impactLevel: 'high',
      commonSolutions: ['Cart recovery emails', 'Exit-intent popups', 'Payment optimization'],
    },
    {
      id: 'low-aov',
      label: 'Low Average Order Value',
      description: 'Customers not buying enough per transaction',
      category: MetricCategory.REVENUE,
      impactLevel: 'medium',
      commonSolutions: ['Product recommendations', 'Bundling', 'Free shipping thresholds'],
    },
    {
      id: 'high-returns',
      label: 'High Return Rate',
      description: 'Too many products being returned',
      category: MetricCategory.COST,
      impactLevel: 'medium',
      commonSolutions: ['Better product descriptions', 'Size guides', 'Customer reviews'],
    },
  ],
  
  metrics: [
    {
      id: 'monthly-visitors',
      name: 'Monthly Website Visitors',
      description: 'Average monthly unique visitors',
      category: MetricCategory.CUSTOMER,
      unit: 'count',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
    },
    {
      id: 'conversion-rate',
      name: 'Conversion Rate',
      description: 'Percentage of visitors who make a purchase',
      category: MetricCategory.REVENUE,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: true,
      min: 0,
      max: 100,
    },
    {
      id: 'aov',
      name: 'Average Order Value',
      description: 'Average amount spent per order',
      category: MetricCategory.REVENUE,
      unit: 'USD',
      inputType: InputFieldType.CURRENCY,
      required: true,
      min: 0,
    },
    {
      id: 'cart-abandonment-rate',
      name: 'Cart Abandonment Rate',
      description: 'Percentage of carts abandoned before checkout',
      category: MetricCategory.REVENUE,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: true,
      min: 0,
      max: 100,
    },
    {
      id: 'return-rate',
      name: 'Return Rate',
      description: 'Percentage of orders returned',
      category: MetricCategory.COST,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: false,
      min: 0,
      max: 100,
      defaultValue: 10,
    },
  ],
  
  benchmarks: [
    {
      metricId: 'conversion-rate',
      p25: 1.5,
      median: 2.5,
      p75: 4.0,
      bestInClass: 6.0,
      source: 'E-commerce Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
    {
      metricId: 'cart-abandonment-rate',
      p25: 60,
      median: 70,
      p75: 80,
      bestInClass: 50,
      source: 'E-commerce Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
  ],
  
  roiFormulas: [
    {
      id: 'monthly-revenue',
      name: 'Monthly Revenue',
      description: 'Estimated monthly revenue',
      formula: 'monthlyVisitors * (conversionRate / 100) * aov',
      dependencies: ['monthly-visitors', 'conversion-rate', 'aov'],
      outputUnit: 'USD',
    },
  ],
  
  validationRules: [
    {
      field: 'monthly-visitors',
      rule: 'required',
      message: 'Monthly visitors is required',
    },
    {
      field: 'conversion-rate',
      rule: 'range',
      value: '0-100',
      message: 'Conversion rate must be between 0 and 100',
    },
  ],
  
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// Manufacturing Template
export const manufacturingTemplate: CalculatorTemplate = {
  id: 'manufacturing-v1',
  industry: Industry.MANUFACTURING,
  name: 'Manufacturing Operations Calculator',
  description: 'Calculate ROI for manufacturing operations focusing on efficiency, quality, and downtime reduction',
  version: '1.0.0',
  estimatedTimeMinutes: 12,
  
  painPoints: [
    {
      id: 'equipment-downtime',
      label: 'Equipment Downtime',
      description: 'Machines breaking down or requiring maintenance',
      category: MetricCategory.EFFICIENCY,
      impactLevel: 'high',
      commonSolutions: ['Predictive maintenance', 'IoT sensors', 'Maintenance scheduling'],
    },
    {
      id: 'quality-defects',
      label: 'Quality Defects',
      description: 'High rate of defective products',
      category: MetricCategory.QUALITY,
      impactLevel: 'high',
      commonSolutions: ['Quality management system', 'Statistical process control', 'Automated inspection'],
    },
    {
      id: 'inventory-waste',
      label: 'Inventory Waste',
      description: 'Excess inventory or material waste',
      category: MetricCategory.COST,
      impactLevel: 'medium',
      commonSolutions: ['Just-in-time inventory', 'Demand forecasting', 'Lean manufacturing'],
    },
    {
      id: 'low-oee',
      label: 'Low Overall Equipment Effectiveness',
      description: 'Equipment not operating at optimal efficiency',
      category: MetricCategory.EFFICIENCY,
      impactLevel: 'high',
      commonSolutions: ['OEE monitoring', 'Process optimization', 'Operator training'],
    },
  ],
  
  metrics: [
    {
      id: 'production-units',
      name: 'Monthly Production Units',
      description: 'Average units produced per month',
      category: MetricCategory.EFFICIENCY,
      unit: 'units',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
    },
    {
      id: 'downtime-hours',
      name: 'Monthly Downtime Hours',
      description: 'Hours of unplanned downtime per month',
      category: MetricCategory.EFFICIENCY,
      unit: 'hours',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
    },
    {
      id: 'operating-hours',
      name: 'Monthly Operating Hours',
      description: 'Total scheduled operating hours per month (e.g., 730 for 24/7, 160 for single shift)',
      category: MetricCategory.EFFICIENCY,
      unit: 'hours',
      inputType: InputFieldType.NUMBER,
      required: true,
      defaultValue: 730,
      min: 1,
      max: 744, // 31 days * 24 hours
    },
    {
      id: 'defect-rate',
      name: 'Defect Rate',
      description: 'Percentage of defective units',
      category: MetricCategory.QUALITY,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: true,
      min: 0,
      max: 100,
    },
    {
      id: 'unit-cost',
      name: 'Cost Per Unit',
      description: 'Average cost to produce one unit',
      category: MetricCategory.COST,
      unit: 'USD',
      inputType: InputFieldType.CURRENCY,
      required: true,
      min: 0,
    },
    {
      id: 'oee',
      name: 'Overall Equipment Effectiveness',
      description: 'Current OEE percentage',
      category: MetricCategory.EFFICIENCY,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: false,
      min: 0,
      max: 100,
      defaultValue: 60,
    },
  ],
  
  benchmarks: [
    {
      metricId: 'oee',
      p25: 50,
      median: 60,
      p75: 75,
      bestInClass: 85,
      source: 'Manufacturing Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
    {
      metricId: 'defect-rate',
      p25: 5,
      median: 3,
      p75: 1,
      bestInClass: 0.5,
      source: 'Manufacturing Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
  ],
  
  roiFormulas: [
    {
      id: 'downtime-cost',
      name: 'Monthly Downtime Cost',
      description: 'Cost of unplanned downtime',
      formula: 'downtimeHours * (productionUnits / operatingHours) * unitCost',
      dependencies: ['downtime-hours', 'production-units', 'unit-cost', 'operating-hours'],
      outputUnit: 'USD',
    },
  ],
  
  validationRules: [
    {
      field: 'production-units',
      rule: 'required',
      message: 'Production units is required',
    },
    {
      field: 'defect-rate',
      rule: 'max',
      value: 100,
      message: 'Defect rate cannot exceed 100%',
    },
  ],
  
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// Healthcare Template
export const healthcareTemplate: CalculatorTemplate = {
  id: 'healthcare-v1',
  industry: Industry.HEALTHCARE,
  name: 'Healthcare Operations Calculator',
  description: 'Calculate ROI for healthcare organizations focusing on patient care, efficiency, and compliance',
  version: '1.0.0',
  estimatedTimeMinutes: 12,
  
  painPoints: [
    {
      id: 'long-wait-times',
      label: 'Long Patient Wait Times',
      description: 'Patients waiting too long for appointments or care',
      category: MetricCategory.EFFICIENCY,
      impactLevel: 'high',
      commonSolutions: ['Scheduling optimization', 'Telehealth', 'Patient flow management'],
    },
    {
      id: 'readmissions',
      label: 'High Readmission Rates',
      description: 'Patients returning within 30 days',
      category: MetricCategory.QUALITY,
      impactLevel: 'high',
      commonSolutions: ['Care coordination', 'Patient monitoring', 'Discharge planning'],
    },
    {
      id: 'administrative-burden',
      label: 'Administrative Burden',
      description: 'Too much time spent on paperwork and admin tasks',
      category: MetricCategory.EFFICIENCY,
      impactLevel: 'medium',
      commonSolutions: ['EHR optimization', 'Automation', 'Voice recognition'],
    },
  ],
  
  metrics: [
    {
      id: 'monthly-patients',
      name: 'Monthly Patient Visits',
      description: 'Average patient visits per month',
      category: MetricCategory.CUSTOMER,
      unit: 'count',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
    },
    {
      id: 'avg-wait-time',
      name: 'Average Wait Time',
      description: 'Average patient wait time in minutes',
      category: MetricCategory.EFFICIENCY,
      unit: 'minutes',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
    },
    {
      id: 'readmission-rate',
      name: '30-Day Readmission Rate',
      description: 'Percentage of patients readmitted within 30 days',
      category: MetricCategory.QUALITY,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: true,
      min: 0,
      max: 100,
    },
    {
      id: 'admin-hours',
      name: 'Administrative Hours Per Day',
      description: 'Hours spent on administrative tasks per provider per day',
      category: MetricCategory.EFFICIENCY,
      unit: 'hours',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
      max: 24,
    },
  ],
  
  benchmarks: [
    {
      metricId: 'avg-wait-time',
      p25: 45,
      median: 30,
      p75: 20,
      bestInClass: 15,
      source: 'Healthcare Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
    {
      metricId: 'readmission-rate',
      p25: 15,
      median: 12,
      p75: 8,
      bestInClass: 5,
      source: 'Healthcare Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
  ],
  
  roiFormulas: [],
  validationRules: [
    {
      field: 'monthly-patients',
      rule: 'required',
      message: 'Monthly patient visits is required',
    },
  ],
  
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// Financial Services Template
export const financialServicesTemplate: CalculatorTemplate = {
  id: 'financial-services-v1',
  industry: Industry.FINANCIAL_SERVICES,
  name: 'Financial Services Calculator',
  description: 'Calculate ROI for financial services focusing on compliance, fraud prevention, and customer experience',
  version: '1.0.0',
  estimatedTimeMinutes: 10,
  
  painPoints: [
    {
      id: 'fraud-losses',
      label: 'Fraud Losses',
      description: 'Financial losses due to fraudulent transactions',
      category: MetricCategory.COST,
      impactLevel: 'high',
      commonSolutions: ['Fraud detection AI', 'Transaction monitoring', 'Identity verification'],
    },
    {
      id: 'compliance-costs',
      label: 'High Compliance Costs',
      description: 'Expensive manual compliance processes',
      category: MetricCategory.COST,
      impactLevel: 'high',
      commonSolutions: ['RegTech solutions', 'Automated reporting', 'Compliance management'],
    },
    {
      id: 'slow-onboarding',
      label: 'Slow Customer Onboarding',
      description: 'Too long to onboard new customers',
      category: MetricCategory.EFFICIENCY,
      impactLevel: 'medium',
      commonSolutions: ['Digital onboarding', 'KYC automation', 'Document verification'],
    },
  ],
  
  metrics: [
    {
      id: 'monthly-transactions',
      name: 'Monthly Transactions',
      description: 'Average transactions processed per month',
      category: MetricCategory.EFFICIENCY,
      unit: 'count',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
    },
    {
      id: 'fraud-rate',
      name: 'Fraud Rate',
      description: 'Percentage of fraudulent transactions',
      category: MetricCategory.COST,
      unit: '%',
      inputType: InputFieldType.PERCENTAGE,
      required: true,
      min: 0,
      max: 100,
    },
    {
      id: 'avg-transaction-value',
      name: 'Average Transaction Value',
      description: 'Average value per transaction',
      category: MetricCategory.REVENUE,
      unit: 'USD',
      inputType: InputFieldType.CURRENCY,
      required: true,
      min: 0,
    },
    {
      id: 'compliance-fte',
      name: 'Compliance FTEs',
      description: 'Full-time employees dedicated to compliance',
      category: MetricCategory.COST,
      unit: 'count',
      inputType: InputFieldType.NUMBER,
      required: true,
      min: 0,
    },
  ],
  
  benchmarks: [
    {
      metricId: 'fraud-rate',
      p25: 0.5,
      median: 0.3,
      p75: 0.1,
      bestInClass: 0.05,
      source: 'Financial Services Benchmarks 2026',
      lastUpdated: '2026-01-01',
    },
  ],
  
  roiFormulas: [
    {
      id: 'fraud-losses',
      name: 'Monthly Fraud Losses',
      description: 'Estimated monthly losses from fraud',
      formula: 'monthlyTransactions * (fraudRate / 100) * avgTransactionValue',
      dependencies: ['monthly-transactions', 'fraud-rate', 'avg-transaction-value'],
      outputUnit: 'USD',
    },
  ],
  
  validationRules: [
    {
      field: 'monthly-transactions',
      rule: 'required',
      message: 'Monthly transactions is required',
    },
  ],
  
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// Export all templates
export const calculatorTemplates: Record<Industry, CalculatorTemplate> = {
  [Industry.SAAS]: saasTemplate,
  [Industry.ECOMMERCE]: ecommerceTemplate,
  [Industry.MANUFACTURING]: manufacturingTemplate,
  [Industry.HEALTHCARE]: healthcareTemplate,
  [Industry.FINANCIAL_SERVICES]: financialServicesTemplate,
};

// Helper functions
export function getTemplate(industry: Industry): CalculatorTemplate | undefined {
  return calculatorTemplates[industry];
}

export function getAllTemplates(): CalculatorTemplate[] {
  return Object.values(calculatorTemplates);
}

export function getTemplateMetadata(industry: Industry) {
  const template = getTemplate(industry);
  if (!template) return null;

  return {
    id: template.id,
    industry: template.industry,
    name: template.name,
    description: template.description,
    painPointCount: template.painPoints.length,
    metricCount: template.metrics.length,
    estimatedTimeMinutes: template.estimatedTimeMinutes,
    popularity: 0, // Would be calculated from usage data
    lastUpdated: template.updatedAt,
  };
}
