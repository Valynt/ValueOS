/**
 * Business Case Development Simulation - AI Evaluation Logic
 * Based on BUSINESS_CASE_AI_PROMPTS.md
 */

const SYSTEM_PROMPT = `You are an expert VOS (Value Operating System) coach and business case evaluation specialist. You are evaluating a learner's response in a Business Case Development simulation.

Your role is to:
1. Assess the technical accuracy of their business case methodology
2. Evaluate their cross-functional communication and stakeholder consideration
3. Judge their effective use of AI tools and analytical thinking

Provide constructive, actionable feedback that helps the learner improve their value quantification and executive communication skills.

Use the 40/30/30 scoring rubric:
- Technical (40%): VOS framework accuracy, quantification methodology, financial modeling
- Cross-Functional (30%): Executive communication, stakeholder perspective, business alignment
- AI Augmentation (30%): Analytical depth, efficiency, use of structured thinking

Be encouraging but honest. Focus on specific, actionable improvements.`;

export function getBusinessCaseEvaluationPrompt(stepNumber: number, userResponse: string): string {
  const prompts: Record<number, string> = {
    1: `**Evaluation Task:** Assess the learner's Revenue Impact Analysis for a cybersecurity business case.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Customer: MegaCorp Financial Services (regional bank, $2.8B revenue)
- Current challenges: 45 security incidents/quarter, compliance inefficiency
- Solution: CloudSecure cybersecurity platform

**Expected Elements:**
1. Identifies at least one revenue-related KPI (e.g., customer retention, new market entry, deal velocity)
2. Provides quantified estimate with clear assumptions
3. Explains causal link between solution and revenue impact
4. Includes realistic timeframe for realization

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Revenue KPI identification and relevance (15 pts)
  * 13-15: Multiple relevant KPIs with strong business logic
  * 9-12: One strong KPI with clear reasoning
  * 5-8: KPI identified but weak connection to scenario
  * 0-4: No clear revenue KPI or unrealistic assumptions

- Quantification methodology (15 pts)
  * 13-15: Detailed calculation with realistic assumptions clearly stated
  * 9-12: Reasonable estimate with some assumptions stated
  * 5-8: Vague quantification or missing assumptions
  * 0-4: No quantification or wildly unrealistic numbers

- VOS framework application (10 pts)
  * 9-10: Correctly applies Revenue category of Revenue/Cost/Risk framework
  * 6-8: Understands revenue impact concept but execution weak
  * 3-5: Confuses revenue with cost savings
  * 0-2: No understanding of framework

**Cross-Functional (30 points):**
- Business perspective (15 pts)
  * 13-15: Clearly considers CFO/executive priorities (growth, market position)
  * 9-12: Shows some business thinking but misses key stakeholder concerns
  * 5-8: Too technical, doesn't translate to business outcomes
  * 0-4: No business perspective evident

- Stakeholder communication (15 pts)
  * 13-15: Written in business language, easy for CFO to understand
  * 9-12: Mostly clear but some jargon or unclear phrasing
  * 5-8: Too technical or vague for executive audience
  * 0-4: Confusing or inappropriate for stakeholder

**AI Augmentation (30 points):**
- Analytical depth (15 pts)
  * 13-15: Shows sophisticated analysis, considers multiple angles
  * 9-12: Solid analysis with reasonable depth
  * 5-8: Surface-level analysis, obvious factors only
  * 0-4: Minimal analytical thinking

- Structured thinking (15 pts)
  * 13-15: Well-organized, logical flow, clear assumptions
  * 9-12: Reasonably structured with some organization
  * 5-8: Disorganized or hard to follow
  * 0-4: No clear structure

**Output Format (JSON):**
Return ONLY valid JSON in this exact format:
{
  "score": 85,
  "categoryBreakdown": {
    "technical": 35,
    "crossFunctional": 26,
    "aiAugmentation": 24
  },
  "strengths": [
    "Strength 1",
    "Strength 2",
    "Strength 3"
  ],
  "improvements": [
    "Improvement 1",
    "Improvement 2",
    "Improvement 3"
  ],
  "feedback": "Detailed feedback paragraph here."
}

Evaluate the learner's response now, providing scores, strengths, improvements, and detailed feedback.`,

    2: `**Evaluation Task:** Assess the learner's Cost Reduction Analysis for the cybersecurity business case.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Current incident cost: $5.6M annually (180 incidents × $125K)
- Compliance team: 8 FTEs at 60% utilization on manual work
- Cyber insurance: $2.4M annually
- Solution: CloudSecure platform ($480K Year 1, $420K Years 2-3)

**Expected Elements:**
1. Quantifies incident reduction savings with realistic % reduction
2. Calculates compliance efficiency gains (FTE savings or redeployment)
3. Estimates insurance premium reduction potential
4. Shows 3-year cumulative savings
5. States all assumptions clearly

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Incident reduction calculation (15 pts)
  * 13-15: Accurate calculation with realistic % reduction (60-70%), shows annual and 3-year
  * 9-12: Reasonable calculation but % reduction too aggressive or conservative
  * 5-8: Math errors or missing key components
  * 0-4: No quantification or completely unrealistic

- Compliance efficiency calculation (15 pts)
  * 13-15: Calculates FTE savings correctly, considers loaded cost, shows redeployment value
  * 9-12: Reasonable FTE savings but missing loaded cost or redeployment angle
  * 5-8: Vague efficiency claims without quantification
  * 0-4: No compliance savings quantified

- Financial modeling accuracy (10 pts)
  * 9-10: 3-year model with proper discounting, clear year-by-year breakdown
  * 6-8: 3-year total shown but no year-by-year detail
  * 3-5: Only shows Year 1 or cumulative without breakdown
  * 0-2: No multi-year view

**Cross-Functional (30 points):**
- CFO perspective (15 pts)
  * 13-15: Addresses CFO concerns (cash flow, payback, risk-adjusted savings)
  * 9-12: Shows some financial thinking but misses key CFO priorities
  * 5-8: Too operational, doesn't elevate to strategic financial view
  * 0-4: No CFO perspective

- Assumption clarity (15 pts)
  * 13-15: All assumptions stated explicitly, realistic, and defensible
  * 9-12: Most assumptions stated but some gaps
  * 5-8: Few assumptions stated, hard to validate claims
  * 0-4: No assumptions provided

**AI Augmentation (30 points):**
- Analytical rigor (15 pts)
  * 13-15: Considers multiple cost categories, shows sensitivity analysis
  * 9-12: Solid analysis of 2-3 cost categories
  * 5-8: Only analyzes one cost category
  * 0-4: Superficial analysis

- Efficiency and completeness (15 pts)
  * 13-15: Comprehensive, well-organized, easy to follow
  * 9-12: Reasonably complete but could be better organized
  * 5-8: Missing key elements or disorganized
  * 0-4: Incomplete or confusing

**Output Format (JSON):**
Return ONLY valid JSON in this exact format:
{
  "score": 88,
  "categoryBreakdown": {
    "technical": 37,
    "crossFunctional": 27,
    "aiAugmentation": 24
  },
  "strengths": [
    "Strength 1",
    "Strength 2",
    "Strength 3"
  ],
  "improvements": [
    "Improvement 1",
    "Improvement 2",
    "Improvement 3"
  ],
  "feedback": "Detailed feedback paragraph here."
}

Evaluate the learner's response now.`,

    3: `**Evaluation Task:** Assess the learner's Risk Mitigation Value analysis.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Customer: MegaCorp Financial Services (regional bank, $2.8B revenue)
- Current risks: Security incidents, regulatory fines, brand damage
- Industry data: $4.5M average breach fine, 15% annual breach probability

**Expected Elements:**
1. Identifies specific risks being mitigated
2. Quantifies probability and impact of risks
3. Calculates expected value of risk reduction
4. References industry data or benchmarks

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Risk identification (15 pts)
  * 13-15: Identifies 3+ specific, relevant risks with clear definitions
  * 9-12: Identifies 2 risks with reasonable clarity
  * 5-8: Vague risk descriptions or only 1 risk identified
  * 0-4: No clear risk identification

- Quantification methodology (15 pts)
  * 13-15: Uses probability × impact for expected value, shows calculations
  * 9-12: Attempts quantification but methodology unclear
  * 5-8: Provides estimates without clear methodology
  * 0-4: No quantification

- Industry benchmarks (10 pts)
  * 9-10: References multiple credible industry sources
  * 6-8: References at least one benchmark
  * 3-5: Mentions benchmarks but no specifics
  * 0-2: No industry data referenced

**Cross-Functional (30 points):**
- CFO/Board perspective (15 pts)
  * 13-15: Clearly addresses risk appetite and fiduciary concerns
  * 9-12: Shows some risk management thinking
  * 5-8: Too technical, misses strategic risk view
  * 0-4: No executive perspective

- Communication clarity (15 pts)
  * 13-15: Clear, concise, appropriate for board discussion
  * 9-12: Mostly clear but some gaps
  * 5-8: Confusing or too technical
  * 0-4: Unclear communication

**AI Augmentation (30 points):**
- Analytical sophistication (15 pts)
  * 13-15: Multi-dimensional risk analysis, considers cascading effects
  * 9-12: Solid analysis of direct risks
  * 5-8: Surface-level risk assessment
  * 0-4: Minimal analysis

- Structured thinking (15 pts)
  * 13-15: Well-organized risk framework, clear logic
  * 9-12: Reasonable structure
  * 5-8: Disorganized
  * 0-4: No structure

**Output Format (JSON):**
Return ONLY valid JSON in this exact format:
{
  "score": 82,
  "categoryBreakdown": {
    "technical": 34,
    "crossFunctional": 25,
    "aiAugmentation": 23
  },
  "strengths": [
    "Strength 1",
    "Strength 2",
    "Strength 3"
  ],
  "improvements": [
    "Improvement 1",
    "Improvement 2",
    "Improvement 3"
  ],
  "feedback": "Detailed feedback paragraph here."
}

Evaluate the learner's response now.`,

    4: `**Evaluation Task:** Assess the learner's Executive Summary for CFO Sarah Chen.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Audience: CFO of $2.8B regional bank
- Purpose: Secure approval for $480K cybersecurity investment
- Expected: ROI, payback period, NPV, clear recommendation

**Expected Elements:**
1. Leads with key financial metrics (ROI, Payback, NPV)
2. Summarizes value in Revenue/Cost/Risk framework
3. Addresses implementation considerations
4. Includes clear recommendation
5. Written for C-level audience (concise, business-focused)

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Financial metrics (15 pts)
  * 13-15: All key metrics (ROI, payback, NPV) clearly stated upfront
  * 9-12: Most metrics included but not prominent
  * 5-8: Missing key metrics or buried in text
  * 0-4: No financial metrics

- Value framework (15 pts)
  * 13-15: Clear Revenue/Cost/Risk breakdown with totals
  * 9-12: Mentions framework but incomplete
  * 5-8: Vague value summary
  * 0-4: No framework application

- Recommendation clarity (10 pts)
  * 9-10: Clear, specific recommendation with next steps
  * 6-8: Recommendation present but vague
  * 3-5: Weak or unclear recommendation
  * 0-2: No recommendation

**Cross-Functional (30 points):**
- Executive communication (15 pts)
  * 13-15: Concise, business-focused, appropriate tone for CFO
  * 9-12: Mostly appropriate but some issues
  * 5-8: Too technical or verbose
  * 0-4: Inappropriate for executive audience

- Stakeholder priorities (15 pts)
  * 13-15: Addresses CFO concerns (ROI, risk, cash flow, timing)
  * 9-12: Addresses some priorities
  * 5-8: Misses key CFO concerns
  * 0-4: No stakeholder consideration

**AI Augmentation (30 points):**
- Synthesis quality (15 pts)
  * 13-15: Excellent synthesis of complex analysis into clear narrative
  * 9-12: Good synthesis with minor gaps
  * 5-8: Weak synthesis, hard to follow
  * 0-4: No synthesis

- Persuasiveness (15 pts)
  * 13-15: Compelling, data-driven, addresses objections
  * 9-12: Reasonably persuasive
  * 5-8: Weak persuasion
  * 0-4: Not persuasive

**Output Format (JSON):**
Return ONLY valid JSON in this exact format:
{
  "score": 90,
  "categoryBreakdown": {
    "technical": 38,
    "crossFunctional": 28,
    "aiAugmentation": 24
  },
  "strengths": [
    "Strength 1",
    "Strength 2",
    "Strength 3"
  ],
  "improvements": [
    "Improvement 1",
    "Improvement 2",
    "Improvement 3"
  ],
  "feedback": "Detailed feedback paragraph here."
}

Evaluate the learner's response now.`,

    5: `**Evaluation Task:** Assess the learner's Implementation Risks & Mitigation plan.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Project: CloudSecure platform implementation at MegaCorp
- Timeline: 3 months implementation
- Stakeholders: IT, Security, Compliance, Executive team

**Expected Elements:**
1. Identifies 3 specific implementation risks
2. Assesses probability and impact for each
3. Proposes concrete mitigation actions
4. Assigns ownership/accountability

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Risk identification (15 pts)
  * 13-15: 3+ specific, realistic risks with clear definitions
  * 9-12: 2-3 risks identified, reasonably specific
  * 5-8: Vague risks or only 1-2 identified
  * 0-4: No clear risks identified

- Risk assessment (15 pts)
  * 13-15: Probability and impact quantified for each risk
  * 9-12: Qualitative assessment (high/med/low) for each
  * 5-8: Incomplete assessment
  * 0-4: No assessment

- Mitigation strategies (10 pts)
  * 9-10: Specific, actionable mitigation for each risk
  * 6-8: Some mitigation strategies but vague
  * 3-5: Weak or generic mitigation
  * 0-2: No mitigation proposed

**Cross-Functional (30 points):**
- Stakeholder consideration (15 pts)
  * 13-15: Considers multiple stakeholders, assigns ownership
  * 9-12: Mentions stakeholders but no clear ownership
  * 5-8: Limited stakeholder consideration
  * 0-4: No stakeholder view

- Organizational readiness (15 pts)
  * 13-15: Addresses change management, training, adoption
  * 9-12: Mentions some organizational factors
  * 5-8: Limited organizational consideration
  * 0-4: No organizational perspective

**AI Augmentation (30 points):**
- Risk thinking depth (15 pts)
  * 13-15: Considers cascading risks, dependencies, second-order effects
  * 9-12: Solid risk analysis
  * 5-8: Surface-level risk thinking
  * 0-4: Minimal analysis

- Practical applicability (15 pts)
  * 13-15: Mitigation plan is realistic and implementable
  * 9-12: Mostly practical
  * 5-8: Some impractical elements
  * 0-4: Unrealistic plan

**Output Format (JSON):**
Return ONLY valid JSON in this exact format:
{
  "score": 85,
  "categoryBreakdown": {
    "technical": 36,
    "crossFunctional": 26,
    "aiAugmentation": 23
  },
  "strengths": [
    "Strength 1",
    "Strength 2",
    "Strength 3"
  ],
  "improvements": [
    "Improvement 1",
    "Improvement 2",
    "Improvement 3"
  ],
  "feedback": "Detailed feedback paragraph here."
}

Evaluate the learner's response now.`
  };

  return prompts[stepNumber] || "";
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export interface EvaluationResult {
  score: number;
  categoryBreakdown: {
    technical: number;
    crossFunctional: number;
    aiAugmentation: number;
  };
  strengths: string[];
  improvements: string[];
  feedback: string;
}
