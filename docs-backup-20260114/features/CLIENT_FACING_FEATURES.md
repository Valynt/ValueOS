# Client-Facing Functionality for ValueOS

**Date:** 2026-01-06  
**Status:** Strategic Planning Document

---

## Executive Summary

ValueOS is currently an **internal-only sales enablement platform**. This document outlines how to transform it into a **collaborative value realization platform** that engages prospects and customers directly.

**Current State:**

- ✅ Sales reps generate business cases internally
- ✅ Export to PDF/PowerPoint for prospects
- ✅ One-way communication (sales → buyer)
- ❌ No customer login or interaction
- ❌ No post-sale value tracking visibility

**Future State:**

- ✅ Prospects co-create business cases with sales
- ✅ Customers track ROI realization in real-time
- ✅ Two-way collaboration throughout lifecycle
- ✅ Self-service tools for lead generation
- ✅ Executive dashboards for C-suite visibility

---

## 🎯 Priority 1: Value Realization Portal

### Overview

**Customer-facing dashboard where buyers track promised ROI vs. actual results in real-time.**

### Why This Matters

- **Reduces Churn:** Customers see value continuously, not just at renewal
- **Enables Expansion:** Data-driven upsell conversations based on realized value
- **Differentiates:** Most vendors don't provide transparent value tracking
- **Builds Trust:** Shows confidence in your product's impact

### User Experience

#### Customer Login

```
https://app.valueos.com/customer/acme-corp
↓
Secure token-based access (no password required initially)
↓
Personalized dashboard showing their value metrics
```

#### Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│ Acme Corp - Value Realization Dashboard            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 Total Value Delivered: $2.4M (vs $2.0M target) │
│  ✅ 120% of promised ROI achieved                   │
│  📈 Trending 15% above projections                  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Key Metrics (Last 90 Days)                        │
│  ┌──────────────┬──────────┬──────────┬──────────┐ │
│  │ Metric       │ Target   │ Actual   │ Status   │ │
│  ├──────────────┼──────────┼──────────┼──────────┤ │
│  │ Cost Savings │ $500K    │ $620K    │ ✅ +24%  │ │
│  │ Time Saved   │ 2000 hrs │ 1850 hrs │ ⚠️  -8%  │ │
│  │ Revenue Lift │ $1.5M    │ $1.8M    │ ✅ +20%  │ │
│  └──────────────┴──────────┴──────────┴──────────┘ │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📈 Trend Analysis                                  │
│  [Interactive chart showing actual vs. target]     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🏆 Benchmark Comparison                            │
│  You're in the 78th percentile for efficiency      │
│  [Chart comparing to industry peers]               │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📄 Download QBR Report (PDF)                       │
│  📊 Export Data (Excel)                             │
│  📧 Share with Stakeholders                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Technical Implementation

#### Database Schema (Already Exists!)

```sql
-- Realization tracking
realization_metrics (
  id, value_case_id, metric_name, metric_type,
  predicted_value, predicted_date,
  actual_value, actual_date,
  variance, variance_pct, status
)

-- Telemetry events
telemetry_events (
  id, value_case_id, event_type, event_data,
  timestamp, source
)
```

#### New Components Needed

```typescript
// src/views/Customer/RealizationPortal.tsx
export function RealizationPortal() {
  const { valueCaseId } = useParams();
  const { metrics, loading } = useRealizationMetrics(valueCaseId);

  return (
    <CustomerLayout>
      <ValueSummaryCard metrics={metrics} />
      <MetricsTable metrics={metrics} />
      <TrendChart metrics={metrics} />
      <BenchmarkComparison metrics={metrics} />
      <ExportActions valueCaseId={valueCaseId} />
    </CustomerLayout>
  );
}
```

#### Access Control

