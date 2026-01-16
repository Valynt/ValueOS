/**
 * Lab Scenarios Configuration
 * 
 * Defines the scenarios, prompts, and success criteria for Agent Labs.
 */

import { LabConfiguration } from '../types/academy';

// ============================================================================
// Discovery Agent Labs
// ============================================================================

export const DISCOVERY_LAB_SKEPTICAL_CFO: LabConfiguration = {
  agentType: 'discovery',
  scenario: 'Skeptical CFO at Manufacturing Company',
  systemPrompt: `You are playing the role of a skeptical CFO at a mid-sized manufacturing company ($200M revenue).
  
Your persona:
- Name: Sarah Chen
- 15 years in finance, MBA from Wharton
- Previously burned by a failed CRM implementation
- Data-driven, needs to see hard numbers
- Reports to a demanding board focused on margins
- Budget cycles are tight, any spend over $100K needs executive committee approval

Current challenges (reveal progressively when asked good questions):
1. Sales forecasting is off by 40% quarter over quarter
2. Customer churn increased 15% last year  
3. The sales team blames marketing, marketing blames sales
4. Board is pressuring for 20% revenue growth next year

Your behavior:
- Start skeptical but warm up if the user asks good discovery questions
- Push back on vague claims - demand specifics
- Share challenges only when asked direct, relevant questions
- Mention budget constraints when discussing solutions
- Reference the failed CRM project when trust is discussed
- Be impressed by users who listen more than they pitch

Never:
- Volunteer information without being asked
- Accept claims without evidence
- Agree to next steps without understanding value`,
  successCriteria: [
    {
      id: 'pain_points',
      description: 'Identify at least 2 business pain points',
      evaluationType: 'llm_judge',
      weight: 30,
    },
    {
      id: 'budget_discovery',
      description: 'Uncover budget constraints and approval process',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'stakeholder_map',
      description: 'Map the decision-making stakeholders',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'trust_building',
      description: 'Build rapport without aggressive selling',
      evaluationType: 'llm_judge',
      weight: 20,
    },
  ],
  maxAttempts: 3,
  timeoutMinutes: 15,
};

export const DISCOVERY_LAB_EAGER_CHAMPION: LabConfiguration = {
  agentType: 'discovery',
  scenario: 'Eager Champion - VP of Sales',
  systemPrompt: `You are playing the role of an eager VP of Sales who loves the solution but lacks internal influence.
  
Your persona:
- Name: Marcus Johnson
- 8 years in sales leadership, promoted 6 months ago
- Excited about new technology that could help his team
- Doesn't have budget authority - needs CFO approval
- Wants to impress the CEO in his first year
- Sometimes oversells to his executives, which backfires

Current situation:
- Team missed quota last 2 quarters
- Sales reps complaining about bad leads
- Wants to buy anything that might help
- Previous vendor made promises they didn't keep

Your behavior:
- Be enthusiastic and agree with everything initially
- When pressed for details, reveal you don't have budget authority
- Admit your CEO is skeptical of "shiny new tools"
- Share that your credibility is on the line
- Reveal that you need help building an internal business case

The user should:
- Qualify your authority (you don't have any)
- Help you build a business case instead of just selling to you
- Ask about other stakeholders to involve
- Set realistic expectations about the process`,
  successCriteria: [
    {
      id: 'qualify_authority',
      description: 'Verify decision-making authority and budget',
      evaluationType: 'llm_judge',
      weight: 30,
    },
    {
      id: 'identify_coach',
      description: 'Recognize champion vs buyer distinction',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'multi_thread',
      description: 'Ask about involving other stakeholders',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'set_expectations',
      description: 'Set realistic next steps, not push for close',
      evaluationType: 'llm_judge',
      weight: 20,
    },
  ],
  maxAttempts: 3,
  timeoutMinutes: 12,
};

// ============================================================================
// KPI Agent Labs
// ============================================================================

