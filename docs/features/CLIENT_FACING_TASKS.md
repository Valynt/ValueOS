# Client-Facing Features - Task Breakdown

**Date:** 2026-01-06  
**Status:** Ready for Development

---

## Phase 1: Value Realization Portal (Weeks 1-6)

### Week 1: Backend Foundation

#### Task 1.1: Customer Access Token System

- [ ] Create `customer_access_tokens` table migration
- [ ] Add RLS policies for token-based access
- [ ] Implement `generateCustomerToken()` function
- [ ] Implement `validateCustomerToken()` function
- [ ] Add token expiration logic (90 days default)
- [ ] Write unit tests for token generation/validation

**Files:**

- `supabase/migrations/20260106_customer_access_tokens.sql`
- `src/services/CustomerAccessService.ts`
- `src/services/__tests__/CustomerAccessService.test.ts`

**Estimate:** 2 days

---

#### Task 1.2: Customer Data Access Policies

- [ ] Add RLS policy for `realization_metrics` table
- [ ] Add RLS policy for `value_cases` table (read-only)
- [ ] Add RLS policy for `value_drivers` table
- [ ] Add RLS policy for `financial_models` table
- [ ] Test policies with customer token
- [ ] Document security model

**Files:**

- `supabase/migrations/20260106_customer_rls_policies.sql`
- `docs/security/customer-access-model.md`

**Estimate:** 2 days

---

#### Task 1.3: Customer Portal API Endpoints

- [ ] Create `GET /api/customer/metrics/:token` endpoint
- [ ] Create `GET /api/customer/value-case/:token` endpoint
- [ ] Create `GET /api/customer/benchmarks/:token` endpoint
- [ ] Add rate limiting for customer endpoints
- [ ] Add error handling and logging
- [ ] Write API tests

**Files:**

- `src/api/customer/metrics.ts`
- `src/api/customer/value-case.ts`
- `src/api/customer/benchmarks.ts`
- `src/api/__tests__/customer-api.test.ts`

**Estimate:** 3 days

---

### Week 2: Frontend Components

#### Task 2.1: Customer Layout Component

- [ ] Create `CustomerLayout.tsx` component
- [ ] Design customer-specific header (no internal nav)
- [ ] Add company branding area
- [ ] Implement responsive design
- [ ] Add loading states
- [ ] Write component tests

**Files:**

- `src/components/Customer/CustomerLayout.tsx`
- `src/components/Customer/__tests__/CustomerLayout.test.tsx`

**Estimate:** 2 days

---

#### Task 2.2: Value Summary Card

- [ ] Create `ValueSummaryCard.tsx` component
- [ ] Display total value delivered vs. target
- [ ] Show percentage achievement
- [ ] Add trend indicator (up/down/flat)
- [ ] Implement responsive design
- [ ] Write component tests

**Files:**

- `src/components/Customer/ValueSummaryCard.tsx`
- `src/components/Customer/__tests__/ValueSummaryCard.test.tsx`

**Estimate:** 1 day

---

#### Task 2.3: Metrics Table Component

- [ ] Create `MetricsTable.tsx` component
- [ ] Display metric name, target, actual, variance
- [ ] Add status indicators (✅ ⚠️ ❌)
- [ ] Implement sorting by column
- [ ] Add filtering by status
- [ ] Write component tests

**Files:**

- `src/components/Customer/MetricsTable.tsx`
- `src/components/Customer/__tests__/MetricsTable.test.tsx`

**Estimate:** 2 days

---

#### Task 2.4: Trend Chart Component

- [ ] Create `TrendChart.tsx` component
- [ ] Implement line chart with Recharts
- [ ] Show actual vs. target over time
- [ ] Add interactive tooltips
- [ ] Implement responsive design
- [ ] Write component tests

**Files:**

- `src/components/Customer/TrendChart.tsx`
- `src/components/Customer/__tests__/TrendChart.test.tsx`

**Estimate:** 2 days

---

### Week 3: Main Portal View

#### Task 3.1: Realization Portal Page

- [ ] Create `RealizationPortal.tsx` view
- [ ] Implement token validation on mount
- [ ] Fetch metrics data
- [ ] Compose all components
- [ ] Add error boundaries
- [ ] Write integration tests

**Files:**

- `src/views/Customer/RealizationPortal.tsx`
- `src/views/Customer/__tests__/RealizationPortal.test.tsx`

**Estimate:** 2 days

---

#### Task 3.2: Benchmark Comparison Component

- [ ] Create `BenchmarkComparison.tsx` component
- [ ] Display customer vs. industry percentile
- [ ] Show peer comparison chart
- [ ] Add benchmark data sources
- [ ] Implement responsive design
- [ ] Write component tests

**Files:**

