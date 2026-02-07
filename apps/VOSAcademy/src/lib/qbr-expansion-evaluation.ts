/**
 * QBR Expansion Modeling Simulation - AI Evaluation Logic
 * Based on SIMULATION_DESIGN_SPEC.md
 */

const SYSTEM_PROMPT = `You are an expert VOS (Value Operating System) coach and QBR facilitation specialist. You are evaluating a learner's response in a QBR Expansion Modeling simulation.

Your role is to:
1. Assess their ability to analyze value realization against commitments
2. Evaluate their storytelling and executive communication skills
3. Judge their strategic thinking in identifying expansion opportunities

Provide constructive, actionable feedback that helps the learner improve their QBR facilitation and expansion selling skills.

Use the 40/30/30 scoring rubric:
- Technical (40%): Value quantification, data analysis, business case logic
- Cross-Functional (30%): Storytelling, executive communication, strategic thinking
- AI Augmentation (30%): Analytical depth, presentation quality, efficiency

Be encouraging but honest. Focus on specific, actionable improvements.`;

export function getQBRExpansionEvaluationPrompt(stepNumber: number, userResponse: string): string {
  const prompts: Record<number, string> = {
    1: `**Evaluation Task:** Assess the learner's Value Realization Analysis for a QBR.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Customer: DataFlow Analytics (9 months post-implementation)
- Original commitments: 50% time reduction, 15% ROI improvement, 2x volume
- Actual results: 55% time reduction, 22% ROI improvement, 1.6x volume, $360K ad spend savings
- Current ARR: $180K

**Expected Elements:**
1. Compares each commitment to actual results
2. Quantifies total value delivered (dollar amount)
3. Identifies overperformance areas
4. Explains any underperformance with context
5. Calculates ROI on customer's investment

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Value quantification accuracy (15 pts)
  * 13-15: Accurately quantifies all value categories with clear methodology
  * 9-12: Quantifies most value but missing some components
  * 5-8: Vague quantification or significant calculation errors
  * 0-4: No meaningful quantification

- Comparison methodology (15 pts)
  * 13-15: Clear side-by-side comparison of committed vs. actual for each metric
  * 9-12: Compares most metrics but lacks structure
  * 5-8: Incomplete comparison or missing key metrics
  * 0-4: No systematic comparison

- ROI calculation (10 pts)
  * 9-10: Accurate ROI calculation with clear assumptions
  * 6-8: ROI calculated but methodology unclear
  * 3-5: ROI mentioned but not calculated
  * 0-2: No ROI analysis

**Cross-Functional (30 points):**
- Business perspective (15 pts)
  * 13-15: Clearly frames results in business terms VP Marketing Ops cares about
  * 9-12: Shows some business thinking but too operational
  * 5-8: Too technical, doesn't translate to business impact
  * 0-4: No business perspective

- Gap analysis quality (15 pts)
  * 13-15: Thoughtfully explains underperformance with context and mitigation
  * 9-12: Acknowledges gaps but explanation weak
  * 5-8: Ignores gaps or defensive explanation
  * 0-4: No gap analysis

**AI Augmentation (30 points):**
- Analytical depth (15 pts)
  * 13-15: Sophisticated analysis, identifies patterns and insights beyond raw numbers
  * 9-12: Solid analysis with reasonable depth
  * 5-8: Surface-level analysis, just restates numbers
  * 0-4: Minimal analytical thinking

- Data organization (15 pts)
  * 13-15: Well-organized, easy to follow, clear structure
  * 9-12: Reasonably organized
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

Evaluate the learner's response now.`,

    2: `**Evaluation Task:** Assess the learner's Value Story for a QBR presentation.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Customer: DataFlow Analytics, VP Marketing Ops Jennifer Wu
- Results: 55% time savings, 22% ROI improvement, $360K ad spend savings
- Audience: Jennifer will share this with her executive team
- Goal: Memorable, data-driven story that celebrates success

**Expected Elements:**
1. Opens with business context/challenge
2. Uses specific numbers and percentages
3. Highlights unexpected wins
4. Connects to broader business goals
5. Ends with forward-looking statement

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Data accuracy (15 pts)
  * 13-15: All numbers accurate and properly contextualized
  * 9-12: Most numbers accurate but some context missing
  * 5-8: Some inaccuracies or poor contextualization
  * 0-4: Significant data errors

- Metric selection (15 pts)
  * 13-15: Selects most impactful metrics, prioritizes well
  * 9-12: Good metrics but could prioritize better
  * 5-8: Includes less relevant metrics
  * 0-4: Poor metric selection

- Business outcome focus (10 pts)
  * 9-10: Clearly translates metrics to business outcomes
  * 6-8: Some outcome focus but could be stronger
  * 3-5: Too focused on product features
  * 0-2: No business outcome connection

**Cross-Functional (30 points):**
- Storytelling quality (15 pts)
  * 13-15: Compelling narrative arc, emotionally engaging, memorable
  * 9-12: Good story but lacks emotional impact
  * 5-8: Weak narrative structure
  * 0-4: No storytelling, just facts

- Executive communication (15 pts)
  * 13-15: Perfect tone for executive audience, concise, impactful
  * 9-12: Appropriate tone but could be more concise
  * 5-8: Too detailed or wrong tone
  * 0-4: Inappropriate for executives

**AI Augmentation (30 points):**
- Narrative creativity (15 pts)
  * 13-15: Creative, memorable framing that stands out
  * 9-12: Solid narrative but conventional
  * 5-8: Generic or formulaic
  * 0-4: No creativity

- Persuasiveness (15 pts)
  * 13-15: Highly persuasive, builds momentum for expansion
  * 9-12: Reasonably persuasive
  * 5-8: Weak persuasion
  * 0-4: Not persuasive

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

    3: `**Evaluation Task:** Assess the learner's Expansion Opportunity Analysis.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Customer: DataFlow Analytics
- Current challenges: Sales funnel visibility, executive dashboard needs, manual churn analysis
- Expansion options: Sales Analytics ($240K), Customer Journey Analytics ($320K), Executive Dashboard ($80K)
- Success with Marketing Analytics module provides proof point

**Expected Elements:**
1. Analyzes each expansion option against customer challenges
2. Identifies clear #1 recommendation with rationale
3. Explains why other options are lower priority
4. Connects recommendation to value already delivered
5. Considers timing and organizational readiness

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Option analysis (15 pts)
  * 13-15: Thorough analysis of all three options with clear criteria
  * 9-12: Analyzes options but criteria unclear
  * 5-8: Superficial analysis
  * 0-4: No meaningful analysis

- Prioritization logic (15 pts)
  * 13-15: Clear, defensible prioritization with strong rationale
  * 9-12: Reasonable prioritization but weak rationale
  * 5-8: Arbitrary or unclear prioritization
  * 0-4: No prioritization

- Value linkage (10 pts)
  * 9-10: Strongly connects recommendation to proven Marketing Analytics success
  * 6-8: Some linkage but could be stronger
  * 3-5: Weak linkage
  * 0-2: No connection to current success

**Cross-Functional (30 points):**
- Strategic thinking (15 pts)
  * 13-15: Demonstrates sophisticated strategic thinking about customer journey
  * 9-12: Shows some strategic thinking
  * 5-8: Tactical thinking only
  * 0-4: No strategic perspective

- Customer-centricity (15 pts)
  * 13-15: Clearly prioritizes customer needs and readiness
  * 9-12: Considers customer but could be more focused
  * 5-8: Vendor-centric perspective
  * 0-4: No customer consideration

**AI Augmentation (30 points):**
- Analytical rigor (15 pts)
  * 13-15: Rigorous analysis with multiple dimensions considered
  * 9-12: Solid analysis
  * 5-8: Surface-level analysis
  * 0-4: Minimal analysis

- Recommendation clarity (15 pts)
  * 13-15: Crystal clear recommendation with actionable next steps
  * 9-12: Clear recommendation but vague on next steps
  * 5-8: Unclear or hedged recommendation
  * 0-4: No clear recommendation

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

    4: `**Evaluation Task:** Assess the learner's Expansion Business Case.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Customer: DataFlow Analytics
- Recommended module: (learner's choice from Step 3)
- Context: QBR setting, need concise business case
- Proof point: Marketing Analytics delivered 22% ROI improvement, $360K savings

**Expected Elements:**
1. Quantifies expected value in 2-3 categories
2. Uses realistic assumptions based on current results
3. Calculates ROI and payback period
4. Addresses implementation effort/timeline
5. Proposes next steps

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Value quantification (15 pts)
  * 13-15: Quantifies 2-3 value categories with clear methodology
  * 9-12: Quantifies value but methodology unclear
  * 5-8: Vague quantification
  * 0-4: No quantification

- Assumptions quality (15 pts)
  * 13-15: Conservative, realistic assumptions based on Marketing Analytics results
  * 9-12: Reasonable assumptions but could be better grounded
  * 5-8: Aggressive or unrealistic assumptions
  * 0-4: No assumptions stated

- Financial metrics (10 pts)
  * 9-10: Clear ROI and payback calculations
  * 6-8: Metrics present but calculations unclear
  * 3-5: Missing key metrics
  * 0-2: No financial metrics

**Cross-Functional (30 points):**
- Conciseness (15 pts)
  * 13-15: Concise, QBR-appropriate length, easy to digest
  * 9-12: Mostly concise but some verbosity
  * 5-8: Too long for QBR context
  * 0-4: Excessively verbose

- Persuasiveness (15 pts)
  * 13-15: Compelling case that makes it easy to say yes
  * 9-12: Reasonably persuasive
  * 5-8: Weak persuasion
  * 0-4: Not persuasive

**AI Augmentation (30 points):**
- Proof point leverage (15 pts)
  * 13-15: Excellently leverages Marketing Analytics success as proof
  * 9-12: Uses proof points but could be stronger
  * 5-8: Weak leverage of existing success
  * 0-4: No connection to proven results

- Next steps clarity (15 pts)
  * 13-15: Clear, actionable next steps with timeline
  * 9-12: Next steps present but vague
  * 5-8: Unclear next steps
  * 0-4: No next steps

**Output Format (JSON):**
Return ONLY valid JSON in this exact format:
{
  "score": 86,
  "categoryBreakdown": {
    "technical": 36,
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

Evaluate the learner's response now.`,

    5: `**Evaluation Task:** Assess the learner's QBR Presentation Outline.

**Learner's Response:**
${userResponse}

**Scenario Context:**
- Audience: VP Marketing Ops Jennifer Wu (will present to her executive team)
- Duration: 30-45 minute QBR
- Goal: Celebrate success, build momentum for expansion
- Format: Slide-by-slide outline with titles and key points

**Expected Elements:**
1. Logical flow: Results → Story → Expansion → Next Steps
2. Each slide has clear title and 2-3 key points
3. Includes data visualization recommendations
4. Balances celebration and forward momentum
5. Ends with clear call-to-action

**Scoring Criteria (0-100 points):**

**Technical (40 points):**
- Presentation structure (15 pts)
  * 13-15: Excellent logical flow, 8-10 slides, well-paced
  * 9-12: Good structure but pacing issues
  * 5-8: Weak structure or wrong slide count
  * 0-4: No clear structure

- Content completeness (15 pts)
  * 13-15: All key elements covered (results, story, expansion, next steps)
  * 9-12: Most elements covered but gaps
  * 5-8: Missing major elements
  * 0-4: Incomplete outline

- Data visualization (10 pts)
  * 9-10: Specific, appropriate visualization recommendations for each data slide
  * 6-8: Some visualization recommendations
  * 3-5: Vague or inappropriate visualizations
  * 0-2: No visualization guidance

**Cross-Functional (30 points):**
- Executive appropriateness (15 pts)
  * 13-15: Perfect tone and depth for executive QBR
  * 9-12: Mostly appropriate but some issues
  * 5-8: Too detailed or wrong tone
  * 0-4: Inappropriate for executives

- Narrative flow (15 pts)
  * 13-15: Compelling narrative arc that builds to expansion ask
  * 9-12: Decent flow but could be stronger
  * 5-8: Disjointed or weak narrative
  * 0-4: No narrative flow

**AI Augmentation (30 points):**
- Presentation polish (15 pts)
  * 13-15: Professional, polished outline ready to build slides from
  * 9-12: Good outline but needs refinement
  * 5-8: Rough outline
  * 0-4: Unprofessional or incomplete

- Call-to-action clarity (15 pts)
  * 13-15: Crystal clear CTA with specific next steps and timeline
  * 9-12: Clear CTA but vague on specifics
  * 5-8: Weak or unclear CTA
  * 0-4: No CTA

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
