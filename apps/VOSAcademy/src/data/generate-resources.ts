import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Create resources directory in public folder
const resourcesDir = join(process.cwd(), 'client', 'public', 'resources');
try {
  mkdirSync(resourcesDir, { recursive: true });
} catch (e) {
  // Directory already exists
}

// Generate resource files
const resources = [
  {
    filename: 'value-stream-mapping-template.md',
    title: 'Value Stream Mapping Template',
    content: `# Value Stream Mapping Template

## Overview
This template helps you visualize and analyze the flow of value through your organization, identifying opportunities for optimization and improvement.

## Instructions
1. **Identify the Value Stream**: Define the end-to-end process you want to map
2. **Map Current State**: Document how value flows today
3. **Identify Waste**: Highlight inefficiencies, delays, and bottlenecks
4. **Design Future State**: Envision the optimized value flow
5. **Create Action Plan**: Define steps to achieve the future state

## Value Stream Components

### Inputs
- Customer requirements
- Business objectives
- Available resources
- Current capabilities

### Process Steps
| Step | Activity | Time | Value-Add | Waste | Owner |
|------|----------|------|-----------|-------|-------|
| 1    |          |      | ☐ Yes ☐ No |       |       |
| 2    |          |      | ☐ Yes ☐ No |       |       |
| 3    |          |      | ☐ Yes ☐ No |       |       |

### Outputs
- Delivered value
- Customer outcomes
- Business results

## Metrics to Track
- **Cycle Time**: Total time from start to finish
- **Lead Time**: Time from request to delivery
- **Process Time**: Actual work time
- **Wait Time**: Delays between steps
- **Value-Add Ratio**: (Value-add time / Total time) × 100%

## Waste Categories (DOWNTIME)
- **D**efects: Errors requiring rework
- **O**verproduction: Creating more than needed
- **W**aiting: Idle time between steps
- **N**on-utilized talent: Underutilized skills
- **T**ransportation: Unnecessary movement
- **I**nventory: Excess work-in-progress
- **M**otion: Unnecessary movement of people
- **E**xtra processing: More work than required

## Action Plan

### Quick Wins (0-30 days)
1. 
2. 
3. 

### Short-term Improvements (1-3 months)
1. 
2. 
3. 

### Long-term Transformation (3-12 months)
1. 
2. 
3. 

## Success Metrics
- Baseline: [Current state measurement]
- Target: [Desired future state]
- Timeline: [Achievement date]
- Owner: [Responsible party]

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'discovery-question-framework.md',
    title: 'Discovery Question Framework',
    content: `# Discovery Question Framework

## Purpose
Guide effective value discovery conversations that uncover customer challenges, quantify impact, and identify opportunities for value creation.

## The SPICED Framework

### **S**ituation
Understand the customer's current state

**Questions:**
- "Walk me through your current process for [X]"
- "How are you handling [challenge] today?"
- "What tools/systems are you currently using?"
- "Who is involved in this process?"

### **P**ain
Identify specific challenges and their impact

**Questions:**
- "What's the biggest challenge you're facing with [X]?"
- "How is this impacting your team's productivity?"
- "What happens when [problem] occurs?"
- "How often does this issue come up?"
- "What's the cost of this problem?" (time, money, opportunity)

### **I**mpact
Quantify the business consequences

**Questions:**
- "How much time does your team spend on [manual process]?"
- "What's the financial impact of [issue]?"
- "How does this affect your ability to [strategic goal]?"
- "What would happen if this problem persists for another year?"
- "How is this impacting customer satisfaction/retention?"

### **C**ritical Event
Understand urgency and timeline

**Questions:**
- "What's driving the need to address this now?"
- "Are there any upcoming deadlines or events?"
- "What happens if you don't solve this by [date]?"
- "Who else is affected by this timeline?"

### **E**xpected Outcomes
Define success criteria

**Questions:**
- "What would success look like 6 months from now?"
- "How will you measure improvement?"
- "What specific metrics do you want to move?"
- "What would make this project a home run?"

### **D**ecision Process
Navigate the buying journey

**Questions:**
- "Who else needs to be involved in this decision?"
- "What's your typical evaluation process?"
- "What criteria will you use to make a decision?"
- "What could prevent this from moving forward?"
- "When do you need to have a solution in place?"

## Value-Focused Questions by Role

### For CFO/Finance
- "What's your current cost structure for [X]?"
- "How do you measure ROI on technology investments?"
- "What's your budget cycle and approval process?"
- "What financial metrics are you focused on this year?"

### For CIO/IT
- "What's your technology roadmap for the next 12-18 months?"
- "How do you prioritize IT initiatives?"
- "What integration requirements do you have?"
- "What are your security and compliance considerations?"

### For COO/Operations
- "What operational KPIs are you tracking?"
- "Where are the biggest bottlenecks in your processes?"
- "How do you measure team productivity?"
- "What's your capacity for change management?"

### For VP Sales/Revenue
- "What's your current sales cycle length?"
- "How are you tracking pipeline velocity?"
- "What's your win rate on qualified opportunities?"
- "What's preventing your team from hitting quota?"

## Discovery Meeting Structure

### Opening (5 minutes)
- Set agenda and expectations
- Confirm time allocation
- Establish rapport

### Situation Assessment (10 minutes)
- Understand current state
- Map existing processes
- Identify stakeholders

### Pain & Impact Exploration (15 minutes)
- Dig into challenges
- Quantify business impact
- Uncover root causes

### Vision & Outcomes (10 minutes)
- Define desired future state
- Establish success metrics
- Align on priorities

### Next Steps (5 minutes)
- Summarize key findings
- Agree on action items
- Schedule follow-up

## Red Flags to Watch For
- ☐ Vague or unquantified pain points
- ☐ No clear decision-maker identified
- ☐ Unrealistic timelines
- ☐ Budget not discussed
- ☐ No compelling event
- ☐ Misalignment between stakeholders

## Post-Discovery Checklist
- ☐ Document all quantified impacts
- ☐ Identify gaps in information
- ☐ Map decision-making process
- ☐ Calculate potential ROI
- ☐ Prepare value hypothesis
- ☐ Schedule follow-up meeting

---

**VOS Education Hub** | Value Operating System Framework
`
  },
  {
    filename: 'business-case-template.md',
    title: 'Business Case Template',
    content: `# Business Case Template

## Executive Summary
[2-3 paragraph overview of the opportunity, solution, and expected value]

**Recommendation:** [Clear statement of what you're proposing]

**Expected ROI:** [X]% over [Y] years

**Payback Period:** [Z] months

**Net Present Value:** $[Amount]

---

## 1. Business Challenge

### Current State
[Describe the problem or opportunity]

### Impact
- **Financial Impact:** $[Amount] per year
- **Operational Impact:** [Quantified inefficiency]
- **Strategic Impact:** [Effect on business objectives]

### Consequences of Inaction
[What happens if this problem isn't solved]

---

## 2. Proposed Solution

### Overview
[High-level description of the solution]

### Key Capabilities
1. [Capability 1]
2. [Capability 2]
3. [Capability 3]

### How It Addresses the Challenge
[Connect solution features to business problems]

---

## 3. Financial Analysis

### Investment Required

| Category | Year 1 | Year 2 | Year 3 | Total |
|----------|--------|--------|--------|-------|
| Software/Licenses | $X | $Y | $Z | $Total |
| Implementation | $X | $Y | $Z | $Total |
| Training | $X | $Y | $Z | $Total |
| Internal Resources | $X | $Y | $Z | $Total |
| **Total Investment** | **$X** | **$Y** | **$Z** | **$Total** |

### Expected Benefits

| Benefit Category | Year 1 | Year 2 | Year 3 | Total |
|------------------|--------|--------|--------|-------|
| Cost Reduction | $X | $Y | $Z | $Total |
| Revenue Growth | $X | $Y | $Z | $Total |
| Productivity Gains | $X | $Y | $Z | $Total |
| Risk Mitigation | $X | $Y | $Z | $Total |
| **Total Benefits** | **$X** | **$Y** | **$Z** | **$Total** |

### ROI Calculation

| Metric | Value |
|--------|-------|
| Total Investment (3 years) | $X |
| Total Benefits (3 years) | $Y |
| Net Value | $Z |
| ROI | X% |
| Payback Period | X months |
| NPV (10% discount rate) | $X |

---

## 4. Key Assumptions

### Financial Assumptions
1. [Assumption with justification]
2. [Assumption with justification]
3. [Assumption with justification]

### Operational Assumptions
1. [Assumption with justification]
2. [Assumption with justification]

### Timeline Assumptions
1. [Assumption with justification]

---

## 5. Implementation Plan

### Phase 1: Planning & Design (Months 1-2)
- [Key activities]
- **Milestone:** [Deliverable]

### Phase 2: Implementation (Months 3-6)
- [Key activities]
- **Milestone:** [Deliverable]

### Phase 3: Rollout & Adoption (Months 7-9)
- [Key activities]
- **Milestone:** [Deliverable]

### Phase 4: Optimization (Months 10-12)
- [Key activities]
- **Milestone:** [Deliverable]

---

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| [Risk 1] | High/Med/Low | High/Med/Low | [Strategy] |
| [Risk 2] | High/Med/Low | High/Med/Low | [Strategy] |
| [Risk 3] | High/Med/Low | High/Med/Low | [Strategy] |

---

## 7. Success Metrics

### Leading Indicators (Track Monthly)
- [Metric 1]: Baseline [X] → Target [Y]
- [Metric 2]: Baseline [X] → Target [Y]

### Lagging Indicators (Track Quarterly)
- [Metric 1]: Baseline [X] → Target [Y]
- [Metric 2]: Baseline [X] → Target [Y]

### Value Realization Milestones
- **Month 3:** [Expected outcome]
- **Month 6:** [Expected outcome]
- **Month 12:** [Expected outcome]

---

## 8. Stakeholder Analysis

| Stakeholder | Role | Interest | Influence | Engagement Strategy |
|-------------|------|----------|-----------|---------------------|
| [Name/Title] | Sponsor | High | High | [Strategy] |
| [Name/Title] | Champion | High | Medium | [Strategy] |
| [Name/Title] | User | Medium | Low | [Strategy] |

---

## 9. Alternatives Considered

### Option A: [Alternative 1]
- **Pros:** [List]
- **Cons:** [List]
- **Cost:** $X
- **Why not selected:** [Reason]

### Option B: [Alternative 2]
- **Pros:** [List]
- **Cons:** [List]
- **Cost:** $X
- **Why not selected:** [Reason]

### Option C: Do Nothing
- **Cost:** $X (cost of inaction)
- **Risk:** [Consequences]

---

## 10. Recommendation & Next Steps

### Recommendation
[Clear, actionable recommendation]

### Immediate Next Steps
1. [Action item with owner and date]
2. [Action item with owner and date]
3. [Action item with owner and date]

### Decision Required By
[Date and decision-maker]

---

**Prepared by:** [Name]  
**Date:** [Date]  
**VOS Education Hub** | Value Operating System Framework
`
  }
];

// Generate markdown files
resources.forEach(resource => {
  const filePath = join(resourcesDir, resource.filename);
  writeFileSync(filePath, resource.content, 'utf-8');
  console.log(`✓ Generated: ${resource.filename}`);
});

console.log(`\n✅ Successfully generated ${resources.length} resource files in ${resourcesDir}`);
