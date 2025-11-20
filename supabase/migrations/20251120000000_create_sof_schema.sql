-- ============================================================================
-- Systemic Outcome Framework (SOF) Schema
-- ============================================================================
-- This migration adds support for the Systemic Outcome Framework while
-- maintaining backward compatibility with existing VOS workflows.
--
-- Tables:
-- - system_maps: Entity relationships, loops, constraints, leverage points
-- - intervention_points: Mapped to KPIs and outcome pathways
-- - outcome_hypotheses: Bridges system maps → KPI deltas → value stories
-- - systemic_risks: Models unintended consequences
-- - feedback_loops: Captures Realization → Behavior Change → System Update
-- - academy_progress: Ties user learning to system outcomes
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SYSTEM MAPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_maps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_case_id UUID REFERENCES business_cases(id) ON DELETE CASCADE,
    
    -- Core attributes
    name TEXT NOT NULL,
    description TEXT,
    system_type TEXT NOT NULL CHECK (system_type IN ('business_process', 'customer_journey', 'value_chain', 'ecosystem', 'organizational', 'technical')),
    
    -- System structure (JSONB for flexibility)
    entities JSONB NOT NULL DEFAULT '[]', -- [{id, name, type, attributes}]
    relationships JSONB NOT NULL DEFAULT '[]', -- [{from, to, type, strength, description}]
    constraints JSONB NOT NULL DEFAULT '[]', -- [{id, type, description, impact}]
    leverage_points JSONB NOT NULL DEFAULT '[]', -- [{id, location, type, potential_impact, effort}]
    
    -- System boundaries
    boundary_definition JSONB, -- {included, excluded, assumptions}
    external_factors JSONB DEFAULT '[]', -- [{id, name, impact, controllability}]
    
    -- Metadata
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'active', 'archived')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL REFERENCES users(id),
    validated_by UUID REFERENCES users(id),
    validated_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT system_maps_name_org_unique UNIQUE (organization_id, name, version)
);

-- Indexes for system_maps
CREATE INDEX idx_system_maps_org ON system_maps(organization_id);
CREATE INDEX idx_system_maps_business_case ON system_maps(business_case_id);
CREATE INDEX idx_system_maps_status ON system_maps(status);
CREATE INDEX idx_system_maps_type ON system_maps(system_type);
CREATE INDEX idx_system_maps_created_at ON system_maps(created_at DESC);

-- Enable RLS
ALTER TABLE system_maps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view system maps in their organization"
    ON system_maps FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create system maps in their organization"
    ON system_maps FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update system maps in their organization"
    ON system_maps FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- INTERVENTION POINTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS intervention_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    system_map_id UUID NOT NULL REFERENCES system_maps(id) ON DELETE CASCADE,
    
    -- Core attributes
    name TEXT NOT NULL,
    description TEXT,
    intervention_type TEXT NOT NULL CHECK (intervention_type IN (
        'leverage_point', 'constraint_removal', 'feedback_amplification', 
        'feedback_dampening', 'structure_change', 'goal_alignment', 
        'information_flow', 'rule_change', 'paradigm_shift'
    )),
    
    -- Location in system
    target_entity_id TEXT, -- References entity in system_map.entities
    target_relationship_id TEXT, -- References relationship in system_map.relationships
    
    -- Impact assessment
    leverage_level INTEGER CHECK (leverage_level BETWEEN 1 AND 10),
    effort_estimate TEXT CHECK (effort_estimate IN ('low', 'medium', 'high', 'very_high')),
    time_to_impact TEXT CHECK (time_to_impact IN ('immediate', 'short_term', 'medium_term', 'long_term')),
    
    -- Outcome pathways (JSONB)
    outcome_pathways JSONB NOT NULL DEFAULT '[]', -- [{kpi_id, expected_delta, confidence, timeframe}]
    dependencies JSONB DEFAULT '[]', -- [{intervention_id, dependency_type}]
    risks JSONB DEFAULT '[]', -- [{risk_type, description, mitigation}]
    
    -- Validation
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'validated', 'approved', 'implemented', 'measured', 'retired')),
    validation_notes TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for intervention_points
CREATE INDEX idx_intervention_points_org ON intervention_points(organization_id);
CREATE INDEX idx_intervention_points_system_map ON intervention_points(system_map_id);
CREATE INDEX idx_intervention_points_status ON intervention_points(status);
CREATE INDEX idx_intervention_points_type ON intervention_points(intervention_type);
CREATE INDEX idx_intervention_points_leverage ON intervention_points(leverage_level DESC);