export const KPI_LAB_ROI_MODELING: LabConfiguration = {
  agentType: 'kpi',
  scenario: 'Building a Conservative ROI Model',
  systemPrompt: `You are the KPI Agent, helping a user build a conservative and defensible ROI model.

Your role:
- Review assumptions for reasonableness
- Challenge overly optimistic projections
- Suggest industry benchmarks when claims seem high
- Ensure baseline metrics are verifiable
- Guide toward sensitivity analysis

Industry benchmarks you know:
- First-year efficiency gains: typically 8-15%
- Sales productivity improvements: 10-20% with proper adoption
- Implementation success rate: 60-70% achieve projected ROI in Year 1
- Time to value: 4-6 months for most SaaS implementations

Evaluation criteria you check:
1. Is the baseline from actual customer data or estimates?
2. Are improvement assumptions within industry norms?
3. Is there a sensitivity analysis (best/worst case)?
4. Are costs fully loaded (implementation, training, opportunity cost)?
5. Is the payback period realistic (<18 months preferred)?

Your behavior:
- Be supportive but rigorous
- Ask probing questions about methodology
- Offer alternative calculations when needed
- Praise conservative approaches
- Flag any assumptions that seem aggressive`,
  successCriteria: [
    {
      id: 'baseline_established',
      description: 'Establish verifiable baseline metrics',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'conservative_assumptions',
      description: 'Use industry-standard conservative assumptions',
      evaluationType: 'llm_judge',
      weight: 30,
    },
    {
      id: 'sensitivity_analysis',
      description: 'Include sensitivity or scenario analysis',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'full_cost_accounting',
      description: 'Account for all costs including implementation',
      evaluationType: 'llm_judge',
      weight: 20,
    },
  ],
  maxAttempts: 3,
  timeoutMinutes: 20,
};

// ============================================================================
// Integrity Agent Labs
// ============================================================================

export const INTEGRITY_LAB_VALUE_COMMIT_REVIEW: LabConfiguration = {
  agentType: 'integrity',
  scenario: 'Value Commit Compliance Review',
  systemPrompt: `You are the Integrity Agent, responsible for ensuring Value Commits meet governance standards.

Your role:
- Review Value Commit documents for compliance
- Flag aggressive or unsupported assumptions
- Ensure proper sign-off chain is documented
- Verify baseline metrics are from reliable sources
- Check that success criteria are measurable

Compliance standards:
1. All improvement assumptions must cite evidence (customer data or benchmark)
2. ROI projections must include risk adjustment (minimum 20% haircut)
3. Payback period claims must be net of implementation costs
4. Customer sign-off required on baseline metrics
5. Quarterly review cadence must be specified

Red flags you watch for:
- "Conservative" estimates that exceed industry benchmarks
- Self-reported baselines without validation
- Missing sensitivity analysis
- Vague success criteria
- No mention of adoption risk

Your behavior:
- Be thorough but fair
- Explain why standards exist
- Offer constructive feedback, not just criticism
- Recognize good practices when you see them
- Suggest specific improvements for non-compliant items`,
  successCriteria: [
    {
      id: 'evidence_based',
      description: 'Support all claims with evidence or benchmarks',
      evaluationType: 'llm_judge',
      weight: 30,
    },
    {
      id: 'risk_adjusted',
      description: 'Include appropriate risk adjustments',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'measurable_criteria',
      description: 'Define measurable success criteria',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'governance_compliance',
      description: 'Follow governance sign-off requirements',
      evaluationType: 'llm_judge',
      weight: 20,
    },
  ],
  maxAttempts: 2,
  timeoutMinutes: 15,
};

// ============================================================================
// Realization Agent Labs
// ============================================================================

export const REALIZATION_LAB_QBR_SIMULATION: LabConfiguration = {
  agentType: 'realization',
  scenario: 'Quarterly Business Review - Variance Analysis',
  systemPrompt: `You are simulating a QBR scenario where the Value Commit has partial achievement.

Context:
- Original Value Commit: $2.4M annual savings
- 6 months in: $800K realized (vs $1.2M projected)
- Adoption rate: 65% (target was 80%)
- Customer stakeholder: CFO who approved the original business case

Your role as the customer:
- You're disappointed but reasonable
- Want to understand why targets were missed
- Need a concrete plan to close the gap
- Considering whether to reduce scope or push harder
- Will respond positively to honest assessment and clear action plan

Key metrics to discuss:
- Projected savings: $200K/month
- Actual savings: $133K/month (33% gap)
- Adoption by department: Sales (85%), Marketing (40%), Finance (70%)
- Marketing department had leadership change - new CMO skeptical

Your behavior:
- Ask pointed questions about the gap
- Push for specific recovery actions
- Be skeptical of excuses but open to plans
- Want to see updated projections
- Need ammunition for your board update`,
  successCriteria: [
    {
      id: 'variance_analysis',
      description: 'Conduct thorough variance analysis',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'root_cause',
      description: 'Identify root causes of underperformance',
      evaluationType: 'llm_judge',
      weight: 25,
    },
    {
      id: 'action_plan',
      description: 'Present concrete gap closure plan',
      evaluationType: 'llm_judge',
      weight: 30,
    },
    {
      id: 'updated_forecast',
      description: 'Provide updated realistic forecast',
      evaluationType: 'llm_judge',
      weight: 20,
    },
  ],
  maxAttempts: 3,
  timeoutMinutes: 20,
};

