/**
 * Workflow Configuration
 * 
 * Business value model workflow stage configurations
 */

import React from 'react';
import { TrendingUp, DollarSign, Activity, Shield, FileCheck } from 'lucide-react';
import type { WorkflowStageConfig } from './types';

export const BUSINESS_WORKFLOW_STAGES: WorkflowStageConfig[] = [
  {
    id: 'opportunity',
    label: 'Opportunity Analysis',
    description: 'Discover business opportunities and value drivers',
    icon: <TrendingUp className="h-5 w-5" />,
    required: true,
    estimatedMinutes: 20,
    agentType: 'opportunity',
    capabilities: [
      'market-analysis',
      'competitor-benchmarking',
      'value-driver-identification',
      'opportunity-scoring'
    ],
    validationRules: [
      (data) => data?.opportunities?.length > 0 || 'At least one opportunity required',
      (data) => data?.valueDrivers?.length > 0 || 'Value drivers must be identified'
    ]
  },
  {
    id: 'target',
    label: 'Target & ROI Modeling',
    description: 'Define targets, KPIs, and build financial models',
    icon: <DollarSign className="h-5 w-5" />,
    required: true,
    estimatedMinutes: 30,
    agentType: 'financial-modeling',
    capabilities: [
      'roi-calculation',
      'npv-analysis',
      'sensitivity-analysis',
      'scenario-planning'
    ],
    validationRules: [
      (data) => data?.financialModel !== null || 'Financial model required',
      (data) => data?.kpis?.length > 0 || 'KPI targets required',
      (data) => data?.roi !== undefined || 'ROI calculation required'
    ]
  },
  {
    id: 'expansion',
    label: 'Value Expansion',
    description: 'Explore growth opportunities and scalability',
    icon: <Activity className="h-5 w-5" />,
    required: false,
    estimatedMinutes: 15,
    agentType: 'expansion',
    capabilities: [
      'market-expansion',
      'product-extension',
      'partnership-opportunities',
      'scalability-analysis'
    ]
  },
  {
    id: 'integrity',
    label: 'Validation & Risk',
    description: 'Validate assumptions and assess risks',
    icon: <Shield className="h-5 w-5" />,
    required: true,
    estimatedMinutes: 15,
    agentType: 'integrity',
    capabilities: [
      'assumption-validation',
      'risk-assessment',
      'compliance-check',
      'data-verification'
    ],
    validationRules: [
      (data) => data?.validationStatus === 'passed' || 'Validation required',
      (data) => data?.risks !== undefined || 'Risk assessment required'
    ]
  },
  {
    id: 'realization',
    label: 'Implementation Plan',
    description: 'Create roadmap and success metrics',
    icon: <FileCheck className="h-5 w-5" />,
    required: true,
    estimatedMinutes: 20,
    agentType: 'realization',
    capabilities: [
      'implementation-roadmap',
      'milestone-planning',
      'resource-allocation',
      'success-metrics'
    ],
    validationRules: [
      (data) => data?.milestones?.length > 0 || 'Implementation milestones required',
      (data) => data?.successMetrics?.length > 0 || 'Success metrics required'
    ]
  }
];
