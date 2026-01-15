import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const resourcesDir = join(process.cwd(), 'client', 'public', 'resources');

const resources = [
  {
    filename: 'roi-calculator.md',
    title: 'ROI Calculator',
    content: `# ROI Calculator Template

## Investment Summary

### One-Time Costs
| Item | Cost | Notes |
|------|------|-------|
| Software License | $______ | |
| Implementation Services | $______ | |
| Hardware/Infrastructure | $______ | |
| Training | $______ | |
| Data Migration | $______ | |
| **Total One-Time** | **$______** | |

### Recurring Costs (Annual)
| Item | Year 1 | Year 2 | Year 3 |
|------|--------|--------|--------|
| Subscription/Maintenance | $______ | $______ | $______ |
| Support | $______ | $______ | $______ |
| Internal Resources | $______ | $______ | $______ |
| **Total Recurring** | **$______** | **$______** | **$______** |

## Benefits Calculation

### Cost Reduction
| Benefit | Calculation | Year 1 | Year 2 | Year 3 |
|---------|-------------|--------|--------|--------|
| Labor Cost Savings | Hours saved × Hourly rate | $______ | $______ | $______ |
| Operational Efficiency | Process cost reduction | $______ | $______ | $______ |
| Error Reduction | Error cost × Reduction % | $______ | $______ | $______ |

### Revenue Growth
| Benefit | Calculation | Year 1 | Year 2 | Year 3 |
|---------|-------------|--------|--------|--------|
| Increased Sales | New revenue opportunities | $______ | $______ | $______ |
| Customer Retention | Churn reduction value | $______ | $______ | $______ |
| Faster Time-to-Market | Revenue acceleration | $______ | $______ | $______ |

### Productivity Gains
| Benefit | Calculation | Year 1 | Year 2 | Year 3 |
|---------|-------------|--------|--------|--------|
| Time Savings | Hours × Hourly value | $______ | $______ | $______ |
| Capacity Creation | FTE equivalent value | $______ | $______ | $______ |

## ROI Summary

| Metric | Year 1 | Year 2 | Year 3 | 3-Year Total |
|--------|--------|--------|--------|--------------|
| Total Investment | $______ | $______ | $______ | $______ |
| Total Benefits | $______ | $______ | $______ | $______ |
| Net Value | $______ | $______ | $______ | $______ |
| Cumulative Net Value | $______ | $______ | $______ | $______ |
| ROI % | ____% | ____% | ____% | ____% |

### Payback Period
**Months to break even:** ______

### Net Present Value (NPV)
**Discount Rate:** _____%  
**NPV:** $______

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'value-realization-playbook.md',
    title: 'Value Realization Playbook',
    content: `# Value Realization Playbook

## Phase 1: Value Planning (Pre-Implementation)

### Establish Baseline Metrics
- [ ] Document current state performance
- [ ] Identify measurement systems
- [ ] Set data collection processes
- [ ] Validate baseline with stakeholders

### Define Success Criteria
- [ ] Align on target outcomes
- [ ] Set realistic timelines
- [ ] Establish measurement frequency
- [ ] Identify early indicators

### Create Value Realization Plan
- [ ] Map value milestones to implementation phases
- [ ] Assign ownership for each metric
- [ ] Schedule regular value reviews
- [ ] Define escalation process

## Phase 2: Value Tracking (During Implementation)

### Weekly Activities
- [ ] Monitor leading indicators
- [ ] Track adoption metrics
- [ ] Document quick wins
- [ ] Address blockers

### Monthly Reviews
- [ ] Analyze trend data
- [ ] Compare actual vs. planned
- [ ] Adjust tactics as needed
- [ ] Communicate progress

### Quarterly Business Reviews
- [ ] Present value dashboard
- [ ] Quantify realized benefits
- [ ] Identify expansion opportunities
- [ ] Align on next priorities

## Phase 3: Value Optimization (Post-Go-Live)

### Continuous Improvement
- [ ] Identify optimization opportunities
- [ ] Run experiments and pilots
- [ ] Scale what works
- [ ] Retire what doesn't

### Value Expansion
- [ ] Explore adjacent use cases
- [ ] Engage new user groups
- [ ] Deepen feature adoption
- [ ] Capture additional benefits

## Value Metrics Framework

### Adoption Metrics
- Active users / Total users
- Feature utilization rate
- Training completion rate
- Support ticket volume

### Efficiency Metrics
- Process cycle time
- Error/rework rate
- Automation rate
- Resource utilization

### Business Impact Metrics
- Cost per transaction
- Revenue per customer
- Customer satisfaction score
- Employee productivity

## Value Storytelling

### Monthly Value Story Template
**Headline:** [One-sentence impact statement]

**Context:** [What we set out to achieve]

**Progress:** [What we've accomplished]

**Impact:** [Quantified business results]

**Next Steps:** [What's coming next]

**Stakeholder Quote:** [Testimonial from key user]

## Risk Mitigation

### Common Value Realization Risks
| Risk | Mitigation |
|------|------------|
| Low adoption | Targeted change management |
| Data quality issues | Validation processes |
| Scope creep | Disciplined prioritization |
| Stakeholder misalignment | Regular communication |

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'customer-success-metrics-guide.md',
    title: 'Customer Success Metrics Guide',
    content: `# Customer Success Metrics Guide

## Health Score Framework

### Product Adoption (30%)
- Login frequency
- Feature utilization depth
- Power user ratio
- Mobile app usage

### Engagement (25%)
- Support ticket volume
- Response to outreach
- Event/webinar attendance
- Community participation

### Sentiment (20%)
- NPS score
- CSAT ratings
- Executive relationship strength
- Renewal risk indicators

### Business Outcomes (25%)
- Value realization progress
- ROI achievement
- Use case expansion
- Reference-ability

## Leading Indicators

### Early Warning Signs
- ⚠️ Declining login frequency
- ⚠️ Increased support tickets
- ⚠️ Executive turnover
- ⚠️ Budget cuts
- ⚠️ Competitive evaluation

### Expansion Signals
- ✅ High feature adoption
- ✅ Positive feedback
- ✅ Additional use cases identified
- ✅ Executive sponsorship
- ✅ Willingness to be a reference

## Lagging Indicators

### Retention Metrics
- Gross retention rate
- Net retention rate
- Churn rate by segment
- Time to churn

### Expansion Metrics
- Upsell rate
- Cross-sell rate
- Expansion ARR
- Seat growth

## Customer Segmentation

### Tier 1: Strategic
- High ARR
- High growth potential
- Reference account
- **CSM Touch:** Weekly

### Tier 2: Growth
- Medium ARR
- Expansion opportunity
- Healthy adoption
- **CSM Touch:** Bi-weekly

### Tier 3: Standard
- Lower ARR
- Stable usage
- Self-sufficient
- **CSM Touch:** Monthly

## QBR Structure

### Executive Business Review Agenda
1. **Relationship Check-in** (5 min)
2. **Business Context Update** (10 min)
3. **Value Delivered** (15 min)
   - Metrics dashboard
   - Success stories
   - ROI quantification
4. **Product Roadmap** (10 min)
5. **Expansion Opportunities** (10 min)
6. **Action Items & Next Steps** (10 min)

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'value-messaging-framework.md',
    title: 'Value Messaging Framework',
    content: `# Value Messaging Framework

## Message Architecture

### Level 1: Strategic Value (C-Suite)
**Focus:** Business outcomes and competitive advantage

**Message Formula:**
"[Solution] helps [Company Type] achieve [Strategic Outcome] by [Key Differentiator], resulting in [Quantified Impact]."

**Example:**
"Our platform helps mid-market manufacturers achieve operational excellence by connecting real-time production data with AI-powered insights, resulting in 25% reduction in downtime and $2M annual savings."

### Level 2: Operational Value (VP/Director)
**Focus:** Process improvement and team productivity

**Message Formula:**
"[Solution] enables [Department] to [Operational Improvement] through [Capability], driving [Measurable Result]."

**Example:**
"Our solution enables sales teams to accelerate deal cycles through automated value quantification, driving 30% faster time-to-close."

### Level 3: Functional Value (Manager/User)
**Focus:** Daily workflows and pain point resolution

**Message Formula:**
"[Solution] helps [Role] [Solve Problem] with [Feature], saving [Time/Effort]."

**Example:**
"Our tool helps sales engineers build compelling ROI models with pre-built templates, saving 5 hours per proposal."

## Value Pillars

### Pillar 1: [Primary Value Theme]
- **Headline:** [Compelling statement]
- **Supporting Points:**
  - [Benefit 1]
  - [Benefit 2]
  - [Benefit 3]
- **Proof Point:** [Customer stat or case study]

### Pillar 2: [Secondary Value Theme]
- **Headline:** [Compelling statement]
- **Supporting Points:**
  - [Benefit 1]
  - [Benefit 2]
- **Proof Point:** [Customer stat or case study]

## Competitive Positioning

### Our Unique Value
[What we do that competitors can't]

### When to Use This Message
[Competitive scenarios where this resonates]

### Proof Points
- [Customer success story]
- [Third-party validation]
- [Quantified differentiation]

## Industry-Specific Messaging

### Financial Services
**Pain Points:** Regulatory compliance, risk management, legacy systems
**Value Message:** [Tailored message]

### Healthcare
**Pain Points:** Patient outcomes, operational efficiency, compliance
**Value Message:** [Tailored message]

### Manufacturing
**Pain Points:** Supply chain, quality control, downtime
**Value Message:** [Tailored message]

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'objection-handling-guide.md',
    title: 'Objection Handling Guide',
    content: `# Objection Handling Guide

## The LAER Framework

### **L**isten
- Let the customer fully express their concern
- Don't interrupt or get defensive
- Take notes on specific language used

### **A**cknowledge
- Validate their concern
- Show empathy
- "I understand why that's important to you..."

### **E**xplore
- Ask clarifying questions
- Uncover the root concern
- "Help me understand more about..."

### **R**espond
- Address the specific concern
- Provide evidence
- Offer alternatives

## Common Objections & Responses

### "It's too expensive"

**Underlying Concern:** Budget constraints or unclear ROI

**Response Framework:**
1. Acknowledge: "I understand budget is always a consideration..."
2. Reframe: "Let's look at this as an investment rather than a cost..."
3. Quantify: "Based on our discussion, you're currently spending $X on [problem]. Our solution pays for itself in [Y] months through [specific savings]."
4. Compare: "What's the cost of not solving this problem?"

### "We need to think about it"

**Underlying Concern:** Missing information or unclear value

**Response Framework:**
1. Acknowledge: "Absolutely, this is an important decision..."
2. Explore: "What specific aspects do you need to think through?"
3. Address: [Tackle the specific concerns]
4. Create urgency: "What would need to happen for you to move forward by [date]?"

### "We're already working with [Competitor]"

**Underlying Concern:** Switching costs or satisfaction with status quo

**Response Framework:**
1. Acknowledge: "That's great that you have a solution in place..."
2. Explore: "How well is it meeting your needs? What would you improve?"
3. Differentiate: "Here's what customers tell us they get from us that they weren't getting before..."
4. Offer: "Would it make sense to run a pilot to compare results?"

### "We don't have time to implement this"

**Underlying Concern:** Change management burden

**Response Framework:**
1. Acknowledge: "I understand your team is already stretched..."
2. Quantify current cost: "How much time are you spending on [manual process] today?"
3. Show path: "Our implementation typically takes [X] weeks with [Y] hours of your team's time..."
4. ROI: "That investment of [X] hours will save you [Y] hours per month going forward."

### "We need to see more proof"

**Underlying Concern:** Risk aversion or lack of trust

**Response Framework:**
1. Acknowledge: "That's a smart approach..."
2. Offer evidence: "Let me share how [Similar Company] achieved [Result]..."
3. Provide options: "Would a pilot program help you validate the value?"
4. References: "I can connect you with [Customer] who had similar concerns..."

## Objection Prevention

### During Discovery
- Uncover budget early
- Identify decision criteria
- Map the decision process
- Build multi-threading relationships

### During Presentation
- Lead with value, not features
- Quantify ROI clearly
- Address risks proactively
- Provide social proof

### During Proposal
- Align to their success metrics
- Show clear implementation path
- Include risk mitigation plan
- Offer flexible options

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'executive-presentation-template.md',
    title: 'Executive Presentation Template',
    content: `# Executive Presentation Template

## Slide 1: Title
**[Solution Name]**  
Value Proposition for [Company Name]

Presented by: [Your Name]  
Date: [Date]

---

## Slide 2: Executive Summary
**The Opportunity**
[One sentence describing the business challenge]

**Our Recommendation**
[One sentence describing your solution]

**Expected Impact**
- [Key Metric 1]: [Improvement]
- [Key Metric 2]: [Improvement]
- ROI: [X]% | Payback: [Y] months

---

## Slide 3: Business Challenge
**Current State**
- [Pain point 1 with quantified impact]
- [Pain point 2 with quantified impact]
- [Pain point 3 with quantified impact]

**Cost of Inaction**
$[Amount] per year in [lost opportunity/inefficiency]

---

## Slide 4: Our Solution
**How We Help**
[Visual diagram showing before → after]

**Key Capabilities**
1. [Capability 1] → [Business outcome]
2. [Capability 2] → [Business outcome]
3. [Capability 3] → [Business outcome]

---

## Slide 5: Financial Impact
[Chart showing 3-year value projection]

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Investment | $X | $Y | $Z |
| Benefits | $A | $B | $C |
| Net Value | $D | $E | $F |

**3-Year ROI:** [X]%  
**Payback Period:** [Y] months

---

## Slide 6: Proof Points
**Customer Success Stories**

**[Company A] - [Industry]**
- [Metric]: [Improvement]
- [Quote from executive]

**[Company B] - [Industry]**
- [Metric]: [Improvement]
- [Quote from executive]

---

## Slide 7: Implementation Roadmap
[Gantt chart or timeline visual]

**Phase 1:** Planning (Months 1-2)
**Phase 2:** Implementation (Months 3-6)
**Phase 3:** Optimization (Months 7-12)

**Key Milestones:**
- [Milestone 1]: [Date]
- [Milestone 2]: [Date]
- [Value Realization]: [Date]

---

## Slide 8: Risk Mitigation
| Risk | Mitigation Strategy |
|------|---------------------|
| [Risk 1] | [How we address it] |
| [Risk 2] | [How we address it] |

**Our Commitment:**
[Service level, support, success guarantee]

---

## Slide 9: Investment Summary
**Total 3-Year Investment:** $[Amount]

**What's Included:**
- [Component 1]
- [Component 2]
- [Component 3]

**Flexible Options:**
- [Option A]: [Description]
- [Option B]: [Description]

---

## Slide 10: Next Steps
**Recommended Path Forward:**
1. [Action 1] - [Owner] - [Date]
2. [Action 2] - [Owner] - [Date]
3. [Decision Point] - [Date]

**Questions?**

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'competitive-battlecard.md',
    title: 'Competitive Battlecard',
    content: `# Competitive Battlecard Template

## Competitor Overview

**Company:** [Competitor Name]  
**Founded:** [Year]  
**Headquarters:** [Location]  
**Funding:** $[Amount]  
**Employees:** [Count]

**Target Market:**
- [Industry 1]
- [Industry 2]
- [Company size]

---

## Positioning & Messaging

### Their Value Proposition
[How they position themselves]

### Their Key Messages
- [Message 1]
- [Message 2]
- [Message 3]

### Our Counter-Positioning
[How we differentiate]

---

## Feature Comparison

| Capability | Us | Them | Advantage |
|------------|----|----|-----------|
| [Feature 1] | ✅ Advanced | ⚠️ Basic | [Why ours is better] |
| [Feature 2] | ✅ Included | ❌ Add-on | [Cost/value advantage] |
| [Feature 3] | ✅ Native | ⚠️ Integration | [Technical advantage] |

**Legend:**
- ✅ = Strong capability
- ⚠️ = Limited capability
- ❌ = Not available

---

## Strengths & Weaknesses

### Their Strengths
1. [Strength 1]
   - **Our Response:** [How we compete]
2. [Strength 2]
   - **Our Response:** [How we compete]

### Their Weaknesses
1. [Weakness 1]
   - **Our Advantage:** [How we capitalize]
2. [Weakness 2]
   - **Our Advantage:** [How we capitalize]

---

## Win/Loss Analysis

### Why We Win
- [Reason 1 with example]
- [Reason 2 with example]
- [Reason 3 with example]

### Why We Lose
- [Reason 1 and how to avoid]
- [Reason 2 and how to avoid]

---

## Pricing & Packaging

### Their Pricing Model
[Description of how they price]

**Typical Deal Size:** $[Range]

### Our Pricing Advantage
[How our pricing compares and why it's better value]

---

## Common Objections

### "They're cheaper"
**Response:** "Let's look at total cost of ownership. When you factor in [X, Y, Z], our solution actually costs less while delivering more value through [specific benefits]."

### "They have [Feature X]"
**Response:** "That's a good point. Here's how we approach that differently - and why customers prefer our approach: [explanation]."

### "They're the market leader"
**Response:** "They were early to market, which is why they have legacy architecture. We built our solution from the ground up with modern technology, which means [specific advantages]."

---

## Displacement Strategy

### Discovery Questions
- "How long have you been using [Competitor]?"
- "What's working well? What would you improve?"
- "Have you experienced [known pain point]?"
- "What's your renewal timeline?"

### Proof Points
- [Customer who switched]: [Results achieved]
- [Customer who switched]: [Results achieved]

### Migration Path
[How easy it is to switch from them to us]

---

## Sales Plays

### When to Compete Aggressively
- [Scenario 1]
- [Scenario 2]

### When to Walk Away
- [Scenario 1]
- [Scenario 2]

### Trap-Setting Questions
- [Question that exposes their weakness]
- [Question that highlights our strength]

---

## Resources

**Case Studies:**
- [Customer A] switched from [Competitor] to us
- [Customer B] chose us over [Competitor]

**Comparison Assets:**
- [Link to comparison sheet]
- [Link to ROI calculator]

**Win Stories:**
- [Recent win with details]

---

**Last Updated:** [Date]  
**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'qbr-expansion-playbook.md',
    title: 'QBR Expansion Playbook',
    content: `# QBR Expansion Playbook

## Pre-QBR Preparation

### Data Gathering (2 weeks before)
- [ ] Pull usage analytics
- [ ] Review support tickets
- [ ] Analyze feature adoption
- [ ] Calculate realized ROI
- [ ] Identify expansion signals

### Stakeholder Interviews (1 week before)
- [ ] Executive sponsor check-in
- [ ] Power user feedback
- [ ] Department head insights
- [ ] IT/Admin perspective

### QBR Deck Creation
- [ ] Value delivered summary
- [ ] Success metrics dashboard
- [ ] Expansion opportunities
- [ ] Product roadmap preview
- [ ] Action plan

---

## QBR Meeting Structure (60 minutes)

### Part 1: Relationship & Context (10 min)
**Objective:** Reconnect and understand current business priorities

**Questions:**
- "What's changed in your business since we last met?"
- "What are your top priorities for the next quarter?"
- "How has your team evolved?"

### Part 2: Value Delivered (20 min)
**Objective:** Quantify and celebrate success

**Present:**
- Adoption metrics (usage trends)
- Efficiency gains (time/cost saved)
- Business impact (revenue/retention)
- Success stories from their team

**Quantify ROI:**
"Based on our analysis, you've realized $[X] in value over the past [period], representing a [Y]% ROI on your investment."

### Part 3: Expansion Opportunities (20 min)
**Objective:** Identify and propose growth paths

**Framework:**
1. **Current State:** "You're using [X] for [use case]"
2. **Opportunity:** "We see potential to expand to [Y]"
3. **Value:** "Which could deliver [Z] additional benefit"
4. **Proof:** "Similar customers have achieved [results]"

**Expansion Vectors:**
- Additional users/seats
- New departments
- Advanced features
- Adjacent use cases
- Integration opportunities

### Part 4: Roadmap & Innovation (5 min)
**Objective:** Build excitement for what's coming

**Share:**
- Upcoming features relevant to them
- Beta program opportunities
- Industry trends and our response

### Part 5: Action Plan & Next Steps (5 min)
**Objective:** Commit to mutual actions

**Document:**
- [ ] Action item 1 - [Owner] - [Date]
- [ ] Action item 2 - [Owner] - [Date]
- [ ] Next QBR date
- [ ] Interim check-in schedule

---

## Expansion Opportunity Assessment

### Qualification Criteria
| Criteria | Yes/No | Notes |
|----------|--------|-------|
| Strong product adoption | | |
| Positive sentiment | | |
| Budget availability | | |
| Executive sponsorship | | |
| Clear use case | | |
| Measurable value | | |

**Expansion Readiness Score:** ___/6

---

## Expansion Conversation Scripts

### Script 1: Seat Expansion
"I noticed your team has grown from [X] to [Y] people. Several of the new team members could benefit from [solution]. Based on what [existing users] have achieved, adding [Z] seats could help you [specific outcome]. Would it make sense to discuss expanding access?"

### Script 2: Use Case Expansion
"You're getting great results with [current use case]. I've seen similar customers expand to [new use case] and achieve [additional value]. For example, [Customer Name] added [capability] and saw [result]. Is this something that could help you?"

### Script 3: Feature Upsell
"You're currently on our [tier] plan. I noticed you've been [behavior that indicates need for advanced features]. Customers who upgrade to [higher tier] typically see [benefit]. The incremental investment of $[X] typically pays for itself through [value driver]. Want to explore this?"

---

## Post-QBR Follow-Up

### Within 24 Hours
- [ ] Send meeting summary email
- [ ] Share QBR deck
- [ ] Confirm action items
- [ ] Schedule next touchpoint

### Within 1 Week
- [ ] Create expansion proposal (if applicable)
- [ ] Coordinate with internal teams
- [ ] Begin action item execution

### Ongoing
- [ ] Track action item completion
- [ ] Monitor adoption metrics
- [ ] Maintain executive relationship
- [ ] Document lessons learned

---

## Success Metrics

### QBR Effectiveness
- Executive attendance rate
- NPS score trend
- Expansion opportunity identification rate
- Conversion rate on expansion opps

### Expansion Performance
- Upsell/cross-sell revenue
- Seat growth rate
- Feature adoption increase
- Time to expansion close

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'ai-prompt-library.md',
    title: 'AI Prompt Library',
    content: `# AI Prompt Library for Value Professionals

## Discovery & Research Prompts

### Industry Research
\`\`\`
"Analyze the top 5 challenges facing [Industry] companies in 2024. For each challenge, provide:
1. Root causes
2. Typical financial impact
3. Common solutions being explored
4. Key metrics used to measure success"
\`\`\`

### Competitive Intelligence
\`\`\`
"Compare [Our Solution] with [Competitor] across these dimensions:
- Core capabilities
- Pricing model
- Target market
- Key differentiators
- Customer sentiment

Provide a SWOT analysis and recommend positioning strategy."
\`\`\`

### Customer Research
\`\`\`
"I'm preparing for a discovery call with a [Role] at a [Company Size] [Industry] company. Generate:
1. 10 value-focused discovery questions
2. Likely pain points they're experiencing
3. Key metrics they care about
4. Potential objections and how to address them"
\`\`\`

---

## Value Quantification Prompts

### KPI Identification
\`\`\`
"A [Industry] company with [X] employees is struggling with [Problem]. Identify:
1. 5 relevant KPIs to measure
2. Typical baseline values for each
3. Realistic improvement targets
4. Data sources to validate these metrics
5. How to calculate financial impact"
\`\`\`

### ROI Calculation
\`\`\`
"Build a 3-year ROI model for a [Solution Type] implementation at a [Company Size] [Industry] company. Include:
- Implementation costs (one-time and recurring)
- Expected benefits by category (cost reduction, revenue growth, productivity)
- Monthly cash flow projection
- Payback period calculation
- Sensitivity analysis on key assumptions"
\`\`\`

### Business Case Development
\`\`\`
"Create an executive-level business case for [Solution] addressing [Problem] at [Company]. Structure it with:
1. Executive summary (2 paragraphs)
2. Current state analysis with quantified pain
3. Proposed solution overview
4. Financial analysis (3-year projection)
5. Implementation roadmap
6. Risk mitigation plan
7. Success metrics"
\`\`\`

---

## Content Creation Prompts

### Value Messaging
\`\`\`
"Develop value messaging for [Solution] targeting [Persona] in [Industry]. Create:
1. Strategic value message (C-suite level)
2. Operational value message (VP/Director level)
3. Functional value message (Manager/User level)
4. Three supporting proof points for each
5. Competitive differentiation statement"
\`\`\`

### Case Study Writing
\`\`\`
"Write a customer success story for [Company] using this information: [paste details]. Follow this structure:
- Compelling headline
- Customer background (2 sentences)
- Challenge (quantified pain points)
- Solution (how we helped)
- Results (specific metrics and outcomes)
- Customer quote
- Call-to-action"
\`\`\`

### Email Sequences
\`\`\`
"Create a 5-email nurture sequence for prospects who attended our [Event/Webinar]. Each email should:
- Be 150-200 words
- Focus on a specific value theme
- Include a relevant resource or proof point
- Have a clear call-to-action
- Build on the previous email"
\`\`\`

---

## Presentation & Proposal Prompts

### Executive Presentation
\`\`\`
"Create an executive presentation outline for [Solution] pitched to [Company]. Include:
- Slide-by-slide structure (10 slides max)
- Key message for each slide
- Supporting data/visuals needed
- Anticipated questions and answers
- Recommended flow and timing"
\`\`\`

### Proposal Sections
\`\`\`
"Write the [Section Name] section of a proposal for [Company]. Context: [provide details]. Make it:
- Executive-friendly (clear and concise)
- Quantified (specific numbers and metrics)
- Customer-focused (their language and priorities)
- Action-oriented (clear next steps)"
\`\`\`

---

## Objection Handling Prompts

### Objection Response
\`\`\`
"A prospect said: '[Specific Objection]'. Generate a response using the LAER framework:
- Listen: Acknowledge their concern
- Acknowledge: Show empathy
- Explore: Questions to uncover root issue
- Respond: Address with evidence and alternatives

Include relevant proof points and customer examples."
\`\`\`

### Competitive Displacement
\`\`\`
"A prospect is currently using [Competitor]. Create a displacement strategy including:
1. Discovery questions to expose their pain
2. Trap-setting questions that highlight our advantages
3. Proof points of customers who switched
4. Risk-reversal offer to reduce switching friction
5. Migration path overview"
\`\`\`

---

## Customer Success Prompts

### QBR Preparation
\`\`\`
"Prepare a Quarterly Business Review for [Customer]. Based on this data: [usage stats, support tickets, feedback], create:
1. Value delivered summary (quantified)
2. Adoption analysis with recommendations
3. 3 expansion opportunities with business cases
4. Roadmap preview (features relevant to them)
5. Action plan for next quarter"
\`\`\`

### Health Score Analysis
\`\`\`
"Analyze this customer health data: [provide metrics]. Assess:
1. Overall health score (0-100)
2. Risk factors and early warning signs
3. Expansion opportunities and signals
4. Recommended actions by priority
5. Talking points for next executive check-in"
\`\`\`

---

## Analysis & Strategy Prompts

### Market Sizing
\`\`\`
"Estimate the total addressable market (TAM) for [Solution] in [Geography]. Use bottom-up approach:
1. Define target customer profile
2. Estimate number of potential customers
3. Calculate average deal size
4. Determine realistic market penetration
5. Project 3-year market growth"
\`\`\`

### Win/Loss Analysis
\`\`\`
"Analyze these win/loss interview notes: [paste data]. Identify:
1. Top 3 reasons we win
2. Top 3 reasons we lose
3. Patterns by industry, deal size, competitor
4. Actionable recommendations to improve win rate
5. Messaging/positioning adjustments needed"
\`\`\`

---

## Tips for Effective Prompting

### Be Specific
❌ "Help me with value selling"
✅ "Create a value discovery framework for selling marketing automation to mid-market B2B SaaS companies"

### Provide Context
Include:
- Industry and company size
- Specific role/persona
- Current situation/problem
- Desired outcome
- Any constraints

### Iterate and Refine
- Start broad, then narrow
- Ask follow-up questions
- Request alternatives
- Challenge assumptions

### Use Examples
"Generate [X] similar to this example: [paste example]"

---

**VOS Education Hub** | Value Operating System Framework
`
  }
];

resources.forEach(resource => {
  const filePath = join(resourcesDir, resource.filename);
  writeFileSync(filePath, resource.content, 'utf-8');
  console.log(`✓ Generated: ${resource.filename}`);
});

console.log(`\n✅ Successfully generated ${resources.length} additional resource files`);
console.log(`📁 Total resources in ${resourcesDir}: 12 files`);