- `src/components/Customer/BenchmarkComparison.tsx`
- `src/components/Customer/__tests__/BenchmarkComparison.test.tsx`

**Estimate:** 2 days

---

#### Task 3.3: Export Actions Component

- [ ] Create `ExportActions.tsx` component
- [ ] Implement PDF export button
- [ ] Implement Excel export button
- [ ] Add email sharing functionality
- [ ] Show download progress
- [ ] Write component tests

**Files:**

- `src/components/Customer/ExportActions.tsx`
- `src/components/Customer/__tests__/ExportActions.test.tsx`

**Estimate:** 2 days

---

### Week 4: Internal Tools

#### Task 4.1: Share Button in Deals View

- [ ] Add "Share with Customer" button to DealsView
- [ ] Implement modal for email input
- [ ] Generate customer token on share
- [ ] Send email with portal link
- [ ] Show success/error messages
- [ ] Write component tests

**Files:**

- `src/components/Deals/ShareCustomerButton.tsx`
- `src/components/Deals/ShareCustomerModal.tsx`

**Estimate:** 2 days

---

#### Task 4.2: Customer Access Management

- [ ] Create admin view for managing customer access
- [ ] List all active customer tokens
- [ ] Add revoke token functionality
- [ ] Add regenerate token functionality
- [ ] Show access logs (last accessed, count)
- [ ] Write component tests

**Files:**

- `src/views/Admin/CustomerAccessManagement.tsx`
- `src/components/Admin/CustomerAccessTable.tsx`

**Estimate:** 3 days

---

### Week 5-6: Beta Testing & Iteration

#### Task 5.1: Beta Customer Onboarding

- [ ] Select 5-10 beta customers
- [ ] Generate portal access for each
- [ ] Send onboarding emails
- [ ] Schedule feedback calls
- [ ] Document feedback

**Estimate:** 2 days

---

#### Task 5.2: Analytics & Monitoring

- [ ] Add analytics tracking to portal
- [ ] Track page views, time on page
- [ ] Track export actions
- [ ] Set up error monitoring
- [ ] Create Grafana dashboard for portal metrics

**Files:**

- `src/lib/analytics/customerPortalTracking.ts`
- `infra/grafana/dashboards/customer-portal.json`

**Estimate:** 2 days

---

#### Task 5.3: Documentation

- [ ] Write customer portal user guide
- [ ] Create video walkthrough
- [ ] Document API endpoints
- [ ] Write troubleshooting guide
- [ ] Update main README

**Files:**

- `docs/customer-portal/user-guide.md`
- `docs/customer-portal/api-reference.md`
- `docs/customer-portal/troubleshooting.md`

**Estimate:** 2 days

---

#### Task 5.4: Bug Fixes & Polish

- [ ] Fix bugs reported by beta customers
- [ ] Improve loading states
- [ ] Optimize performance
- [ ] Enhance mobile responsiveness
- [ ] Improve error messages

**Estimate:** 3 days

---

## Phase 2: Collaborative Business Case (Weeks 7-12)

### Week 7: Real-Time Infrastructure

#### Task 7.1: Supabase Realtime Setup

- [ ] Configure Supabase Realtime for `value_cases` table
- [ ] Set up broadcast channel for presence
- [ ] Test real-time updates
- [ ] Add error handling for connection issues
- [ ] Document realtime architecture

**Files:**

- `src/lib/realtime/supabaseRealtime.ts`
- `docs/architecture/realtime-collaboration.md`

**Estimate:** 2 days

---

#### Task 7.2: Presence System

- [ ] Create `usePresence` hook
- [ ] Track active users on canvas
- [ ] Display user avatars/names
- [ ] Show "X is editing..." indicators
- [ ] Handle user disconnect gracefully
- [ ] Write hook tests

**Files:**

- `src/hooks/usePresence.ts`
- `src/hooks/__tests__/usePresence.test.ts`

**Estimate:** 2 days

---

#### Task 7.3: Collaborative State Management

- [ ] Create `useCollaborativeCanvas` hook
- [ ] Implement optimistic updates
- [ ] Handle conflict resolution
- [ ] Add undo/redo functionality
- [ ] Sync local state with database
- [ ] Write hook tests

**Files:**

- `src/hooks/useCollaborativeCanvas.ts`
- `src/hooks/__tests__/useCollaborativeCanvas.test.ts`

**Estimate:** 3 days

---

### Week 8: Comment System

#### Task 8.1: Comments Database Schema

- [ ] Create `business_case_comments` table
- [ ] Add indexes for performance
- [ ] Add RLS policies
- [ ] Create comment notification triggers
- [ ] Write migration

**Files:**

- `supabase/migrations/20260113_business_case_comments.sql`

**Estimate:** 1 day

---

#### Task 8.2: Comment Components