```typescript
// src/services/CustomerAccessService.ts
export class CustomerAccessService {
  // Generate secure token for customer access
  async generateCustomerToken(valueCaseId: string): Promise<string> {
    const token = await supabase.rpc("generate_customer_token", {
      value_case_id: valueCaseId,
      expires_in: "90 days",
    });
    return token;
  }

  // Validate customer token
  async validateCustomerToken(token: string): Promise<ValueCase> {
    const { data, error } = await supabase
      .from("customer_access_tokens")
      .select("value_case_id, expires_at")
      .eq("token", token)
      .single();

    if (error || !data || new Date(data.expires_at) < new Date()) {
      throw new Error("Invalid or expired token");
    }

    return this.getValueCase(data.value_case_id);
  }
}
```

#### Migration Needed

```sql
-- supabase/migrations/20260106_customer_portal.sql
CREATE TABLE customer_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0
);

CREATE INDEX idx_customer_tokens_token ON customer_access_tokens(token);
CREATE INDEX idx_customer_tokens_expires ON customer_access_tokens(expires_at);

-- RLS policy for customer access
ALTER TABLE realization_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_read_realization ON realization_metrics
  FOR SELECT
  USING (
    value_case_id IN (
      SELECT value_case_id
      FROM customer_access_tokens
      WHERE token = current_setting('app.customer_token', true)
      AND expires_at > NOW()
    )
  );
```

### Rollout Plan

**Week 1-2: Backend**

- Create customer access token system
- Implement RLS policies for customer data access
- Build API endpoints for customer portal

**Week 3-4: Frontend**

- Build RealizationPortal component
- Create customer-specific layout (no internal nav)
- Implement read-only metric displays

**Week 5-6: Beta Launch**

- Test with 5-10 friendly customers
- Gather feedback on UX
- Iterate on design

### Success Metrics

- **Adoption:** 80% of customers access portal monthly
- **Engagement:** Average 5+ logins per customer per quarter
- **Churn Reduction:** 15-20% decrease in churn rate
- **Expansion:** 25-30% increase in expansion revenue

---

## 🤝 Priority 2: Collaborative Business Case Builder

### Overview

**Allow prospects to co-create business cases with sales reps in real-time.**

### Why This Matters

- **Increases Win Rate:** Co-creation builds commitment
- **Reduces Sales Cycle:** Fewer back-and-forth iterations
- **Larger Deals:** More stakeholders involved = bigger scope
- **Better Assumptions:** Buyer provides accurate baseline data

### User Experience

#### Invitation Flow

```
Sales Rep creates business case
↓
Clicks "Share with Prospect"
↓
Enters prospect email(s)
↓
Prospect receives email with magic link
↓
Prospect clicks link → lands in collaborative canvas
↓
Both parties can edit assumptions in real-time
```

#### Collaborative Canvas