-- Enable RLS
ALTER TABLE intervention_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view intervention points in their organization"
    ON intervention_points FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create intervention points in their organization"
    ON intervention_points FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update intervention points in their organization"
    ON intervention_points FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- OUTCOME HYPOTHESES
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome_hypotheses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    system_map_id UUID NOT NULL REFERENCES system_maps(id) ON DELETE CASCADE,
    intervention_point_id UUID REFERENCES intervention_points(id) ON DELETE SET NULL,
    
    -- Core hypothesis
    hypothesis_statement TEXT NOT NULL,
    hypothesis_type TEXT NOT NULL CHECK (hypothesis_type IN (
        'direct_impact', 'indirect_impact', 'systemic_change', 
        'behavior_change', 'feedback_loop', 'emergent_property'
    )),
    
    -- System → KPI → Value bridge
    system_change_description TEXT NOT NULL,
    kpi_deltas JSONB NOT NULL DEFAULT '[]', -- [{kpi_id, baseline, target, timeframe, confidence}]
    value_story TEXT, -- Narrative connecting system change to business value
    
    -- Causal chain
    causal_chain JSONB NOT NULL DEFAULT '[]', -- [{step, description, evidence_type, confidence}]
    assumptions JSONB DEFAULT '[]', -- [{assumption, criticality, validation_method}]
    
    -- Validation
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'validated', 'testing', 'confirmed', 'refuted', 'retired')),
    validation_method TEXT,
    validation_criteria JSONB,
    validation_results JSONB,
    
    -- Confidence scoring
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    evidence_quality TEXT CHECK (evidence_quality IN ('none', 'anecdotal', 'observational', 'experimental', 'proven')),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    validated_by UUID REFERENCES users(id),
    validated_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for outcome_hypotheses
CREATE INDEX idx_outcome_hypotheses_org ON outcome_hypotheses(organization_id);
CREATE INDEX idx_outcome_hypotheses_system_map ON outcome_hypotheses(system_map_id);
CREATE INDEX idx_outcome_hypotheses_intervention ON outcome_hypotheses(intervention_point_id);
CREATE INDEX idx_outcome_hypotheses_status ON outcome_hypotheses(status);
CREATE INDEX idx_outcome_hypotheses_type ON outcome_hypotheses(hypothesis_type);
CREATE INDEX idx_outcome_hypotheses_confidence ON outcome_hypotheses(confidence_score DESC);

-- Enable RLS
ALTER TABLE outcome_hypotheses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view outcome hypotheses in their organization"
    ON outcome_hypotheses FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create outcome hypotheses in their organization"
    ON outcome_hypotheses FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update outcome hypotheses in their organization"
    ON outcome_hypotheses FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- SYSTEMIC RISKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS systemic_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    system_map_id UUID NOT NULL REFERENCES system_maps(id) ON DELETE CASCADE,
    intervention_point_id UUID REFERENCES intervention_points(id) ON DELETE SET NULL,
    
    -- Risk identification
    risk_name TEXT NOT NULL,
    risk_description TEXT NOT NULL,
    risk_type TEXT NOT NULL CHECK (risk_type IN (
        'unintended_consequence', 'feedback_reversal', 'constraint_violation',
        'boundary_breach', 'cascade_failure', 'goal_displacement',
        'metric_gaming', 'system_degradation', 'emergent_harm'
    )),
    
    -- Risk assessment
    likelihood TEXT NOT NULL CHECK (likelihood IN ('very_low', 'low', 'medium', 'high', 'very_high')),
    impact TEXT NOT NULL CHECK (impact IN ('negligible', 'minor', 'moderate', 'major', 'critical')),
    risk_score INTEGER GENERATED ALWAYS AS (
        CASE likelihood
            WHEN 'very_low' THEN 1
            WHEN 'low' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'high' THEN 4
            WHEN 'very_high' THEN 5
        END *
        CASE impact
            WHEN 'negligible' THEN 1
            WHEN 'minor' THEN 2
            WHEN 'moderate' THEN 3
            WHEN 'major' THEN 4
            WHEN 'critical' THEN 5
        END
    ) STORED,
    
    -- Risk details
    affected_entities JSONB DEFAULT '[]', -- [{entity_id, impact_description}]
    trigger_conditions JSONB DEFAULT '[]', -- [{condition, threshold}]
    indicators JSONB DEFAULT '[]', -- [{indicator, measurement_method}]
    
    -- Mitigation
    mitigation_strategy TEXT,
    mitigation_actions JSONB DEFAULT '[]', -- [{action, owner, deadline, status}]
    contingency_plan TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'assessed', 'mitigated', 'monitoring', 'realized', 'closed')),
    
    -- Metadata
    identified_by UUID NOT NULL REFERENCES users(id),
    owner_id UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    realized_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Indexes for systemic_risks
