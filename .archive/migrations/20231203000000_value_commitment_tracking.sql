-- 003_value_commitment_tracking.sql
-- Value Commitment Tracking Schema Migration
-- Creates tables for tracking value commitments, stakeholders, milestones, metrics, audits, and risks

BEGIN;

-- =========================
-- Value Commitment Tracking Tables
-- =========================

-- Core value commitments table
CREATE TABLE IF NOT EXISTS public.value_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,

  -- Commitment Details
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  description text NOT NULL CHECK (char_length(description) >= 1 AND char_length(description) <= 2000),
  commitment_type text NOT NULL CHECK (commitment_type IN ('financial', 'timeline', 'operational', 'strategic', 'compliance')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  -- Financial Aspects
  financial_impact jsonb DEFAULT '{}'::jsonb,
  currency text NOT NULL DEFAULT 'USD',
  timeframe_months integer NOT NULL CHECK (timeframe_months >= 1 AND timeframe_months <= 120),

  -- Status & Progress
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed', 'in_progress', 'on_track', 'at_risk', 'completed', 'cancelled', 'failed')),
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  confidence_level numeric(5,2) NOT NULL DEFAULT 50 CHECK (confidence_level >= 0 AND confidence_level <= 100),

  -- Timeline
  committed_at timestamptz NOT NULL DEFAULT now(),
  target_completion_date timestamptz NOT NULL,
  actual_completion_date timestamptz,

  -- Ground Truth Integration
  ground_truth_references jsonb DEFAULT '{}'::jsonb,

  -- Metadata
  tags text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Commitment stakeholders
CREATE TABLE IF NOT EXISTS public.commitment_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.value_commitments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'contributor', 'approver', 'reviewer', 'observer')),
  responsibility text NOT NULL CHECK (char_length(responsibility) >= 1 AND char_length(responsibility) <= 500),
  accountability_percentage numeric(5,2) NOT NULL DEFAULT 50 CHECK (accountability_percentage >= 0 AND accountability_percentage <= 100),
  notification_preferences jsonb DEFAULT '{"email": true, "slack": false, "milestone_updates": true, "risk_alerts": true}'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (commitment_id, user_id)
);

-- Commitment milestones
CREATE TABLE IF NOT EXISTS public.commitment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.value_commitments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  description text NOT NULL CHECK (char_length(description) >= 1 AND char_length(description) <= 1000),
  milestone_type text NOT NULL CHECK (milestone_type IN ('planning', 'execution', 'review', 'completion', 'validation')),
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  target_date timestamptz NOT NULL,
  actual_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  deliverables text[] DEFAULT '{}'::text[],
  dependencies text[] DEFAULT '{}'::text[],
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  success_criteria text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (commitment_id, sequence_order)
);

-- Commitment metrics
CREATE TABLE IF NOT EXISTS public.commitment_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.value_commitments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_name text NOT NULL CHECK (char_length(metric_name) >= 1 AND char_length(metric_name) <= 100),
  metric_description text NOT NULL CHECK (char_length(metric_description) >= 1 AND char_length(metric_description) <= 500),
  metric_type text NOT NULL CHECK (metric_type IN ('kpi', 'roi', 'progress', 'quality', 'efficiency')),
  target_value numeric NOT NULL,
  current_value numeric,
  unit text NOT NULL CHECK (char_length(unit) >= 1 AND char_length(unit) <= 20),
  measurement_frequency text NOT NULL DEFAULT 'monthly' CHECK (measurement_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
  baseline_value numeric,
  tolerance_percentage numeric(5,2) NOT NULL DEFAULT 10 CHECK (tolerance_percentage >= 0 AND tolerance_percentage <= 100),
  last_measured_at timestamptz,
  next_measurement_date timestamptz NOT NULL,
  data_source text NOT NULL CHECK (char_length(data_source) >= 1 AND char_length(data_source) <= 200),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Commitment audits (append-only)
CREATE TABLE IF NOT EXISTS public.commitment_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.value_commitments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'status_changed', 'stakeholder_added', 'stakeholder_removed', 'milestone_completed', 'metric_updated', 'risk_assessed')),
  previous_values jsonb DEFAULT '{}'::jsonb,
  new_values jsonb DEFAULT '{}'::jsonb,
  change_reason text NOT NULL CHECK (char_length(change_reason) >= 1 AND char_length(change_reason) <= 500),
  ip_address inet,
  user_agent text,
  audit_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Commitment risks
