# Prompt Engineering Guide for ValueCanvas

**Target Audience:** Business Users, Analysts, Product Managers  
**Reading Time:** 15 minutes  
**Last Updated:** December 5, 2025

---

## Introduction

ValueCanvas uses AI agents to understand your requests and generate interactive dashboards, charts, and insights. The quality of results depends heavily on **how you phrase your requests**. This guide teaches you how to communicate effectively with the AI to get the best outcomes.

### What You'll Learn
- How to structure effective prompts
- Common patterns that work well
- Anti-patterns to avoid
- Domain-specific prompt templates
- Troubleshooting misunderstood requests

---

## The CLEAR Framework

Use the **CLEAR** framework for structuring prompts:

- **C**ontext: What business problem are you solving?
- **L**imits: What time period, data range, or constraints?
- **E**xpectation: What output format do you want?
- **A**ction: What specific task should the AI perform?
- **R**efinement: How can you iterate on the results?

### Example: Before CLEAR
```
❌ "Show me some charts"
```
**Problem:** Too vague - no context, no timeframe, no specific ask.

### Example: After CLEAR
```
✅ "Create a revenue dashboard for Q4 2024 showing monthly trends, 
   top 3 revenue sources, and year-over-year growth. Use a vertical 
   split layout with KPI cards at the top."
```

**Why it works:**
- **Context:** Revenue analysis
- **Limits:** Q4 2024, monthly granularity
- **Expectation:** Dashboard with specific visuals
- **Action:** "Create", "showing", "use"
- **Refinement:** Specific layout requested

---

## Effective Prompt Patterns

### Pattern 1: Goal-Oriented Prompts
**Template:**
```
"Help me [goal] by [action] for [context]"
```

**Examples:**
```
✅ "Help me identify cost reduction opportunities by analyzing our 
   infrastructure spend for the last 6 months"

✅ "Help me understand customer churn by creating a cohort analysis 
   dashboard for 2024"

✅ "Help me forecast Q1 2025 revenue by extrapolating from the past 
   12 months of sales data"
```

---

### Pattern 2: Comparative Analysis
**Template:**
```
"Compare [metric A] vs [metric B] for [context] over [timeframe]"
```

**Examples:**
```
✅ "Compare actual revenue vs target revenue for each region over Q4 2024"

✅ "Compare customer acquisition cost between paid and organic channels 
   for the past year"

✅ "Compare our NPS scores vs industry benchmarks for enterprise customers"
```

---

### Pattern 3: Breakdown & Drill-Down
**Template:**
```
"Break down [metric] by [dimension1], [dimension2] for [timeframe]"
```

**Examples:**
```
✅ "Break down total ARR by customer segment, region, and contract size 
   for 2024"

✅ "Break down support tickets by priority, category, and resolution time 
   for the last quarter"

✅ "Break down marketing spend by channel, campaign type, and ROI for 
   the past 6 months"
```

---

### Pattern 4: Trend Analysis
**Template:**
```
"Show [metric] trends over [timeframe] and highlight [insights]"
```

**Examples:**
```
✅ "Show monthly active users (MAU) trends over the past year and highlight 
   any seasonal patterns or anomalies"

✅ "Show customer churn rate trends over Q3-Q4 2024 and highlight the 
   impact of our retention campaigns"

✅ "Show daily transaction volume trends for the past 90 days and highlight 
   any unusual spikes or drops"
```

---

### Pattern 5: What-If Scenarios
**Template:**
```
"Model what happens if [change] assuming [constraints]"
```

**Examples:**
```
✅ "Model what happens if we increase pricing by 15% assuming a 5% churn rate"

✅ "Model what happens if we reduce customer support headcount by 20% 
   assuming current ticket volume"

✅ "Model what happens if we expand to 3 new regions assuming 30% market 
   penetration in year 1"
```

---

## Domain-Specific Prompt Templates

### For Value Discovery (Opportunity Agent)
```
✅ "Analyze [customer/market segment] to discover value opportunities 
   related to [pain point or goal]"

Example:
"Analyze enterprise SaaS customers to discover value opportunities 
 related to reducing infrastructure costs and improving system reliability"
```

### For Target Setting (Target Agent)
```
✅ "Define target KPIs for [initiative] with baseline [current metric], 
   target [desired metric], and timeframe [duration]"

Example:
"Define target KPIs for our customer success program with baseline NPS 
 of 35, target NPS of 50, and timeframe of Q1-Q2 2025"
```

