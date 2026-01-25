# Value Commitment Tracking Schema

## Overview

The Value Commitment Tracking Schema provides a comprehensive framework for tracking, managing, and monitoring value commitments made during ValueOS value analysis sessions. It enables organizations to transform insights into actionable commitments with measurable outcomes.

## Core Concepts

### Value Commitments

Value commitments represent specific, measurable undertakings made during value analysis sessions. Each commitment includes:

- **Financial Impact**: Expected revenue uplift, cost reductions, or other financial outcomes
- **Timeline**: Target completion dates and milestone schedules
- **Stakeholders**: Responsible parties and accountability assignments
- **Success Metrics**: KPIs and measurements for tracking progress
- **Risk Management**: Identified risks and mitigation strategies

### Commitment Types

- **Financial**: Revenue growth, cost reduction, capital efficiency
- **Timeline**: Delivery schedules and deadline commitments
- **Operational**: Process improvements and efficiency gains
- **Strategic**: Long-term positioning and market expansion
- **Compliance**: Regulatory and governance requirements

## Schema Architecture

### Core Tables

#### `value_commitments`

Main commitment tracking table containing:

- Basic metadata (title, description, type, priority)
- Financial impact projections
- Status and progress tracking
- Timeline information
- Ground truth integration references

#### `commitment_stakeholders`

Stakeholder management with:

- Role definitions (owner, contributor, approver, reviewer, observer)
- Accountability percentages
- Notification preferences
- Activity tracking

#### `commitment_milestones`

Timeline decomposition with:

- Sequential milestone tracking
- Progress percentages
- Dependencies and blockers
- Assignment and ownership

#### `commitment_metrics`

Success measurement framework:

- KPI definitions with targets and baselines
- Measurement frequency and data sources
- Tolerance bands and alerting
- Achievement tracking

#### `commitment_audits`

Complete audit trail:

- All changes with before/after values
- User attribution and timestamps
- Change reasons and context
- Compliance and governance support

#### `commitment_risks`

Risk management system:

- Risk identification and scoring
- Mitigation and contingency planning
- Status tracking and review cycles
- Owner accountability

## Integration Points

### Ground Truth Integration

Commitments are validated against:

- **ESO Benchmarks**: Industry-standard KPIs and performance targets
- **Persona Alignment**: Stakeholder-specific value drivers and pain points
- **Confidence Scoring**: Ground truth-backed probability assessments

### ValueOS Ecosystem

- **Agent Sessions**: Commitments created from analysis sessions
- **Workflow Executions**: Automated progress tracking and notifications
- **User Management**: Stakeholder assignments and permissions
- **Audit Logging**: Comprehensive change tracking for compliance

## Usage Examples

### Creating a Commitment

```typescript
const commitment = await commitmentService.createCommitment(tenantId, userId, sessionId, {
  title: "Achieve 30% Revenue Growth",
  description: "Implement SaaS expansion strategy to reach $10M ARR",
  commitment_type: "financial",
  priority: "critical",
  financial_impact: {
    revenue_uplift: 3000000,
  },
  timeframe_months: 12,
  target_completion_date: "2026-01-15T00:00:00Z",
  ground_truth_references: {
    benchmark_ids: ["saas_nrr", "saas_cac"],
    persona: "ceo",
    industry: "saas",
    confidence_sources: ["ScaleMetrics", "Internal Analysis"],
  },
});
```

### Adding Stakeholders

```typescript
await commitmentService.addStakeholder(commitment.id, tenantId, stakeholderId, {
  role: "owner",
  responsibility: "Overall accountability for revenue growth targets",
  accountability_percentage: 100,
  notification_preferences: {
    email: true,
    slack: true,
    milestone_updates: true,
    risk_alerts: true,
  },
});
```

### Creating Milestones

```typescript
await commitmentService.createMilestone(commitment.id, tenantId, userId, {
  title: "Q1 Planning Complete",
  description: "Finalize go-to-market strategy and resource allocation",
  milestone_type: "planning",
  sequence_order: 1,
  target_date: "2025-03-31T00:00:00Z",
  deliverables: ["GTM Strategy Document", "Budget Allocation"],
  success_criteria: ["Strategy approved by leadership", "Resources committed"],
});
```

### Tracking Metrics