CREATE TABLE IF NOT EXISTS public.commitment_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.value_commitments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  risk_title text NOT NULL CHECK (char_length(risk_title) >= 1 AND char_length(risk_title) <= 200),
  risk_description text NOT NULL CHECK (char_length(risk_description) >= 1 AND char_length(risk_description) <= 1000),
  risk_category text NOT NULL CHECK (risk_category IN ('execution', 'resource', 'market', 'technical', 'regulatory', 'financial')),
  probability text NOT NULL CHECK (probability IN ('low', 'medium', 'high', 'critical')),
  impact text NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  risk_score numeric(3,1) CHECK (risk_score >= 1 AND risk_score <= 16),
  mitigation_plan text NOT NULL CHECK (char_length(mitigation_plan) >= 1 AND char_length(mitigation_plan) <= 2000),
  contingency_plan text NOT NULL CHECK (char_length(contingency_plan) >= 1 AND char_length(contingency_plan) <= 2000),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'mitigating', 'mitigated', 'occurred', 'closed')),
  identified_at timestamptz NOT NULL DEFAULT now(),
  mitigated_at timestamptz,
  occurred_at timestamptz,
  review_date timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- Row Level Security (RLS)
-- =========================

-- Enable RLS on all tables
ALTER TABLE public.value_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_risks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for value_commitments
CREATE POLICY "Users can view commitments in their tenant" ON public.value_commitments
  FOR SELECT USING (tenant_id = app.current_tenant_id());

CREATE POLICY "Users can create commitments in their tenant" ON public.value_commitments
  FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id() AND user_id = app.current_user_id());

CREATE POLICY "Users can update commitments they own or are stakeholders in" ON public.value_commitments
  FOR UPDATE USING (
    tenant_id = app.current_tenant_id() AND (
      user_id = app.current_user_id() OR
      id IN (
        SELECT commitment_id FROM public.commitment_stakeholders
        WHERE user_id = app.current_user_id() AND is_active = true
      )
    )
  );

CREATE POLICY "Users can delete commitments they own" ON public.value_commitments
  FOR DELETE USING (tenant_id = app.current_tenant_id() AND user_id = app.current_user_id());

-- RLS Policies for commitment_stakeholders
CREATE POLICY "Users can view stakeholders in their tenant" ON public.commitment_stakeholders
  FOR SELECT USING (tenant_id = app.current_tenant_id());

CREATE POLICY "Users can manage stakeholders for commitments they own or are stakeholders in" ON public.commitment_stakeholders
  FOR ALL USING (
    tenant_id = app.current_tenant_id() AND (
      commitment_id IN (
        SELECT id FROM public.value_commitments
        WHERE user_id = app.current_user_id()
      ) OR
      commitment_id IN (
        SELECT commitment_id FROM public.commitment_stakeholders
        WHERE user_id = app.current_user_id() AND is_active = true
      )
    )
  );

-- Similar policies for other tables (simplified for brevity)
CREATE POLICY "Users can view milestones in their tenant" ON public.commitment_milestones
  FOR SELECT USING (tenant_id = app.current_tenant_id());

CREATE POLICY "Users can manage milestones for their commitments" ON public.commitment_milestones
  FOR ALL USING (
    tenant_id = app.current_tenant_id() AND
    commitment_id IN (
      SELECT id FROM public.value_commitments WHERE user_id = app.current_user_id()
      UNION
      SELECT commitment_id FROM public.commitment_stakeholders
      WHERE user_id = app.current_user_id() AND is_active = true
    )
  );