- [ ] Create `CommentThread.tsx` component
- [ ] Create `Comment.tsx` component
- [ ] Create `CommentInput.tsx` component
- [ ] Add reply functionality
- [ ] Add edit/delete functionality
- [ ] Write component tests

**Files:**

- `src/components/Collaboration/CommentThread.tsx`
- `src/components/Collaboration/Comment.tsx`
- `src/components/Collaboration/CommentInput.tsx`

**Estimate:** 3 days

---

#### Task 8.3: Comment Notifications

- [ ] Send email when comment added
- [ ] Send in-app notification
- [ ] Add comment badge to canvas elements
- [ ] Mark comments as read/unread
- [ ] Write notification tests

**Files:**

- `src/services/CommentNotificationService.ts`
- `src/services/__tests__/CommentNotificationService.test.ts`

**Estimate:** 2 days

---

### Week 9: Collaborative Canvas UI

#### Task 9.1: Editable Assumption Fields

- [ ] Make assumption fields editable inline
- [ ] Show who's editing each field
- [ ] Add validation on input
- [ ] Show save status (saving/saved/error)
- [ ] Add keyboard shortcuts
- [ ] Write component tests

**Files:**

- `src/components/Collaboration/EditableField.tsx`
- `src/components/Collaboration/__tests__/EditableField.test.ts`

**Estimate:** 3 days

---

#### Task 9.2: Version History

- [ ] Create `canvas_versions` table
- [ ] Auto-save versions on significant changes
- [ ] Create version history UI
- [ ] Add restore to previous version
- [ ] Show diff between versions
- [ ] Write tests

**Files:**

- `supabase/migrations/20260120_canvas_versions.sql`
- `src/components/Collaboration/VersionHistory.tsx`

**Estimate:** 3 days

---

### Week 10: Guest Access

#### Task 10.1: Guest User System

- [ ] Create guest user authentication
- [ ] Generate magic links for prospects
- [ ] Set guest permissions (limited access)
- [ ] Add guest user indicator in UI
- [ ] Handle guest session expiration
- [ ] Write tests

**Files:**

- `src/services/GuestAccessService.ts`
- `src/services/__tests__/GuestAccessService.test.ts`

**Estimate:** 3 days

---

#### Task 10.2: Invitation Flow

- [ ] Create invitation modal
- [ ] Send invitation email
- [ ] Create invitation landing page
- [ ] Handle invitation acceptance
- [ ] Track invitation status
- [ ] Write tests

**Files:**

- `src/components/Collaboration/InviteModal.tsx`
- `src/views/Collaboration/InvitationAccept.tsx`

**Estimate:** 2 days

---

### Week 11-12: Testing & Polish

#### Task 11.1: Integration Testing

- [ ] Test real-time sync with multiple users
- [ ] Test conflict resolution scenarios
- [ ] Test presence system under load
- [ ] Test comment threading
- [ ] Test version history
- [ ] Document test results

**Estimate:** 3 days

---

#### Task 11.2: Performance Optimization

- [ ] Optimize real-time update frequency
- [ ] Add debouncing to input fields
- [ ] Implement lazy loading for comments
- [ ] Optimize database queries
- [ ] Add caching where appropriate

**Estimate:** 2 days

---

#### Task 11.3: Beta Testing

- [ ] Test with 10 sales reps
- [ ] Gather feedback on collaboration UX
- [ ] Fix reported bugs
- [ ] Iterate on design
- [ ] Document lessons learned

**Estimate:** 5 days

---

## Phase 3: Self-Service Calculator (Weeks 13-18)

### Week 13: Calculator Logic

#### Task 13.1: Industry Templates

- [ ] Create template data structure
- [ ] Build templates for 5 industries
- [ ] Add template validation
- [ ] Store templates in database
- [ ] Write template tests

**Files:**

- `src/data/calculatorTemplates.ts`
- `supabase/migrations/20260127_calculator_templates.sql`

**Estimate:** 3 days

---

#### Task 13.2: Simplified ROI Calculation

- [ ] Create `PublicCalculatorService`
- [ ] Implement basic financial calculations
- [ ] Add benchmark integration
- [ ] Add confidence scoring
- [ ] Write service tests

**Files:**

- `src/services/PublicCalculatorService.ts`
- `src/services/__tests__/PublicCalculatorService.test.ts`

**Estimate:** 3 days

---

### Week 14: Calculator UI

#### Task 14.1: Wizard Steps

- [ ] Create wizard navigation component
- [ ] Build Step 1: Company info
- [ ] Build Step 2: Pain points
- [ ] Build Step 3: Current metrics
- [ ] Build Step 4: Goals
- [ ] Build Step 5: Review
- [ ] Write component tests

**Files:**

- `src/components/Calculator/CalculatorWizard.tsx`
- `src/components/Calculator/WizardStep.tsx`
- `src/components/Calculator/steps/`

