-- Sprint 20: Promote commitment tracking tables from archived schema to active migrations.
-- Creates value_commitments, commitment_stakeholders, commitment_milestones,
-- commitment_metrics, commitment_audits, commitment_risks, and commitment_notes.
-- RLS uses security.user_has_tenant_access() consistent with all other tenant tables.

BEGIN;

-- ---------------------------------------------------------------------------
-- value_commitments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.value_commitments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid        NOT NULL,
  tenant_id               uuid        NOT NULL,
  created_by              uuid        NOT NULL,
  owner_user_id           uuid,

  title                   text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description             text        CHECK (char_length(description) <= 2000),
  commitment_type         text        NOT NULL CHECK (commitment_type IN ('financial', 'operational', 'strategic', 'compliance')),
  priority                text        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  financial_impact        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  currency                text        NOT NULL DEFAULT 'USD',
  timeframe_months        integer     NOT NULL CHECK (timeframe_months BETWEEN 1 AND 120),

  status                  text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'at_risk', 'fulfilled', 'cancelled')),
  progress_percentage     numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),

  committed_at            timestamptz NOT NULL DEFAULT now(),
  target_completion_date  timestamptz NOT NULL,
  actual_completion_date  timestamptz,

  tags                    text[]      NOT NULL DEFAULT '{}'::text[],
  metadata                jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.value_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY value_commitments_select ON public.value_commitments
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY value_commitments_insert ON public.value_commitments
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY value_commitments_update ON public.value_commitments
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY value_commitments_delete ON public.value_commitments
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