CREATE POLICY "Users can view metrics in their tenant" ON public.commitment_metrics
  FOR SELECT USING (tenant_id = app.current_tenant_id());

CREATE POLICY "Users can manage metrics for their commitments" ON public.commitment_metrics
  FOR ALL USING (
    tenant_id = app.current_tenant_id() AND
    commitment_id IN (
      SELECT id FROM public.value_commitments WHERE user_id = app.current_user_id()
      UNION
      SELECT commitment_id FROM public.commitment_stakeholders
      WHERE user_id = app.current_user_id() AND is_active = true
    )
  );

CREATE POLICY "Users can view audits in their tenant" ON public.commitment_audits
  FOR SELECT USING (tenant_id = app.current_tenant_id());

CREATE POLICY "System can create audit entries" ON public.commitment_audits
  FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY "Users can view risks in their tenant" ON public.commitment_risks
  FOR SELECT USING (tenant_id = app.current_tenant_id());

CREATE POLICY "Users can manage risks for their commitments" ON public.commitment_risks
  FOR ALL USING (
    tenant_id = app.current_tenant_id() AND (
      owner_id = app.current_user_id() OR
      commitment_id IN (
        SELECT id FROM public.value_commitments WHERE user_id = app.current_user_id()
        UNION
        SELECT commitment_id FROM public.commitment_stakeholders
        WHERE user_id = app.current_user_id() AND is_active = true
      )
    )
  );

-- =========================
-- Indexes
-- =========================

-- Value commitments indexes
CREATE INDEX IF NOT EXISTS idx_value_commitments_tenant ON public.value_commitments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_value_commitments_user ON public.value_commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_value_commitments_session ON public.value_commitments(session_id);
CREATE INDEX IF NOT EXISTS idx_value_commitments_status ON public.value_commitments(status);
CREATE INDEX IF NOT EXISTS idx_value_commitments_priority ON public.value_commitments(priority);
CREATE INDEX IF NOT EXISTS idx_value_commitments_target_date ON public.value_commitments(target_completion_date);
CREATE INDEX IF NOT EXISTS idx_value_commitments_tags ON public.value_commitments USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_value_commitments_ground_truth ON public.value_commitments USING GIN (ground_truth_references);