**Estimate:** 4 days

---

#### Task 14.2: Results Page

- [ ] Create results summary component
- [ ] Display ROI metrics
- [ ] Show benchmark comparison
- [ ] Add confidence disclaimer
- [ ] Implement responsive design
- [ ] Write component tests

**Files:**

- `src/components/Calculator/CalculatorResults.tsx`
- `src/components/Calculator/__tests__/CalculatorResults.test.tsx`

**Estimate:** 2 days

---

### Week 15: Lead Capture

#### Task 15.1: Lead Capture Database

- [ ] Create `calculator_leads` table
- [ ] Add indexes for querying
- [ ] Add lead scoring logic
- [ ] Create lead notification triggers
- [ ] Write migration

**Files:**

- `supabase/migrations/20260203_calculator_leads.sql`

**Estimate:** 1 day

---

#### Task 15.2: Lead Capture Service

- [ ] Create `LeadCaptureService`
- [ ] Implement email capture
- [ ] Send PDF report via email
- [ ] Sync to CRM
- [ ] Notify sales team
- [ ] Write service tests

**Files:**

- `src/services/LeadCaptureService.ts`
- `src/services/__tests__/LeadCaptureService.test.ts`

**Estimate:** 3 days

---

#### Task 15.3: PDF Report Generation

- [ ] Create calculator report template
- [ ] Implement PDF generation
- [ ] Add company branding
- [ ] Include disclaimer text
- [ ] Test PDF output
- [ ] Write tests

**Files:**

- `src/services/CalculatorReportService.ts`
- `src/templates/calculator-report.tsx`

**Estimate:** 2 days

---

### Week 16: Public Landing Page

#### Task 16.1: Calculator Landing Page

- [ ] Design landing page
- [ ] Add value proposition copy
- [ ] Include social proof
- [ ] Add FAQ section
- [ ] Implement SEO optimization
- [ ] Write page tests

**Files:**

- `src/views/Public/CalculatorLanding.tsx`

**Estimate:** 3 days

---

#### Task 16.2: Public Routes

- [ ] Create public route `/calculator`
- [ ] Add route protection (no auth required)
- [ ] Implement rate limiting
- [ ] Add analytics tracking
- [ ] Test public access

**Files:**

- `src/AppRoutes.tsx`
- `src/middleware/publicRateLimit.ts`

**Estimate:** 1 day

---

### Week 17-18: Launch & Optimize

#### Task 17.1: Analytics Setup

- [ ] Track calculator starts
- [ ] Track step completion rates
- [ ] Track email capture rate
- [ ] Track PDF downloads
- [ ] Create analytics dashboard

**Files:**

- `src/lib/analytics/calculatorTracking.ts`
- `infra/grafana/dashboards/calculator-metrics.json`

**Estimate:** 2 days

---

#### Task 17.2: A/B Testing

- [ ] Set up A/B testing framework
- [ ] Test different copy variations
- [ ] Test different question orders
- [ ] Test different result displays
- [ ] Document winning variations

**Estimate:** 3 days

---

#### Task 17.3: SEO & Marketing

- [ ] Optimize meta tags
- [ ] Add structured data markup
- [ ] Create sitemap
- [ ] Submit to search engines
- [ ] Create marketing materials

**Estimate:** 2 days

---

#### Task 17.4: Launch Preparation

- [ ] Final QA testing
- [ ] Load testing
- [ ] Security audit
- [ ] Deploy to production
- [ ] Monitor for issues

**Estimate:** 3 days

---

## Summary

### Phase 1: Value Realization Portal

- **Total Tasks:** 18
- **Estimated Duration:** 6 weeks
- **Team Size:** 2-3 developers

### Phase 2: Collaborative Business Case

- **Total Tasks:** 15
- **Estimated Duration:** 6 weeks
- **Team Size:** 2-3 developers

### Phase 3: Self-Service Calculator

- **Total Tasks:** 14
- **Estimated Duration:** 6 weeks
- **Team Size:** 2-3 developers

### Overall Project

- **Total Tasks:** 47
- **Estimated Duration:** 18 weeks
- **Total Effort:** ~270 developer days

---

## Task Tracking

Use GitHub Issues or Jira to track these tasks:

**Labels:**

- `phase-1-portal`
- `phase-2-collaboration`
- `phase-3-calculator`
- `backend`
- `frontend`
- `testing`
- `documentation`

**Milestones:**

- Phase 1 Complete (Week 6)
- Phase 2 Complete (Week 12)
- Phase 3 Complete (Week 18)

---

**Next Steps:**

1. Create GitHub issues for Phase 1 tasks
2. Assign tasks to team members
3. Set up project board
4. Begin Sprint 1 (Tasks 1.1-1.3)