```
┌─────────────────────────────────────────────────────┐
│ Acme Corp Business Case (DRAFT)                     │
│ 👤 John (Sales) & 👤 Sarah (CFO) are editing        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Pain Point #1: Manual Data Entry                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ Current State:                              │   │
│  │ Hours per week: [50] ← Sarah is editing... │   │
│  │ Cost per hour: [$75]                        │   │
│  │ Annual cost: $195,000                       │   │
│  │                                             │   │
│  │ 💬 Sarah: "Actually closer to 60 hours"    │   │
│  │ 💬 John: "Updated! New total: $234K"       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Add Pain Point] [Add Comment] [Request Review]   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  💰 Projected ROI: $1.2M → $1.4M (updated)          │
│  📊 Payback Period: 8 months                        │
│  ✅ Confidence: 85% (High)                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Technical Implementation

#### Real-Time Collaboration

```typescript
// src/hooks/useCollaborativeCanvas.ts
export function useCollaborativeCanvas(valueCaseId: string) {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  useEffect(() => {
    // Subscribe to real-time changes
    const channel = supabase
      .channel(`canvas:${valueCaseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "value_cases",
          filter: `id=eq.${valueCaseId}`,
        },
        (payload) => {
          setCanvas(payload.new as Canvas);
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setActiveUsers(Object.values(state).flat());
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [valueCaseId]);

  const updateAssumption = async (path: string, value: any) => {
    // Optimistic update
    setCanvas((prev) => updateNestedValue(prev, path, value));

    // Persist to database
    await supabase
      .from("value_cases")
      .update({ assumptions: canvas.assumptions })
      .eq("id", valueCaseId);
  };

  return { canvas, activeUsers, updateAssumption };
}
```

#### Comment System

```typescript
// src/components/Deals/CommentThread.tsx
export function CommentThread({
  valueCaseId,
  contextPath
}: CommentThreadProps) {
  const { comments, addComment } = useComments(valueCaseId, contextPath);

  return (
    <div className="comment-thread">
      {comments.map(comment => (
        <Comment key={comment.id} comment={comment} />
      ))}
      <CommentInput onSubmit={addComment} />
    </div>
  );
}
```

#### Database Schema

```sql
-- Comments on business case elements
CREATE TABLE business_case_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  context_path TEXT NOT NULL, -- e.g., "pain_points.0.current_state"
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track who's currently viewing/editing
CREATE TABLE canvas_presence (
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (value_case_id, user_id)
);
```

### Rollout Plan

**Week 1-3: Real-Time Infrastructure**

- Implement WebSocket-based collaboration
- Build presence system (who's online)
- Create conflict resolution logic

**Week 4-6: UI Components**

- Build collaborative canvas interface
- Implement comment threads
- Add version history

**Week 7-8: Beta Testing**

- Test with 10 sales reps
- Gather feedback on collaboration UX
- Iterate on design

### Success Metrics

- **Adoption:** 60% of deals use collaborative mode
- **Win Rate:** 20-25% increase in win rate
- **Sales Cycle:** 30-40% reduction in time to close
- **Deal Size:** 15-20% larger average deal size

---

## 🧮 Priority 3: Self-Service ROI Calculator

### Overview

**Public-facing tool where prospects can generate preliminary business cases before talking to sales.**

### Why This Matters

- **Lead Generation:** 3-5x increase in qualified leads
- **Cost Efficiency:** 40-50% reduction in cost per lead
- **Market Education:** Demonstrates value methodology
- **Self-Qualification:** Prospects pre-qualify themselves

### User Experience

#### Public Landing Page

```
https://valueos.com/calculator
↓
"Calculate Your ROI in 2 Minutes"
↓
Industry selection (dropdown)
↓
Company size (employees/revenue)
↓
3-5 key questions about pain points
↓
Instant results with PDF download
↓
"Want a detailed analysis? Talk to our team"
```

#### Calculator Interface

```
┌─────────────────────────────────────────────────────┐
│ ValueOS ROI Calculator                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 1 of 5: Tell us about your company           │
│                                                     │
│  Industry: [Technology ▼]                           │
│  Company Size: [100-500 employees ▼]                │
│  Annual Revenue: [$10M-$50M ▼]                      │
│                                                     │
│  [Next →]                                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 2 of 5: Current challenges                   │
│                                                     │
│  How many hours per week does your team spend on   │
│  manual data entry?                                 │
│  [50] hours                                         │
│                                                     │
│  What's your average cost per hour?                │
│  [$75]                                              │
│                                                     │
│  [← Back] [Next →]                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Results Page

```
┌─────────────────────────────────────────────────────┐
│ Your Estimated ROI                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  💰 Potential Annual Savings: $1.2M                 │
│  📊 ROI: 450%                                        │
│  ⏱️  Payback Period: 6 months                       │
│                                                     │
│  ⚠️  Note: This is a preliminary estimate based on  │
│     industry averages. Actual results may vary.     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📄 Download Full Report (PDF)                      │
│  Enter your email: [________________]               │
│  [Download Report]                                  │
│                                                     │
│  📞 Want a detailed analysis?                       │
│  [Schedule a Call with Our Team]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Technical Implementation

#### Public Route (No Auth)

```typescript
// src/views/Public/ROICalculator.tsx
export function ROICalculator() {
  const [step, setStep] = useState(1);
  const [inputs, setInputs] = useState<CalculatorInputs>({});
  const [results, setResults] = useState<CalculatorResults | null>(null);

  const handleSubmit = async () => {
    // Use simplified version of OpportunityAgent
    const results = await calculateROI(inputs);
    setResults(results);

    // Track anonymous session
    await trackCalculatorSession({
      inputs,
      results,
      sessionId: generateSessionId()
    });
  };

  return (
    <PublicLayout>
      {step <= 5 ? (
        <CalculatorWizard
          step={step}
          inputs={inputs}
          onNext={(data) => {
            setInputs({ ...inputs, ...data });
            setStep(step + 1);
          }}
        />
      ) : (
        <CalculatorResults
          results={results}
          onDownload={handleDownload}
        />
      )}
    </PublicLayout>
  );
}
```

#### Simplified Agent Logic

```typescript
// src/services/PublicCalculatorService.ts
export class PublicCalculatorService {
  async calculateROI(inputs: CalculatorInputs): Promise<CalculatorResults> {
    // Use industry templates instead of full agent orchestration
    const template = this.getIndustryTemplate(inputs.industry);

    // Apply user inputs to template
    const assumptions = this.applyInputsToTemplate(template, inputs);

    // Calculate basic financial metrics
    const financials = this.calculateFinancials(assumptions);

    // Get benchmark data
    const benchmarks = await this.getBenchmarks(
      inputs.industry,
      inputs.companySize,
    );

    return {
      annualSavings: financials.savings,
      roi: financials.roi,
      paybackMonths: financials.paybackMonths,
      benchmarks,
      confidence: "medium", // Always medium for public calculator
    };
  }
}
```

#### Lead Capture

```typescript
// src/services/LeadCaptureService.ts
export class LeadCaptureService {
  async captureCalculatorLead(data: {
    email: string;
    inputs: CalculatorInputs;
    results: CalculatorResults;
    sessionId: string;
  }): Promise<void> {
    // Store in database
    await supabase.from("calculator_leads").insert({
      email: data.email,
      inputs: data.inputs,
      results: data.results,
      session_id: data.sessionId,
      source: "roi_calculator",
    });

    // Send to CRM
    await this.syncToCRM(data);

    // Send email with PDF
    await this.sendCalculatorReport(data.email, data.results);

    // Notify sales team
    await this.notifySalesTeam(data);
  }
}
```

### Rollout Plan

**Week 1-2: Backend**

- Build simplified ROI calculation logic
- Create industry templates
- Implement lead capture system

**Week 3-4: Frontend**

- Build wizard interface
- Create results page
- Implement PDF generation

**Week 5-6: Launch**

- Deploy to public site
- Set up analytics tracking
- Monitor conversion rates

### Success Metrics

- **Traffic:** 1,000+ calculator sessions per month
- **Conversion:** 30-40% provide email for PDF
- **Lead Quality:** 20-25% of leads convert to opportunities
- **Cost per Lead:** 40-50% reduction vs. paid ads

---

## 📋 Implementation Roadmap

### Phase 1: Foundation (Weeks 1-6)

**Goal:** Launch MVP of Value Realization Portal

- [ ] Week 1-2: Backend infrastructure
  - [ ] Customer access token system
  - [ ] RLS policies for customer data
  - [ ] API endpoints for customer portal
- [ ] Week 3-4: Frontend development
  - [ ] RealizationPortal component
  - [ ] Customer-specific layout
  - [ ] Metric displays and charts
- [ ] Week 5-6: Beta launch
  - [ ] Test with 5-10 customers
  - [ ] Gather feedback
  - [ ] Iterate on UX

### Phase 2: Collaboration (Weeks 7-12)

**Goal:** Enable real-time collaboration on business cases

- [ ] Week 7-9: Real-time infrastructure
  - [ ] WebSocket-based collaboration
  - [ ] Presence system
  - [ ] Comment threads
- [ ] Week 10-12: UI and testing
  - [ ] Collaborative canvas interface
  - [ ] Version history
  - [ ] Beta testing with sales team

### Phase 3: Self-Service (Weeks 13-18)

**Goal:** Launch public ROI calculator

- [ ] Week 13-14: Calculator logic
  - [ ] Simplified ROI calculation
  - [ ] Industry templates
  - [ ] Lead capture system
- [ ] Week 15-16: Public interface
  - [ ] Wizard UI
  - [ ] Results page
  - [ ] PDF generation
- [ ] Week 17-18: Launch and optimize
  - [ ] Deploy to public site
  - [ ] Analytics tracking
  - [ ] Conversion optimization

---

## 🎨 Design Principles

### 1. Transparency First

- Show confidence scores on all predictions
- Cite data sources for all benchmarks
- Display calculation methodology
- Provide audit trails for all changes

### 2. Persona-Specific Views

- **CFO:** Financial metrics, ROI, payback period
- **CTO:** Technical efficiency, system performance
- **COO:** Operational metrics, process improvements
- **VP Sales:** Revenue impact, pipeline velocity
- **VP Marketing:** Lead generation, conversion rates
- **Business Unit Leader:** Department-specific KPIs

### 3. Mobile-First

- Executives need mobile access
- Responsive design for all screen sizes
- Touch-optimized interactions
- Offline capability for reports

### 4. Async-First

- Not everyone is online at the same time
- Comment threads for async discussion
- Email notifications for updates
- Version history for catching up

### 5. Security by Default

- Row-level security on all customer data
- Encrypted data at rest and in transit
- Audit logs for all access
- Token-based authentication
- Automatic token expiration

---

## 📊 Success Metrics

### Business Metrics

- **Churn Reduction:** 15-20% decrease
- **Expansion Revenue:** 25-30% increase
- **Win Rate:** 20-25% increase
- **Sales Cycle:** 30-40% reduction
- **Lead Generation:** 3-5x increase
- **Cost per Lead:** 40-50% reduction

### Product Metrics

- **Portal Adoption:** 80% of customers access monthly
- **Collaboration Adoption:** 60% of deals use collaborative mode
- **Calculator Conversion:** 30-40% provide email
- **Engagement:** 5+ logins per customer per quarter
- **NPS Score:** 50+ (promoters)

### Technical Metrics

- **Page Load Time:** <2 seconds
- **API Response Time:** <500ms
- **Uptime:** 99.9%
- **Error Rate:** <0.1%
- **Security Incidents:** 0

---

## 🚀 Quick Wins

### Week 1: Enable Sharing

Add "Share with Customer" button to existing business cases:

```typescript
// src/components/Deals/ShareButton.tsx
<Button onClick={() => generateCustomerLink(valueCaseId)}>
  Share with Customer
</Button>
```

### Week 2: Read-Only Customer View

Create simple read-only view of existing business case:

```typescript
// src/views/Customer/ReadOnlyBusinessCase.tsx
<BusinessCaseView
  valueCase={valueCase}
  readOnly={true}
  hideInternalNotes={true}
/>
```

### Week 3: Email Notifications

Send customers email when metrics update:

```typescript
// src/services/NotificationService.ts
await sendEmail({
  to: customer.email,
  subject: "Your ROI metrics have been updated",
  template: "metric-update",
  data: { metrics, valueCaseId },
});
```

---

## 💡 Future Enhancements

### Mobile Apps

- Native iOS/Android apps for executives
- Push notifications for metric updates
- Offline access to reports

### Advanced Analytics

- Predictive analytics for at-risk accounts
- AI-generated recommendations for optimization
- Anomaly detection for metric deviations

### Integrations

- Slack/Teams notifications
- Salesforce embedded components
- Zapier/Make.com connectors
- API for custom integrations

### Gamification

- Achievement badges for hitting targets
- Leaderboards for peer comparison
- Milestone celebrations
- Progress tracking

---

## 📚 Resources

### Documentation

- [Value Realization Agent](/.context/agents.md#realizationagent)
- [Database Schema](/.context/database.md)
- [Frontend Architecture](/.context/frontend.md)

### Examples

- [Gainsight Customer Success Platform](https://www.gainsight.com/)
- [ChurnZero Value Realization](https://churnzero.net/)
- [Totango Customer Success](https://www.totango.com/)

### Tools

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [React Query](https://tanstack.com/query/latest)
- [Recharts](https://recharts.org/)

---

**Next Steps:**

1. Review this document with product team
2. Prioritize features based on customer feedback
3. Create detailed technical specs for Phase 1
4. Begin development on Value Realization Portal

**Questions? Contact:** engineering@valueos.com