CREATE INDEX IF NOT EXISTS idx_value_commitments_org      ON public.value_commitments (organization_id);
CREATE INDEX IF NOT EXISTS idx_value_commitments_status   ON public.value_commitments (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_value_commitments_progress ON public.value_commitments (organization_id, progress_percentage);

-- ---------------------------------------------------------------------------
-- commitment_stakeholders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commitment_stakeholders (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id             uuid        NOT NULL REFERENCES public.value_commitments (id) ON DELETE CASCADE,
  organization_id           uuid        NOT NULL,
  tenant_id                 uuid        NOT NULL,
  user_id                   uuid        NOT NULL,
  role                      text        NOT NULL CHECK (role IN ('owner', 'contributor', 'approver', 'reviewer', 'observer')),
  responsibility            text        NOT NULL CHECK (char_length(responsibility) BETWEEN 1 AND 500),
  accountability_percentage numeric(5,2) NOT NULL DEFAULT 50 CHECK (accountability_percentage BETWEEN 0 AND 100),
  is_active                 boolean     NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE (commitment_id, user_id)
);

ALTER TABLE public.commitment_stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY commitment_stakeholders_select ON public.commitment_stakeholders
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_stakeholders_insert ON public.commitment_stakeholders
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_stakeholders_update ON public.commitment_stakeholders
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_stakeholders_delete ON public.commitment_stakeholders
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_commitment ON public.commitment_stakeholders (commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_org        ON public.commitment_stakeholders (organization_id);

-- ---------------------------------------------------------------------------
-- commitment_milestones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commitment_milestones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id       uuid        NOT NULL REFERENCES public.value_commitments (id) ON DELETE CASCADE,
  organization_id     uuid        NOT NULL,
  tenant_id           uuid        NOT NULL,
  title               text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description         text        CHECK (char_length(description) <= 1000),
  milestone_type      text        NOT NULL CHECK (milestone_type IN ('planning', 'execution', 'review', 'completion', 'validation')),
  sequence_order      integer     NOT NULL CHECK (sequence_order >= 1),
  target_date         timestamptz NOT NULL,
  actual_date         timestamptz,
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
  progress_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  deliverables        text[]      NOT NULL DEFAULT '{}'::text[],
  success_criteria    text[]      NOT NULL DEFAULT '{}'::text[],
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (commitment_id, sequence_order)
);

ALTER TABLE public.commitment_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY commitment_milestones_select ON public.commitment_milestones
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_milestones_insert ON public.commitment_milestones
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_milestones_update ON public.commitment_milestones
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_milestones_delete ON public.commitment_milestones
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

CREATE INDEX IF NOT EXISTS idx_commitment_milestones_commitment ON public.commitment_milestones (commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_milestones_org        ON public.commitment_milestones (organization_id);
CREATE INDEX IF NOT EXISTS idx_commitment_milestones_status     ON public.commitment_milestones (commitment_id, status);

-- ---------------------------------------------------------------------------
-- commitment_metrics
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commitment_metrics (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id        uuid        NOT NULL REFERENCES public.value_commitments (id) ON DELETE CASCADE,
  organization_id      uuid        NOT NULL,
  tenant_id            uuid        NOT NULL,
  metric_name          text        NOT NULL CHECK (char_length(metric_name) BETWEEN 1 AND 100),
  baseline_value       numeric     NOT NULL,
  target_value         numeric     NOT NULL,
  current_value        numeric,
  unit                 text        NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 50),
  is_active            boolean     NOT NULL DEFAULT true,
  last_measured_at     timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commitment_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY commitment_metrics_select ON public.commitment_metrics
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_metrics_insert ON public.commitment_metrics
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_metrics_update ON public.commitment_metrics
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_metrics_delete ON public.commitment_metrics
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

CREATE INDEX IF NOT EXISTS idx_commitment_metrics_commitment ON public.commitment_metrics (commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_metrics_org        ON public.commitment_metrics (organization_id);
CREATE INDEX IF NOT EXISTS idx_commitment_metrics_active     ON public.commitment_metrics (commitment_id, is_active);

-- ---------------------------------------------------------------------------
-- commitment_risks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commitment_risks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id     uuid        NOT NULL REFERENCES public.value_commitments (id) ON DELETE CASCADE,
  organization_id   uuid        NOT NULL,
  tenant_id         uuid        NOT NULL,
  risk_title        text        NOT NULL CHECK (char_length(risk_title) BETWEEN 1 AND 200),
  risk_description  text        NOT NULL CHECK (char_length(risk_description) BETWEEN 1 AND 1000),
  risk_category     text        NOT NULL CHECK (risk_category IN ('execution', 'resource', 'market', 'technical', 'regulatory', 'financial')),
  probability       text        NOT NULL CHECK (probability IN ('low', 'medium', 'high', 'critical')),
  impact            text        NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  risk_score        numeric(3,1) GENERATED ALWAYS AS (
    (CASE probability WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'critical' THEN 4 ELSE 1 END)::numeric *
    (CASE impact      WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'critical' THEN 4 ELSE 1 END)::numeric
  ) STORED,
  mitigation_plan   text        NOT NULL CHECK (char_length(mitigation_plan) BETWEEN 1 AND 2000),
  contingency_plan  text        NOT NULL CHECK (char_length(contingency_plan) BETWEEN 1 AND 2000),
  owner_id          uuid        NOT NULL,
  status            text        NOT NULL DEFAULT 'identified'
                      CHECK (status IN ('identified', 'mitigating', 'mitigated', 'occurred', 'closed')),
  identified_at     timestamptz NOT NULL DEFAULT now(),
  mitigated_at      timestamptz,
  review_date       timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commitment_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY commitment_risks_select ON public.commitment_risks
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_risks_insert ON public.commitment_risks
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_risks_update ON public.commitment_risks
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_risks_delete ON public.commitment_risks
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

CREATE INDEX IF NOT EXISTS idx_commitment_risks_commitment ON public.commitment_risks (commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_risks_org        ON public.commitment_risks (organization_id);
CREATE INDEX IF NOT EXISTS idx_commitment_risks_status     ON public.commitment_risks (commitment_id, status);

-- ---------------------------------------------------------------------------
-- commitment_notes  (append-only; no UPDATE/DELETE policies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commitment_notes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id   uuid        NOT NULL REFERENCES public.value_commitments (id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL,
  tenant_id       uuid        NOT NULL,
  created_by      uuid        NOT NULL,
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  visibility      text        NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'stakeholder')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commitment_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY commitment_notes_select ON public.commitment_notes
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_notes_insert ON public.commitment_notes
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
-- No UPDATE or DELETE — notes are append-only

CREATE INDEX IF NOT EXISTS idx_commitment_notes_commitment ON public.commitment_notes (commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_notes_org        ON public.commitment_notes (organization_id);

-- ---------------------------------------------------------------------------
-- commitment_audits  (append-only; no UPDATE/DELETE policies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commitment_audits (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id   uuid        NOT NULL REFERENCES public.value_commitments (id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL,
  tenant_id       uuid        NOT NULL,
  actor_id        uuid        NOT NULL,
  action          text        NOT NULL,
  before_state    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  after_state     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commitment_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY commitment_audits_select ON public.commitment_audits
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY commitment_audits_insert ON public.commitment_audits
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
-- No UPDATE or DELETE — audit log is append-only

CREATE INDEX IF NOT EXISTS idx_commitment_audits_commitment ON public.commitment_audits (commitment_id);
CREATE INDEX IF NOT EXISTS idx_commitment_audits_org        ON public.commitment_audits (organization_id);
CREATE INDEX IF NOT EXISTS idx_commitment_audits_created_at ON public.commitment_audits (created_at DESC);

COMMIT;