// ============================================================================
// Lab Instructions
// ============================================================================

export const LAB_INSTRUCTIONS = {
  discovery_skeptical_cfo: [
    'Your goal is to uncover the prospect\'s business challenges through effective questioning.',
    'Focus on listening - ask open-ended questions and let them share.',
    'Avoid pitching your solution early. First understand their world.',
    'Try to identify at least 2-3 specific pain points they\'re experiencing.',
    'Discover who else is involved in decisions and what the approval process looks like.',
    'Build rapport by showing genuine curiosity about their business.',
  ],
  discovery_eager_champion: [
    'This prospect seems ready to buy, but something doesn\'t add up.',
    'Qualify their authority - can they actually make purchasing decisions?',
    'Understand who else needs to be involved in this decision.',
    'Help them see you as a partner in building an internal business case.',
    'Set realistic expectations about timeline and next steps.',
    'Don\'t just sell to them - help them succeed internally.',
  ],
  kpi_roi_modeling: [
    'Build an ROI model that would survive executive scrutiny.',
    'Start with establishing baseline metrics - what\'s the current state?',
    'Use conservative assumptions - when in doubt, go lower.',
    'Include a sensitivity analysis showing best/worst case scenarios.',
    'Account for ALL costs: license, implementation, training, opportunity cost.',
    'The goal is a model you\'d be comfortable defending to a skeptical CFO.',
  ],
  integrity_value_commit: [
    'Present your Value Commit document for compliance review.',
    'Be prepared to defend every assumption with evidence.',
    'Show how you\'ve risk-adjusted the projections.',
    'Demonstrate that success criteria are specific and measurable.',
    'Explain the governance process: who signed off and when.',
    'The Integrity Agent is rigorous but fair - accept feedback gracefully.',
  ],
  realization_qbr: [
    'You\'re presenting a QBR for a Value Commit that\'s underperforming.',
    'Start by acknowledging the gap between projected and actual results.',
    'Analyze the root causes - don\'t make excuses, find explanations.',
    'Present a specific action plan to close the gap.',
    'Be honest about risks to the original projections.',
    'The customer needs ammunition for their board - help them succeed.',
  ],
};

export const LAB_TIPS = {
  discovery_skeptical_cfo: [
    'Try questions like: "What\'s keeping you up at night about [topic]?"',
    'Mirror their language and concerns back to them.',
    'If they mention a problem, dig deeper: "Tell me more about that..."',
    'Ask about impact: "How does that affect your team/bottom line?"',
  ],
  discovery_eager_champion: [
    'Ask: "Walk me through your buying process for something like this."',
    'Try: "Who else would need to weigh in on a decision like this?"',
    'Consider: "What would you need to show your CFO to get approval?"',
  ],
  kpi_roi_modeling: [
    'Industry benchmarks for first-year improvements are typically 8-15%.',
    'Always include implementation and training costs in your model.',
    'Show three scenarios: conservative, expected, and optimistic.',
  ],
  integrity_value_commit: [
    'When challenged, respond with data, not defensiveness.',
    'It\'s okay to acknowledge weaknesses and propose mitigations.',
    'Reference industry benchmarks to support your assumptions.',
  ],
  realization_qbr: [
    'Lead with accountability - don\'t blame the customer.',
    'Break down the gap by department or use case.',
    'Propose specific actions with owners and deadlines.',
  ],
};

// ============================================================================
// Export All Labs
// ============================================================================

export const ALL_LABS = {
  'discovery_skeptical_cfo': DISCOVERY_LAB_SKEPTICAL_CFO,
  'discovery_eager_champion': DISCOVERY_LAB_EAGER_CHAMPION,
  'kpi_roi_modeling': KPI_LAB_ROI_MODELING,
  'integrity_value_commit': INTEGRITY_LAB_VALUE_COMMIT_REVIEW,
  'realization_qbr': REALIZATION_LAB_QBR_SIMULATION,
};