### For Realization Tracking (Realization Agent)
```
✅ "Track progress towards [goal] over [timeframe] and explain variances 
   from plan"

Example:
"Track progress towards reducing cloud spend by 20% over Q4 2024 and 
 explain variances from our savings plan"
```

### For Expansion Planning (Expansion Agent)
```
✅ "Identify expansion opportunities for [customer/account] based on 
   [current usage and goals]"

Example:
"Identify expansion opportunities for Acme Corp based on their current 
 usage of 50 seats and their goal to scale to 200 employees by EOY"
```

---

## Layout & Visualization Requests

### Requesting Specific Layouts
ValueCanvas supports multiple layout types. Be explicit about what you want:

**Vertical Split:**
```
✅ "Use a vertical split layout with KPIs on top and charts below"
```

**Horizontal Split:**
```
✅ "Use a horizontal split layout with filters on the left and dashboard 
   on the right"
```

**Grid Layout:**
```
✅ "Use a 2x2 grid layout with revenue, churn, NPS, and forecast in 
   separate panels"
```

**Dashboard Panel:**
```
✅ "Create a dashboard panel with 4 KPI cards showing revenue, users, 
   conversion rate, and ARR"
```

---

### Requesting Specific Visualizations

**Charts:**
```
✅ "Show as a line chart with monthly data points"
✅ "Show as a bar chart comparing regions"
✅ "Show as a pie chart breaking down categories"
✅ "Show as a scatter plot with trendline"
```

**KPI Cards:**
```
✅ "Display as KPI cards showing current value, change from last period, 
   and trend arrow"
```

**Tables:**
```
✅ "Show as a sortable table with columns: Name, Value, Change %, Status"
```

---

## Anti-Patterns: What NOT to Do

### ❌ Too Vague
```
❌ "Show me some data"
❌ "Make a chart"
❌ "Analyze this"
```
**Why it fails:** No context, no specific request, no constraints.

**Fix:** Add specifics using the CLEAR framework.

---

### ❌ Too Many Requests at Once
```
❌ "Show me revenue by region and churn by cohort and NPS by segment and 
   forecast next quarter and compare to last year and highlight anomalies 
   and export to PDF"
```
**Why it fails:** Overwhelming - the AI may miss important details.

**Fix:** Break into separate prompts:
```
✅ Prompt 1: "Show me revenue by region for Q4 2024"
✅ Prompt 2: "Now add churn rates by customer cohort"
✅ Prompt 3: "Compare these metrics to Q4 2023"
```

---

### ❌ Ambiguous Metrics
```
❌ "Show me performance"
```
**Why it fails:** "Performance" could mean anything (speed, revenue, uptime, etc.).

**Fix:** Be specific:
```
✅ "Show me application response time (p95) over the past 7 days"
```

---

### ❌ Missing Timeframes
```
❌ "Show me user growth"
```
**Why it fails:** Growth over what period? Daily? Monthly? All-time?

**Fix:** Always include time bounds:
```
✅ "Show me monthly user growth over the past 12 months"
```

---

### ❌ Conflicting Instructions
```
❌ "Show me detailed breakdown but keep it simple"
```
**Why it fails:** "Detailed" and "simple" contradict each other.

**Fix:** Choose one approach:
```
✅ "Show me a high-level summary with 3-5 key metrics"
OR
✅ "Show me a detailed breakdown by region, product, and time period"
```

---

## Iterative Refinement

The AI won't always get it perfect on the first try. Use iterative refinement:

### Step 1: Start with a Basic Request
```
✅ "Create a revenue dashboard for Q4 2024"
```

### Step 2: Review the Initial Output
- Are the visuals correct?
- Is the data accurate?
- Is the layout intuitive?

### Step 3: Refine with Follow-Up Prompts
```
✅ "Add a comparison to Q4 2023"
✅ "Change the line chart to a bar chart"
✅ "Move the KPI cards to the top"
✅ "Filter to show only enterprise customers"
```

### Step 4: Save & Iterate
- Use `Cmd+Z` to undo if needed
- Bookmark successful prompts for reuse
- Export final results

---

## Advanced Techniques

### Using Contextual References
Refer to previous results in follow-up prompts:

```
✅ "Based on the churn analysis above, identify the top 3 at-risk accounts"
✅ "Using the same timeframe, show me customer acquisition cost"
✅ "Zoom into the Q3 anomaly we saw in the previous chart"
```

---

### Conditional Logic
Ask the AI to highlight specific conditions:

```
✅ "Show me all regions where revenue growth is below 10%"
✅ "Highlight any accounts with NPS < 30 or churn risk > 50%"
✅ "Flag any infrastructure costs that increased by more than 20% month-over-month"
```

---

### Multi-Step Workflows
Chain multiple agent actions together:

```
✅ Step 1: "Run Opportunity Agent to find cost reduction opportunities"
✅ Step 2: "Promote the top 3 opportunities to Target Agent"
✅ Step 3: "Create a realization plan for the infrastructure optimization opportunity"
```

---

## Troubleshooting Misunderstood Requests

### "The AI gave me the wrong chart type"
**Fix:** Be explicit about visualization:
```
❌ "Show me revenue over time"
✅ "Show me revenue over time as a line chart with monthly data points"
```

---

### "The AI is missing data from my timeframe"
**Fix:** Check data availability first:
```
✅ "What data is available for Q4 2024?"
Then: "Show me [metric] for [confirmed available timeframe]"
```

---

### "The layout is confusing"
**Fix:** Request a specific layout structure:
```
✅ "Reorganize this as a vertical split with summary metrics at top 
   and detailed charts below"
```

---

### "The AI is using the wrong data source"
**Fix:** Explicitly name the data source:
```
✅ "Using data from [Salesforce/HubSpot/CSV upload], show me..."
```

---

### "Results are too slow to load"
**Fix:** Reduce scope or add sampling:
```
❌ "Analyze all customer interactions from the past 5 years"
✅ "Analyze a 10% sample of customer interactions from Q4 2024"
```

---

## Quick Reference Card

### The 5-Second Prompt Checklist
Before hitting send, verify your prompt includes:
- ✅ **What** (metric or insight)
- ✅ **When** (timeframe)
- ✅ **Why** (context or goal)
- ✅ **How** (visualization or layout)

### Common Keyboard Shortcuts
- `Cmd+K` / `Ctrl+K` - Open Command Bar (quick access to agents)
- `Cmd+Z` / `Ctrl+Z` - Undo last action
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` - Redo
- `Cmd+Enter` / `Ctrl+Enter` - Submit prompt
- `Esc` - Cancel current action

---

## Real-World Examples

### Example 1: Customer Success Dashboard
```
Prompt:
"Create a customer success dashboard for Q4 2024 showing:
1. Current NPS score with trend from Q3
2. Top 5 accounts by health score
3. Churn risk distribution across segments
4. Support ticket resolution time trends
Use a grid layout with KPI cards for summary metrics."

Result: 4-panel dashboard with NPS KPI card, account table, risk chart, 
and resolution time line chart.
```

---

### Example 2: Sales Forecast
```
Prompt:
"Forecast Q1 2025 revenue by extrapolating from Q3-Q4 2024 sales data.
Break down by region (Americas, EMEA, APAC) and product line (Enterprise, SMB).
Show confidence intervals and flag any regions with high volatility."

Result: Forecasting model with confidence bands, regional breakdown table, 
and volatility highlights.
```

---

### Example 3: Cost Optimization
```
Prompt:
"Analyze our AWS infrastructure costs for the past 6 months.
Identify services with >20% month-over-month growth.
Suggest 3 specific cost reduction opportunities with estimated savings.
Present as a vertical split with cost trends at top and recommendations below."

Result: Line chart showing cost trends + recommendation cards with 
ROI estimates.
```

---

## Next Steps

### Practice Prompts
Try these exercises to build your skills:

1. **Beginner:** "Show me monthly revenue for 2024"
2. **Intermediate:** "Compare Q4 2024 revenue vs Q4 2023 by product line, highlight top performers"
3. **Advanced:** "Model the impact of a 10% price increase on our SMB segment assuming 8% churn elasticity"

### Additional Resources
- [Agent Workflows Guide](./12-agent-workflows.md) - Learn how to use specific agents
- [Layout Management Guide](./09-layout-management.md) - Master canvas layouts
- [User Troubleshooting](./15-troubleshooting-user.md) - Fix common issues
- [FAQ](./16-faq-users.md) - Quick answers to common questions

---

## Feedback

Found a prompt pattern that works well? Have suggestions for this guide?  
📧 Contact: [support@valuecanvas.com](mailto:support@valuecanvas.com)  
💬 Community: [community.valuecanvas.com](https://community.valuecanvas.com)

---

**Document Version:** 1.0  
**Last Updated:** December 5, 2025  
**Next Review:** January 5, 2026
