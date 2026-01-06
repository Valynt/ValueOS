# Database Context

## Overview
ValueOS uses Supabase (PostgreSQL) with Row Level Security (RLS) for multi-tenant data isolation.

## Connection
**Location:** `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);
```

## Schema Location
`supabase/migrations/`

## Core Tables

### tenants
Multi-tenant organization management.

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Enabled. Users can only access their tenant.

---

### users
User accounts and profiles.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Roles:**
- `admin` - Full tenant access
- `manager` - Team management
- `user` - Standard access
- `viewer` - Read-only

**RLS:** Users can only see users in their tenant.

---

### value_cases
Core entity representing a sales opportunity.

```sql
CREATE TABLE value_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  
  -- Basic Info
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  description TEXT,
  
  -- Lifecycle
  lifecycle_stage TEXT DEFAULT 'discovery',
  status TEXT DEFAULT 'active',
  
  -- Buyer Persona
  buyer_persona TEXT,
  persona_fit_score DECIMAL(3,2),
  
  -- CRM Integration
  crm_deal_id TEXT,
  crm_account_id TEXT,
  crm_sync_status TEXT,
  crm_last_synced_at TIMESTAMPTZ,
  
  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_value_cases_tenant ON value_cases(tenant_id);
CREATE INDEX idx_value_cases_lifecycle ON value_cases(lifecycle_stage);
CREATE INDEX idx_value_cases_company ON value_cases(company_name);
```

**Lifecycle Stages:**
- `discovery` - Identifying pain points
- `modeling` - Building value model
- `realization` - Tracking delivery
- `expansion` - Identifying upsell

**Status:**
- `active` - In progress
- `won` - Deal closed
- `lost` - Deal lost
- `archived` - Historical

**RLS:** Users can only access value cases in their tenant.

---

### opportunities
Pain points and business objectives identified during discovery.

```sql
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Opportunity Details
  type TEXT NOT NULL, -- 'pain_point' | 'business_objective'
  title TEXT NOT NULL,
  description TEXT,
  
  -- Quantification
  current_state JSONB,
  desired_state JSONB,
  gap_analysis JSONB,
  
  -- Prioritization
  priority TEXT DEFAULT 'medium',
  impact_score DECIMAL(3,2),
  urgency_score DECIMAL(3,2),
  
  -- Sources
  data_sources TEXT[],
  confidence_score DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_value_case ON opportunities(value_case_id);
CREATE INDEX idx_opportunities_type ON opportunities(type);
```

**RLS:** Inherited from value_cases via tenant_id.

---

### value_drivers
Capabilities mapped to business outcomes.

```sql
CREATE TABLE value_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Driver Details
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'revenue' | 'cost' | 'risk' | 'efficiency'
  
  -- Quantification
  baseline_value DECIMAL(15,2),
  target_value DECIMAL(15,2),
  unit TEXT, -- '$', '%', 'hours', etc.
  
  -- Calculation
  calculation_method TEXT,
  assumptions JSONB,
  
  -- Confidence
  confidence_level TEXT DEFAULT 'medium',
  data_quality TEXT DEFAULT 'medium',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_value_drivers_value_case ON value_drivers(value_case_id);
CREATE INDEX idx_value_drivers_category ON value_drivers(category);
```

**Categories:**
- `revenue` - Revenue increase
- `cost` - Cost reduction
- `risk` - Risk mitigation
- `efficiency` - Operational efficiency

**RLS:** Inherited from value_cases.

---

### financial_models
Financial projections and ROI calculations.

```sql
CREATE TABLE financial_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Model Type
  model_type TEXT DEFAULT 'roi', -- 'roi' | 'npv' | 'irr' | 'payback'
  time_horizon_years INTEGER DEFAULT 3,
  
  -- Inputs
  initial_investment DECIMAL(15,2),
  recurring_costs JSONB, -- Annual costs
  revenue_projections JSONB, -- Annual revenue
  discount_rate DECIMAL(5,4) DEFAULT 0.10,
  
  -- Outputs
  roi DECIMAL(10,2),
  npv DECIMAL(15,2),
  irr DECIMAL(5,4),
  payback_period_months INTEGER,
  
  -- Scenarios
  best_case JSONB,
  base_case JSONB,
  worst_case JSONB,
  
  -- Sensitivity
  sensitivity_analysis JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financial_models_value_case ON financial_models(value_case_id);
```

