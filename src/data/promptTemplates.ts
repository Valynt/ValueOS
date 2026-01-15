/**
 * Task #014-016: Prompt Template Library
 * 
 * Pre-built templates for common value case scenarios to accelerate user workflows
 */

export interface PromptTemplate {
  id: string;
  category: 'opportunity' | 'target' | 'realization' | 'expansion';
  name: string;
  description: string;
  prompt: string;
  tags: string[];
  variables?: string[];
  estimatedTime: string;
}

export const promptTemplates: PromptTemplate[] = [
  // Opportunity Stage Templates
  {
    id: 'opp-cost-reduction',
    category: 'opportunity',
    name: 'Cost Reduction Analysis',
    description: 'Identify and quantify cost savings opportunities',
    prompt: `Analyze cost reduction opportunities for {{company}} in the following areas:
- Current annual spend: {{annual_spend}}
- Department/function: {{department}}
- Pain points: {{pain_points}}

Please provide:
1. Breakdown of current cost drivers
2. Specific reduction opportunities with estimated savings
3. Implementation complexity assessment
4. Quick wins vs. strategic initiatives`,
    tags: ['cost', 'savings', 'efficiency'],
    variables: ['company', 'annual_spend', 'department', 'pain_points'],
    estimatedTime: '2-3 min',
  },
  {
    id: 'opp-revenue-growth',
    category: 'opportunity',
    name: 'Revenue Growth Opportunity',
    description: 'Map revenue expansion potential',
    prompt: `Identify revenue growth opportunities for {{company}}:
- Current ARR/revenue: {{current_revenue}}
- Customer segments: {{customer_segments}}
- Market context: {{market_context}}

Analyze:
1. Upsell/cross-sell potential
2. Market expansion opportunities
3. New revenue streams
4. Customer lifetime value improvements`,
    tags: ['revenue', 'growth', 'expansion'],
    variables: ['company', 'current_revenue', 'customer_segments', 'market_context'],
    estimatedTime: '3-4 min',
  },
  {
    id: 'opp-risk-mitigation',
    category: 'opportunity',
    name: 'Risk Mitigation Value',
    description: 'Quantify value of reducing business risk',
    prompt: `Assess risk mitigation value for {{company}}:
- Key risks: {{key_risks}}
- Potential impact: {{risk_impact}}
- Current mitigation: {{current_mitigation}}

Provide:
1. Risk quantification
2. Cost of inaction analysis
3. Value of risk reduction
4. Compliance/regulatory benefits`,
    tags: ['risk', 'compliance', 'security'],
    variables: ['company', 'key_risks', 'risk_impact', 'current_mitigation'],
    estimatedTime: '2-3 min',
  },

  // Target Stage Templates
  {
    id: 'target-saas-migration',
    category: 'target',
    name: 'SaaS Migration Business Case',
    description: 'Build ROI case for cloud/SaaS migration',
    prompt: `Create SaaS migration business case for {{company}}:
- Current on-prem costs: {{current_costs}}
- User count: {{user_count}}
- Migration scope: {{migration_scope}}

Calculate:
1. Total Cost of Ownership (TCO) comparison
2. Migration investment required
3. Payback period
4. 3-year ROI projection
5. Qualitative benefits (agility, scalability, etc.)`,
    tags: ['saas', 'migration', 'tco', 'roi'],
    variables: ['company', 'current_costs', 'user_count', 'migration_scope'],
    estimatedTime: '4-5 min',
  },
  {
    id: 'target-process-automation',
    category: 'target',
    name: 'Process Automation ROI',
    description: 'Calculate automation value case',
    prompt: `Build automation ROI for {{company}}:
- Process: {{process_name}}
- Current manual hours/month: {{manual_hours}}
- Hourly cost: {{hourly_cost}}
- Error rate: {{error_rate}}

Quantify:
1. Time savings value
2. Error reduction savings
3. Scalability benefits
4. Implementation cost vs. payback
5. Productivity reallocation value`,
    tags: ['automation', 'efficiency', 'productivity'],
    variables: ['company', 'process_name', 'manual_hours', 'hourly_cost', 'error_rate'],
    estimatedTime: '3-4 min',
  },
  {
    id: 'target-customer-experience',
    category: 'target',
    name: 'CX Improvement Value',
    description: 'Link customer experience improvements to revenue',
    prompt: `Quantify CX improvement value for {{company}}:
- Current NPS/CSAT: {{current_score}}
- Churn rate: {{churn_rate}}
- Customer LTV: {{ltv}}
- Target improvement: {{target_improvement}}

Model:
1. Churn reduction impact
2. Expansion/upsell lift
3. Referral/advocacy value
4. Brand perception benefits
5. Total revenue impact over 3 years`,
    tags: ['cx', 'retention', 'nps', 'revenue'],
    variables: ['company', 'current_score', 'churn_rate', 'ltv', 'target_improvement'],
    estimatedTime: '3-4 min',
  },

  // Realization Stage Templates
  {
    id: 'real-tracking-dashboard',
    category: 'realization',
    name: 'Value Tracking Dashboard',
    description: 'Set up KPIs and tracking for value realization',
    prompt: `Create value tracking plan for {{company}} {{initiative}}:
- Baseline metrics: {{baseline_metrics}}
- Target metrics: {{target_metrics}}
- Timeframe: {{timeframe}}

Define:
1. Leading indicators to monitor
2. Lagging indicators for ROI proof
3. Measurement frequency and methodology
4. Reporting cadence and stakeholders
5. Success criteria and thresholds`,
    tags: ['tracking', 'kpis', 'metrics', 'monitoring'],
    variables: ['company', 'initiative', 'baseline_metrics', 'target_metrics', 'timeframe'],
    estimatedTime: '2-3 min',
  },
  {
    id: 'real-stakeholder-report',
    category: 'realization',
    name: 'Executive Value Report',
    description: 'Generate stakeholder-ready value summary',
    prompt: `Create executive value summary for {{company}} {{initiative}}:
- Duration: {{duration}}
- Achieved metrics: {{achieved_metrics}}
- Original projections: {{original_projections}}

Format for C-level:
1. Headlines (actual vs. projected)
2. Financial impact summary
3. Operational improvements
4. Strategic benefits realized
5. Next phase recommendations`,
    tags: ['reporting', 'executive', 'summary'],
    variables: ['company', 'initiative', 'duration', 'achieved_metrics', 'original_projections'],
    estimatedTime: '3-4 min',
  },

  // Expansion Stage Templates
  {
    id: 'exp-upsell-analysis',
    category: 'expansion',
    name: 'Upsell Opportunity Analysis',
    description: 'Identify and prioritize upsell paths',
    prompt: `Analyze upsell opportunities for {{company}}:
- Current usage: {{current_usage}}
- Available products/tiers: {{available_products}}
- Customer maturity: {{customer_maturity}}
- Realized value to date: {{realized_value}}

Identify:
1. Natural next-step products/features
2. Value gap analysis (current vs. potential)
3. Upsell revenue potential
4. Customer readiness indicators
5. Recommended approach and timing`,
    tags: ['upsell', 'expansion', 'revenue'],
    variables: ['company', 'current_usage', 'available_products', 'customer_maturity', 'realized_value'],
    estimatedTime: '3-4 min',
  },
  {
    id: 'exp-cross-sell',
    category: 'expansion',
    name: 'Cross-Sell Value Mapping',
    description: 'Map additional solutions to customer needs',
    prompt: `Map cross-sell opportunities for {{company}}:
- Current solution: {{current_solution}}
- Customer challenges: {{customer_challenges}}
- Additional products: {{additional_products}}

Map value:
1. Adjacent pain points not yet addressed
2. Synergies with current solution
3. Incremental value quantification
4. Implementation lift vs. standalone
5. Bundled vs. separate business case`,
    tags: ['cross-sell', 'bundling', 'portfolio'],
    variables: ['company', 'current_solution', 'customer_challenges', 'additional_products'],
    estimatedTime: '3-4 min',
  },

  // Quick-Start Templates
  {
    id: 'quick-discovery-call',
    category: 'opportunity',
    name: 'Discovery Call Value Capture',
    description: 'Extract value insights from discovery conversation',
    prompt: `Capture value insights from discovery call with {{company}}:

Key discussion points:
- Current state: {{current_state}}
- Pain points mentioned: {{pain_points}}
- Goals discussed: {{goals}}
- Budget/timing hints: {{budget_timing}}

Extract:
1. Quantifiable pain points
2. Stakeholder priorities
3. Decision criteria
4. Value drivers to emphasize
5. Next steps for deeper analysis`,
    tags: ['discovery', 'call-notes', 'quick-start'],
    variables: ['company', 'current_state', 'pain_points', 'goals', 'budget_timing'],
    estimatedTime: '1-2 min',
  },
  {
    id: 'quick-competitor-displacement',
    category: 'target',
    name: 'Competitive Displacement Case',
    description: 'Build switchover value case',
    prompt: `Build competitive displacement case for {{company}}:
- Current vendor: {{current_vendor}}
- Annual spend: {{annual_spend}}
- Pain points with current: {{pain_points}}
- Our differentiators: {{differentiators}}

Quantify:
1. Direct cost comparison
2. Feature/capability gaps current vendor has
3. Switching cost (realistic)
4. Net value of change (benefits - switching cost)
5. Risk mitigation in staying vs. switching`,
    tags: ['competitive', 'displacement', 'switching'],
    variables: ['company', 'current_vendor', 'annual_spend', 'pain_points', 'differentiators'],
    estimatedTime: '3-4 min',
  },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[] {
  return promptTemplates.filter((t) => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
  return promptTemplates.find((t) => t.id === id);
}

/**
 * Search templates by tags or name
 */
export function searchTemplates(query: string): PromptTemplate[] {
  const lowerQuery = query.toLowerCase();
  return promptTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Interpolate template with variables
 */
export function interpolateTemplate(template: PromptTemplate, variables: Record<string, string>): string {
  let result = template.prompt;
  
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  return result;
}
