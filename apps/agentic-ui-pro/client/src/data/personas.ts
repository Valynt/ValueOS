// ============================================================
// AGENTIC UI PRO — Persona Seed Data
// ============================================================

import type { Persona } from '@/types';

export const personas: Persona[] = [
  {
    id: 'ai-engineer',
    name: 'AI Engineer',
    description: 'Builds, deploys, and maintains AI agents and pipelines. Needs deep observability, debugging tools, and performance analytics.',
    primaryGoals: ['Debug agent failures', 'Optimize performance and cost', 'Monitor production systems', 'Build reliable pipelines'],
    commonWorkflows: ['agent-monitoring', 'incident-investigation', 'model-governance'],
    preferredPatterns: ['orchestration', 'analytics', 'trust-explainability', 'command-surfaces'],
    densityPreference: 'ultra-dense',
  },
  {
    id: 'product-manager',
    name: 'Product Manager',
    description: 'Defines AI product strategy, tracks feature adoption, and communicates value to stakeholders.',
    primaryGoals: ['Track product metrics', 'Build business cases', 'Manage feature roadmap', 'Communicate AI value'],
    commonWorkflows: ['value-hypothesis', 'customer-onboarding', 'business-review'],
    preferredPatterns: ['dashboard', 'value-roi', 'analytics', 'onboarding'],
    densityPreference: 'medium',
  },
  {
    id: 'ops-analyst',
    name: 'Operations Analyst',
    description: 'Manages day-to-day operations of agentic workflows, handles exceptions, and ensures SLA compliance.',
    primaryGoals: ['Monitor workflow health', 'Handle exceptions and escalations', 'Ensure SLA compliance', 'Review AI decisions'],
    commonWorkflows: ['agent-monitoring', 'support-triage', 'ai-approval'],
    preferredPatterns: ['approval-review', 'dashboard', 'tables-data', 'command-surfaces'],
    densityPreference: 'high',
  },
  {
    id: 'customer-success',
    name: 'Customer Success Manager',
    description: 'Manages customer relationships, tracks value delivery, and drives renewal and expansion.',
    primaryGoals: ['Track customer health', 'Demonstrate ROI', 'Identify churn risk', 'Prepare business reviews'],
    commonWorkflows: ['business-review', 'value-hypothesis', 'customer-onboarding'],
    preferredPatterns: ['dashboard', 'value-roi', 'analytics', 'onboarding'],
    densityPreference: 'medium',
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    description: 'Analyzes AI model performance, validates outputs, and builds evaluation frameworks.',
    primaryGoals: ['Evaluate model performance', 'Validate AI outputs', 'Build evaluation datasets', 'Track model drift'],
    commonWorkflows: ['agent-monitoring', 'model-governance'],
    preferredPatterns: ['analytics', 'trust-explainability', 'knowledge-memory'],
    densityPreference: 'ultra-dense',
  },
  {
    id: 'enterprise-admin',
    name: 'Enterprise Admin',
    description: 'Manages platform configuration, user access, compliance, and governance for the organization.',
    primaryGoals: ['Manage user permissions', 'Ensure compliance', 'Control costs', 'Audit AI actions'],
    commonWorkflows: ['admin-permissions', 'model-governance'],
    preferredPatterns: ['settings-admin', 'trust-explainability', 'tables-data'],
    densityPreference: 'high',
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Integrates AI capabilities into applications, builds on top of agentic APIs, and debugs integrations.',
    primaryGoals: ['Integrate AI APIs', 'Debug tool calls', 'Build custom agents', 'Test AI workflows'],
    commonWorkflows: ['customer-onboarding', 'agent-monitoring'],
    preferredPatterns: ['agent-workspace', 'command-surfaces', 'knowledge-memory'],
    densityPreference: 'high',
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Oversees AI program strategy, tracks business outcomes, and makes investment decisions.',
    primaryGoals: ['Track AI program ROI', 'Understand risk exposure', 'Make investment decisions', 'Communicate to board'],
    commonWorkflows: ['business-review', 'value-hypothesis'],
    preferredPatterns: ['dashboard', 'value-roi', 'analytics'],
    densityPreference: 'low',
  },
];