CREATE INDEX idx_systemic_risks_org ON systemic_risks(organization_id);
CREATE INDEX idx_systemic_risks_system_map ON systemic_risks(system_map_id);
CREATE INDEX idx_systemic_risks_intervention ON systemic_risks(intervention_point_id);
CREATE INDEX idx_systemic_risks_status ON systemic_risks(status);
CREATE INDEX idx_systemic_risks_score ON systemic_risks(risk_score DESC);
CREATE INDEX idx_systemic_risks_type ON systemic_risks(risk_type);

-- Enable RLS
ALTER TABLE systemic_risks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view systemic risks in their organization"
    ON systemic_risks FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create systemic risks in their organization"
    ON systemic_risks FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update systemic risks in their organization"
    ON systemic_risks FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- FEEDBACK LOOPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback_loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    system_map_id UUID NOT NULL REFERENCES system_maps(id) ON DELETE CASCADE,
    
    -- Loop identification
    loop_name TEXT NOT NULL,
    loop_description TEXT,
    loop_type TEXT NOT NULL CHECK (loop_type IN ('reinforcing', 'balancing', 'mixed')),
    
    -- Loop structure
    loop_elements JSONB NOT NULL DEFAULT '[]', -- [{entity_id, role, position}]
    loop_path JSONB NOT NULL DEFAULT '[]', -- [{from, to, relationship_type, polarity}]
    delay_points JSONB DEFAULT '[]', -- [{location, delay_type, duration}]
    
    -- Loop dynamics
    dominant_polarity TEXT CHECK (dominant_polarity IN ('positive', 'negative', 'neutral')),
    loop_strength TEXT CHECK (loop_strength IN ('weak', 'moderate', 'strong', 'dominant')),
    time_constant TEXT, -- How long for loop to complete one cycle
    
    -- Realization tracking
    realization_stage TEXT CHECK (realization_stage IN ('designed', 'implementing', 'active', 'measured', 'optimized')),
    behavior_changes JSONB DEFAULT '[]', -- [{entity, behavior_before, behavior_after, evidence}]
    system_updates JSONB DEFAULT '[]', -- [{update_type, description, timestamp, impact}]
    
    -- Measurement
    loop_metrics JSONB DEFAULT '[]', -- [{metric, baseline, current, target}]
    closure_status TEXT CHECK (closure_status IN ('open', 'partial', 'closed', 'broken')),
    closure_evidence TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Indexes for feedback_loops
CREATE INDEX idx_feedback_loops_org ON feedback_loops(organization_id);
CREATE INDEX idx_feedback_loops_system_map ON feedback_loops(system_map_id);
CREATE INDEX idx_feedback_loops_type ON feedback_loops(loop_type);
CREATE INDEX idx_feedback_loops_stage ON feedback_loops(realization_stage);
CREATE INDEX idx_feedback_loops_closure ON feedback_loops(closure_status);

-- Enable RLS
ALTER TABLE feedback_loops ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feedback loops in their organization"
    ON feedback_loops FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create feedback loops in their organization"
    ON feedback_loops FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update feedback loops in their organization"
    ON feedback_loops FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- ACADEMY PROGRESS
-- ============================================================================
CREATE TABLE IF NOT EXISTS academy_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Track information
    track_id TEXT NOT NULL,
    track_name TEXT NOT NULL,
    module_id TEXT NOT NULL,
    module_name TEXT NOT NULL,
    lesson_id TEXT,
    
    -- Progress
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'mastered')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    
    -- Performance
    quiz_score INTEGER CHECK (quiz_score BETWEEN 0 AND 100),
    practical_score INTEGER CHECK (practical_score BETWEEN 0 AND 100),
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
    
    -- Learning artifacts
    notes TEXT,
    artifacts JSONB DEFAULT '[]', -- [{type, content, created_at}]
    
    -- System outcome linkage
    linked_system_maps JSONB DEFAULT '[]', -- [{system_map_id, application_notes}]
    linked_interventions JSONB DEFAULT '[]', -- [{intervention_id, application_notes}]
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT academy_progress_unique UNIQUE (user_id, track_id, module_id, lesson_id)
);

-- Indexes for academy_progress
CREATE INDEX idx_academy_progress_user ON academy_progress(user_id);
CREATE INDEX idx_academy_progress_org ON academy_progress(organization_id);
CREATE INDEX idx_academy_progress_track ON academy_progress(track_id);
CREATE INDEX idx_academy_progress_status ON academy_progress(status);
CREATE INDEX idx_academy_progress_mastery ON academy_progress(mastery_level DESC);