```typescript
await commitmentService.createMetric(commitment.id, tenantId, userId, {
  metric_name: "Monthly Recurring Revenue",
  metric_description: "Total MRR from subscription products",
  metric_type: "kpi",
  target_value: 833333, // $10M ARR / 12 months
  unit: "usd",
  measurement_frequency: "monthly",
  baseline_value: 500000,
  tolerance_percentage: 10,
  data_source: "Stripe Integration",
  next_measurement_date: "2025-02-01T00:00:00Z",
});
```

## Progress Tracking

### Automatic Calculations

- **Milestone Progress**: Weighted average of milestone completion percentages
- **Metric Achievement**: Ratio of current vs. target values
- **Overall Progress**: 60% milestone weight + 40% metric weight
- **Risk Scoring**: Probability × Impact matrix (1-16 scale)

### Status Management

- **Draft**: Planning phase
- **Committed**: Approved and active
- **In Progress**: Execution underway
- **On Track**: Meeting milestones and targets
- **At Risk**: Missing targets or delayed
- **Completed**: Successfully delivered
- **Cancelled/Failed**: Terminated or unsuccessful

## Risk Management

### Risk Categories

- **Execution**: Delivery and implementation risks
- **Resource**: People, budget, and capacity constraints
- **Market**: Competitive and external environment factors
- **Technical**: Technology and integration challenges
- **Regulatory**: Compliance and legal requirements
- **Financial**: Budget and ROI uncertainties

### Risk Scoring Matrix

```
Probability → Low (1) | Medium (2) | High (3) | Critical (4)
Impact      ↓
Low (1)       1          2           3           4
Medium (2)    2          4           6           8
High (3)      3          6           9          12
Critical (4)  4          8          12          16
```

## Database Schema

### Migration File

Located at: `supabase/migrations/` (value commitment tracking migration)

### Key Features

- **Row Level Security**: Tenant-based data isolation
- **Audit Triggers**: Automatic timestamp updates
- **Risk Calculation**: Auto-computed risk scores
- **Progress Updates**: Trigger-based progress recalculation
- **Indexing**: Optimized queries for performance

### Indexes Created

- Tenant and user-based access patterns
- Date-based range queries
- Status and priority filtering
- Foreign key relationships
- JSON field searching (tags, metadata)

## API Integration

### Service Layer

`ValueCommitmentTrackingService` provides:

- CRUD operations for all entities
- Progress calculation and analytics
- Ground truth validation
- Audit trail management
- Stakeholder notifications

### Type Safety

- Full TypeScript type definitions
- Zod schema validation
- Runtime data validation
- Type-safe database operations

## Monitoring & Analytics

### Key Metrics Tracked

- Commitment completion rates
- Average delivery time vs. targets
- Stakeholder engagement levels
- Risk mitigation effectiveness
- Ground truth validation accuracy

### Dashboard Views

- **Executive Summary**: High-level commitment status
- **Progress Tracking**: Milestone and metric visualization
- **Risk Heat Map**: Risk scoring and trends
- **Stakeholder Dashboard**: Personal commitment views

## Security & Compliance

### Data Protection

- **Encryption**: Sensitive data encrypted at rest
- **Access Control**: Role-based permissions
- **Audit Trails**: Complete change history
- **Data Retention**: Configurable retention policies

### Compliance Features

- **GDPR**: Data subject access and deletion
- **SOX**: Financial commitment tracking
- **Industry Standards**: ISO 27001 alignment

## Future Enhancements

### Planned Features

- **AI-Powered Insights**: Predictive analytics for commitment success
- **Automated Escalations**: Risk-based notification workflows
- **Integration APIs**: Third-party tool connections
- **Advanced Reporting**: Custom dashboard and export capabilities
- **Machine Learning**: Success pattern recognition

### Scalability Considerations

- **Partitioning**: Time-based data partitioning
- **Caching**: Redis integration for performance
- **Archiving**: Automated data lifecycle management
- **Multi-Region**: Global deployment support

## Getting Started

1. **Run Migration**: Apply the database schema migration
2. **Initialize Service**: Create `ValueCommitmentTrackingService` instance
3. **Configure Ground Truth**: Integrate with ESO and benchmark data
4. **Set Up Monitoring**: Configure dashboards and alerting
5. **Train Users**: Provide stakeholder training and guidelines

## Support & Documentation

For detailed API documentation, see the TypeScript definitions in:

- `src/types/value-commitment-tracking.ts`
- `src/types/value-commitment-schemas.ts`
- `src/services/ValueCommitmentTrackingService.ts`