**RLS:** Inherited from value_cases.

---

### benchmarks
Industry benchmark data for comparative analysis.

```sql
CREATE TABLE benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Benchmark Identity
  kpi_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  company_size TEXT, -- 'small' | 'medium' | 'large' | 'enterprise'
  
  -- Statistical Distribution
  p25 DECIMAL(15,2),
  median DECIMAL(15,2),
  p75 DECIMAL(15,2),
  best_in_class DECIMAL(15,2),
  
  -- Metadata
  unit TEXT,
  source TEXT,
  vintage TEXT, -- Year of data
  sample_size INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_benchmarks_kpi ON benchmarks(kpi_name);
CREATE INDEX idx_benchmarks_industry ON benchmarks(industry);
CREATE UNIQUE INDEX idx_benchmarks_unique ON benchmarks(kpi_name, industry, company_size, vintage);
```

**No RLS:** Public reference data.

---

### realization_metrics
Actual vs. predicted value tracking.

```sql
CREATE TABLE realization_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Metric Identity
  metric_name TEXT NOT NULL,
  metric_type TEXT, -- 'revenue' | 'cost' | 'efficiency' | 'adoption'
  
  -- Predictions
  predicted_value DECIMAL(15,2),
  predicted_date DATE,
  
  -- Actuals
  actual_value DECIMAL(15,2),
  actual_date DATE,
  
  -- Variance
  variance DECIMAL(15,2),
  variance_pct DECIMAL(5,2),
  
  -- Status
  status TEXT, -- 'on_track' | 'at_risk' | 'off_track'
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_realization_metrics_value_case ON realization_metrics(value_case_id);
CREATE INDEX idx_realization_metrics_date ON realization_metrics(actual_date);
```

**RLS:** Inherited from value_cases.

---

### agent_executions
Audit log of all agent invocations.

```sql
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  
  -- Agent Details
  agent_name TEXT NOT NULL,
  agent_version TEXT,
  
  -- Execution
  input JSONB NOT NULL,
  output JSONB,
  confidence_score DECIMAL(3,2),
  
  -- Performance
  execution_time_ms INTEGER,
  llm_calls INTEGER,
  cost DECIMAL(10,4),
  
  -- Status
  status TEXT NOT NULL, -- 'success' | 'error' | 'timeout'
  error_message TEXT,
  
  -- Tracing
  trace_id TEXT,
  span_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_executions_tenant ON agent_executions(tenant_id);
CREATE INDEX idx_agent_executions_agent ON agent_executions(agent_name);
CREATE INDEX idx_agent_executions_value_case ON agent_executions(value_case_id);
CREATE INDEX idx_agent_executions_created ON agent_executions(created_at);
```

**RLS:** Users can only see executions in their tenant.

---

### agent_memory
Persistent memory for agents.

```sql
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  
  -- Memory Content
  memory_type TEXT NOT NULL, -- 'episodic' | 'semantic' | 'working'
  content JSONB NOT NULL,
  
  -- Context
  context_keys TEXT[],
  relevance_score DECIMAL(3,2),
  
  -- Lifecycle
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_memory_tenant ON agent_memory(tenant_id);
CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_name);
CREATE INDEX idx_agent_memory_type ON agent_memory(memory_type);
CREATE INDEX idx_agent_memory_expires ON agent_memory(expires_at);
```

**RLS:** Tenant-isolated.

---

## Row Level Security (RLS)

### Pattern: Tenant Isolation
```sql
-- Enable RLS
ALTER TABLE value_cases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's data
CREATE POLICY tenant_isolation ON value_cases
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Setting Tenant Context
```typescript
// In application code
await supabase.rpc('set_tenant_context', { 
  tenant_id: user.tenant_id 
});

// Now all queries are automatically filtered
const { data } = await supabase
  .from('value_cases')
  .select('*'); // Only returns current tenant's data
```

---

## Indexes

### Performance Indexes
```sql
-- Tenant-based queries
CREATE INDEX idx_value_cases_tenant ON value_cases(tenant_id);