-- Enable RLS
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own academy progress"
    ON academy_progress FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own academy progress"
    ON academy_progress FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own academy progress"
    ON academy_progress FOR UPDATE
    USING (user_id = auth.uid());

-- ============================================================================
-- EXTEND EXISTING TABLES
-- ============================================================================

-- Add system_map_id to kpi_hypotheses
ALTER TABLE kpi_hypotheses 
ADD COLUMN IF NOT EXISTS system_map_id UUID REFERENCES system_maps(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS intervention_point_id UUID REFERENCES intervention_points(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS outcome_hypothesis_id UUID REFERENCES outcome_hypotheses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_hypotheses_system_map ON kpi_hypotheses(system_map_id);
CREATE INDEX IF NOT EXISTS idx_kpi_hypotheses_intervention ON kpi_hypotheses(intervention_point_id);

-- Add intervention_id to value_models (financial_models table)
ALTER TABLE financial_models
ADD COLUMN IF NOT EXISTS intervention_point_id UUID REFERENCES intervention_points(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS system_map_id UUID REFERENCES system_maps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_models_intervention ON financial_models(intervention_point_id);
CREATE INDEX IF NOT EXISTS idx_financial_models_system_map ON financial_models(system_map_id);

-- Add SOF fields to value_commits (value_cases table)
ALTER TABLE value_cases
ADD COLUMN IF NOT EXISTS system_map_id UUID REFERENCES system_maps(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS systemic_outcome_description TEXT,
ADD COLUMN IF NOT EXISTS feedback_loop_ids JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_value_cases_system_map ON value_cases(system_map_id);

-- ============================================================================
-- AUDIT LOG EXTENSIONS
-- ============================================================================

-- Add SOF event types to audit log (if using enum)
-- Note: If audit_log uses TEXT for event_type, no migration needed
-- The application will handle new event types

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_system_maps_updated_at BEFORE UPDATE ON system_maps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intervention_points_updated_at BEFORE UPDATE ON intervention_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outcome_hypotheses_updated_at BEFORE UPDATE ON outcome_hypotheses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_systemic_risks_updated_at BEFORE UPDATE ON systemic_risks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_loops_updated_at BEFORE UPDATE ON feedback_loops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academy_progress_updated_at BEFORE UPDATE ON academy_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Get system map with all related data
CREATE OR REPLACE FUNCTION get_system_map_full(p_system_map_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'system_map', row_to_json(sm.*),
        'intervention_points', (
            SELECT json_agg(row_to_json(ip.*))
            FROM intervention_points ip
            WHERE ip.system_map_id = p_system_map_id
        ),
        'outcome_hypotheses', (
            SELECT json_agg(row_to_json(oh.*))
            FROM outcome_hypotheses oh
            WHERE oh.system_map_id = p_system_map_id
        ),
        'systemic_risks', (
            SELECT json_agg(row_to_json(sr.*))
            FROM systemic_risks sr
            WHERE sr.system_map_id = p_system_map_id
        ),
        'feedback_loops', (
            SELECT json_agg(row_to_json(fl.*))
            FROM feedback_loops fl
            WHERE fl.system_map_id = p_system_map_id
        )
    ) INTO result
    FROM system_maps sm
    WHERE sm.id = p_system_map_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get academy progress summary for user
CREATE OR REPLACE FUNCTION get_academy_progress_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_modules', COUNT(*),
        'completed_modules', COUNT(*) FILTER (WHERE status = 'completed' OR status = 'mastered'),
        'in_progress_modules', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'average_mastery', AVG(mastery_level),
        'tracks', json_agg(DISTINCT track_name)
    ) INTO result
    FROM academy_progress
    WHERE user_id = p_user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE system_maps IS 'System maps capturing entity relationships, loops, constraints, and leverage points for systemic outcome analysis';
COMMENT ON TABLE intervention_points IS 'High-leverage intervention points mapped to KPIs and outcome pathways';
COMMENT ON TABLE outcome_hypotheses IS 'Hypotheses bridging system maps to KPI deltas and value stories';
COMMENT ON TABLE systemic_risks IS 'Systemic risks including unintended consequences and feedback reversals';
COMMENT ON TABLE feedback_loops IS 'Feedback loops tracking Realization → Behavior Change → System Update';
COMMENT ON TABLE academy_progress IS 'User learning progress tied to system outcomes and practical application';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