-- Commitment stakeholders indexes
CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_tenant ON public.commitment_stakeholders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_commitment ON public.commitment_stakeholders(commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_user ON public.commitment_stakeholders(user_id);
CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_active ON public.commitment_stakeholders(commitment_id, is_active);

-- Commitment milestones indexes
CREATE INDEX IF NOT EXISTS idx_commitment_milestones_tenant ON public.commitment_milestones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commitment_milestones_commitment ON public.commitment_milestones(commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_milestones_status ON public.commitment_milestones(status);
CREATE INDEX IF NOT EXISTS idx_commitment_milestones_target_date ON public.commitment_milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_commitment_milestones_assigned_to ON public.commitment_milestones(assigned_to);

-- Commitment metrics indexes
CREATE INDEX IF NOT EXISTS idx_commitment_metrics_tenant ON public.commitment_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commitment_metrics_commitment ON public.commitment_metrics(commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_metrics_type ON public.commitment_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_commitment_metrics_active ON public.commitment_metrics(commitment_id, is_active);
CREATE INDEX IF NOT EXISTS idx_commitment_metrics_next_measurement ON public.commitment_metrics(next_measurement_date);

-- Commitment audits indexes
CREATE INDEX IF NOT EXISTS idx_commitment_audits_tenant ON public.commitment_audits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commitment_audits_commitment ON public.commitment_audits(commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_audits_user ON public.commitment_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_commitment_audits_action ON public.commitment_audits(action);
CREATE INDEX IF NOT EXISTS idx_commitment_audits_created_at ON public.commitment_audits(created_at DESC);

-- Commitment risks indexes
CREATE INDEX IF NOT EXISTS idx_commitment_risks_tenant ON public.commitment_risks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commitment_risks_commitment ON public.commitment_risks(commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_risks_owner ON public.commitment_risks(owner_id);
CREATE INDEX IF NOT EXISTS idx_commitment_risks_status ON public.commitment_risks(status);
CREATE INDEX IF NOT EXISTS idx_commitment_risks_score ON public.commitment_risks(risk_score);
CREATE INDEX IF NOT EXISTS idx_commitment_risks_review_date ON public.commitment_risks(review_date);

-- =========================
-- Functions and Triggers
-- =========================

-- Function to calculate risk score based on probability and impact
CREATE OR REPLACE FUNCTION public.calculate_risk_score(probability text, impact text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  prob_score integer;
  impact_score integer;
BEGIN
  -- Convert probability to numeric score
  prob_score := CASE probability
    WHEN 'low' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    WHEN 'critical' THEN 4
    ELSE 1
  END;

  -- Convert impact to numeric score
  impact_score := CASE impact
    WHEN 'low' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    WHEN 'critical' THEN 4
    ELSE 1
  END;

  RETURN (prob_score * impact_score)::numeric;
END;
$$;

-- Function to update commitment progress based on milestones and metrics
CREATE OR REPLACE FUNCTION public.update_commitment_progress(commitment_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  milestone_progress numeric;
  metric_progress numeric;
  overall_progress numeric;
BEGIN
  -- Calculate milestone completion percentage
  SELECT COALESCE(AVG(progress_percentage), 0)
  INTO milestone_progress
  FROM public.commitment_milestones
  WHERE commitment_id = $1 AND status != 'cancelled';

  -- Calculate metric achievement percentage
  SELECT COALESCE(AVG(
    CASE
      WHEN current_value IS NOT NULL AND target_value != 0
      THEN LEAST(100, GREATEST(0, (current_value / target_value) * 100))
      ELSE 0
    END
  ), 0)
  INTO metric_progress
  FROM public.commitment_metrics
  WHERE commitment_id = $1 AND is_active = true;

  -- Calculate overall progress as weighted average
  overall_progress := (milestone_progress * 0.6) + (metric_progress * 0.4);

  -- Update the commitment
  UPDATE public.value_commitments
  SET
    progress_percentage = ROUND(overall_progress, 2),
    updated_at = now()
  WHERE id = $1;
END;
$$;

-- Trigger to automatically calculate risk score
CREATE OR REPLACE FUNCTION public.trigger_calculate_risk_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.risk_score := public.calculate_risk_score(NEW.probability, NEW.impact);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_commitment_risks_calculate_score
  BEFORE INSERT OR UPDATE OF probability, impact ON public.commitment_risks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_calculate_risk_score();

-- Trigger to update commitment updated_at timestamp
CREATE OR REPLACE FUNCTION public.trigger_update_commitment_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.value_commitments
  SET updated_at = now()
  WHERE id = NEW.commitment_id;
  RETURN NEW;
END;
$$;

-- Apply timestamp update triggers to related tables
CREATE TRIGGER trigger_stakeholders_update_commitment
  AFTER INSERT OR UPDATE OR DELETE ON public.commitment_stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_commitment_timestamp();

CREATE TRIGGER trigger_milestones_update_commitment
  AFTER INSERT OR UPDATE OR DELETE ON public.commitment_milestones
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_commitment_timestamp();

CREATE TRIGGER trigger_metrics_update_commitment
  AFTER INSERT OR UPDATE OR DELETE ON public.commitment_metrics
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_commitment_timestamp();

CREATE TRIGGER trigger_risks_update_commitment
  AFTER INSERT OR UPDATE OR DELETE ON public.commitment_risks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_commitment_timestamp();

COMMIT;