-- Lifecycle filtering
CREATE INDEX idx_value_cases_lifecycle ON value_cases(lifecycle_stage);

-- Company search
CREATE INDEX idx_value_cases_company ON value_cases(company_name);

-- Date range queries
CREATE INDEX idx_agent_executions_created ON agent_executions(created_at);

-- Full-text search
CREATE INDEX idx_value_cases_search ON value_cases 
  USING gin(to_tsvector('english', name || ' ' || description));
```

---

## Migrations

### Creating Migrations
```bash
# Generate new migration
supabase migration new add_expansion_opportunities

# Edit migration file
# supabase/migrations/20260106_add_expansion_opportunities.sql

# Apply migration
supabase db push
```

### Migration Pattern
```sql
-- Up migration
CREATE TABLE expansion_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID REFERENCES value_cases(id) ON DELETE CASCADE,
  -- ... columns
);

-- Down migration (in separate file or comments)
-- DROP TABLE expansion_opportunities;
```

---

## Queries

### Common Patterns

**Get Value Cases with Opportunities:**
```typescript
const { data } = await supabase
  .from('value_cases')
  .select(`
    *,
    opportunities (
      id,
      type,
      title,
      impact_score
    )
  `)
  .eq('lifecycle_stage', 'discovery')
  .order('created_at', { ascending: false });
```

**Get Financial Summary:**
```typescript
const { data } = await supabase
  .from('financial_models')
  .select('roi, npv, payback_period_months')
  .eq('value_case_id', valueCaseId)
  .single();
```

**Search Value Cases:**
```typescript
const { data } = await supabase
  .from('value_cases')
  .select('*')
  .textSearch('name', searchTerm)
  .limit(10);
```

**Aggregate Metrics:**
```typescript
const { data } = await supabase
  .rpc('get_portfolio_metrics', {
    tenant_id: currentTenantId
  });
```

---

## Stored Procedures

### get_portfolio_metrics
```sql
CREATE OR REPLACE FUNCTION get_portfolio_metrics(tenant_id UUID)
RETURNS TABLE (
  total_value_cases INTEGER,
  active_cases INTEGER,
  total_roi DECIMAL,
  avg_confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE status = 'active')::INTEGER,
    SUM(fm.roi),
    AVG(vc.persona_fit_score)
  FROM value_cases vc
  LEFT JOIN financial_models fm ON fm.value_case_id = vc.id
  WHERE vc.tenant_id = $1;
END;
$$ LANGUAGE plpgsql;
```

---

## Backup & Recovery

### Automated Backups
Supabase provides automatic daily backups.

### Manual Backup
```bash
# Export schema
supabase db dump --schema public > backup.sql

# Export data
supabase db dump --data-only > data.sql
```

### Restore
```bash
# Restore schema
psql -h db.xxx.supabase.co -U postgres -d postgres < backup.sql

# Restore data
psql -h db.xxx.supabase.co -U postgres -d postgres < data.sql
```

---

## Performance Optimization

### Query Optimization
1. Use indexes for frequently filtered columns
2. Avoid SELECT * in production
3. Use pagination for large result sets
4. Leverage RLS for automatic filtering

### Connection Pooling
Supabase uses PgBouncer for connection pooling.

**Configuration:**
- Max connections: 100
- Pool mode: Transaction
- Timeout: 30s

---

## Troubleshooting

### RLS Issues
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'value_cases';

-- Disable RLS temporarily (dev only)
ALTER TABLE value_cases DISABLE ROW LEVEL SECURITY;
```

### Slow Queries
```sql
-- Enable query logging
ALTER DATABASE postgres SET log_min_duration_statement = 1000;

-- Analyze query plan
EXPLAIN ANALYZE
SELECT * FROM value_cases WHERE company_name = 'Acme Corp';
```

### Connection Issues
```typescript
// Check connection
const { data, error } = await supabase
  .from('tenants')
  .select('count')
  .single();

if (error) {
  console.error('Database connection failed:', error);
}
```

---

**Last Updated:** 2026-01-06  
**Related:** `src/lib/supabase.ts`, `supabase/migrations/`
