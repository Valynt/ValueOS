/*
  # SOF Governance and Audit Integration
  
  Extends existing audit and governance infrastructure to support SOF entities.
  Integrates SOF system maps, interventions, and feedback loops into the
  provenance tracking and lifecycle artifact chain.
*/

-- ============================================================================
-- 1. Extend lifecycle_artifact_links to support SOF stages
-- ============================================================================

-- Add SOF stages to lifecycle chain
ALTER TABLE lifecycle_artifact_links
  DROP CONSTRAINT IF EXISTS lifecycle_artifact_links_source_stage_check,
  DROP CONSTRAINT IF EXISTS lifecycle_artifact_links_target_stage_check;

ALTER TABLE lifecycle_artifact_links
  ADD CONSTRAINT lifecycle_artifact_links_source_stage_check 
    CHECK (source_stage IN ('opportunity', 'target', 'realization', 'expansion', 'integrity')),
  ADD CONSTRAINT lifecycle_artifact_links_target_stage_check 
    CHECK (target_stage IN ('opportunity', 'target', 'realization', 'expansion', 'integrity'));

-- Add SOF-specific relationship types
COMMENT ON COLUMN lifecycle_artifact_links.relationship_type IS 
  'Relationship type: derived_from, mapped_to, intervenes_in, monitors, expands_from, governs';

-- ============================================================================
-- 2. SOF Governance Controls Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sof_governance_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_case_id uuid REFERENCES business_cases(id) ON DELETE CASCADE,
  system_map_id uuid REFERENCES sof_system_maps(id) ON DELETE CASCADE,
  intervention_point_id uuid REFERENCES sof_intervention_points(id) ON DELETE SET NULL,
  
  control_type text NOT NULL CHECK (control_type IN (
    'access_control',
    'data_privacy',
    'ethical_review',
    'risk_mitigation',
    'compliance_check',
    'approval_gate',
    'monitoring_requirement',
    'documentation_requirement'
  )),
  
  control_name text NOT NULL,
  control_description text,
  
  -- Control configuration
  enforcement_level text NOT NULL DEFAULT 'advisory' CHECK (enforcement_level IN (
    'advisory',      -- Recommendation only
    'warning',       -- Warning but allows proceed
    'blocking'       -- Must be satisfied to proceed
  )),
  
  -- Compliance tracking
  compliance_status text NOT NULL DEFAULT 'pending' CHECK (compliance_status IN (
    'pending',
    'compliant',
    'at_risk',
    'non_compliant',
    'waived'
  )),
  
  compliance_evidence jsonb DEFAULT '[]'::jsonb,
  last_reviewed_at timestamptz,
  next_review_due timestamptz,
  
  -- Approval workflow
  requires_approval boolean DEFAULT false,
  approval_status text CHECK (approval_status IN ('pending', 'approved', 'rejected', 'waived')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  approval_notes text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_sof_governance_business_case ON sof_governance_controls(business_case_id);
CREATE INDEX idx_sof_governance_system_map ON sof_governance_controls(system_map_id);
CREATE INDEX idx_sof_governance_intervention ON sof_governance_controls(intervention_point_id);
CREATE INDEX idx_sof_governance_status ON sof_governance_controls(compliance_status);

COMMENT ON TABLE sof_governance_controls IS 'Governance controls applied to SOF system maps and interventions';

-- ============================================================================
-- 3. SOF Audit Events Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sof_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_case_id uuid REFERENCES business_cases(id) ON DELETE CASCADE,
  
  -- SOF entity references
  system_map_id uuid REFERENCES sof_system_maps(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES sof_entities(id) ON DELETE SET NULL,
  relationship_id uuid REFERENCES sof_relationships(id) ON DELETE SET NULL,
  intervention_point_id uuid REFERENCES sof_intervention_points(id) ON DELETE SET NULL,
  outcome_hypothesis_id uuid REFERENCES sof_outcome_hypotheses(id) ON DELETE SET NULL,
  feedback_loop_id uuid REFERENCES sof_feedback_loops(id) ON DELETE SET NULL,
  
  -- Event details
  event_type text NOT NULL CHECK (event_type IN (
    'system_map_created',
    'system_map_updated',
    'entity_added',
    'entity_modified',
    'relationship_added',
    'relationship_modified',
    'intervention_designed',
    'intervention_modified',
    'outcome_hypothesis_created',
    'outcome_hypothesis_validated',
    'feedback_loop_created',
    'feedback_loop_closed',
    'behavior_change_observed',
    'system_update_logged',
    'governance_control_applied',
    'compliance_status_changed'
  )),
  
  event_description text,
  
  -- Change tracking
  previous_state jsonb,
  new_state jsonb,
  change_summary text,
  
  -- Actor information
  actor_type text CHECK (actor_type IN ('user', 'agent', 'system')),
  actor_id uuid,
  agent_name text,
  
  -- Reasoning and provenance
  reasoning_trace text,
  input_data jsonb DEFAULT '{}'::jsonb,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sof_audit_business_case ON sof_audit_events(business_case_id);
CREATE INDEX idx_sof_audit_system_map ON sof_audit_events(system_map_id);
CREATE INDEX idx_sof_audit_event_type ON sof_audit_events(event_type);
CREATE INDEX idx_sof_audit_created_at ON sof_audit_events(created_at DESC);

COMMENT ON TABLE sof_audit_events IS 'Immutable audit trail for all SOF entity changes and system events';

-- ============================================================================
-- 4. Trigger Functions for Automatic Audit Logging
-- ============================================================================

-- Generic audit trigger function for SOF tables
CREATE OR REPLACE FUNCTION log_sof_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type_name text;
  entity_description text;
BEGIN
  -- Determine event type based on operation and table
  IF TG_OP = 'INSERT' THEN
    event_type_name := TG_TABLE_NAME || '_created';
  ELSIF TG_OP = 'UPDATE' THEN
    event_type_name := TG_TABLE_NAME || '_updated';
  ELSIF TG_OP = 'DELETE' THEN
    event_type_name := TG_TABLE_NAME || '_deleted';
  END IF;

  -- Map table names to audit event types
  event_type_name := CASE TG_TABLE_NAME
    WHEN 'sof_system_maps' THEN 
      CASE TG_OP
        WHEN 'INSERT' THEN 'system_map_created'
        WHEN 'UPDATE' THEN 'system_map_updated'
        ELSE event_type_name
      END
    WHEN 'sof_entities' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN 'entity_added'
        WHEN 'UPDATE' THEN 'entity_modified'
        ELSE event_type_name
      END
    WHEN 'sof_relationships' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN 'relationship_added'
        WHEN 'UPDATE' THEN 'relationship_modified'
        ELSE event_type_name
      END
    WHEN 'sof_intervention_points' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN 'intervention_designed'
        WHEN 'UPDATE' THEN 'intervention_modified'
        ELSE event_type_name
      END
    WHEN 'sof_outcome_hypotheses' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN 'outcome_hypothesis_created'
        WHEN 'UPDATE' THEN 'outcome_hypothesis_validated'
        ELSE event_type_name
      END
    WHEN 'sof_feedback_loops' THEN
      CASE TG_OP
        WHEN 'INSERT' THEN 'feedback_loop_created'
        WHEN 'UPDATE' THEN 
          CASE 
            WHEN NEW.closure_status = 'closed' AND (OLD.closure_status IS NULL OR OLD.closure_status != 'closed')
            THEN 'feedback_loop_closed'
            ELSE 'feedback_loop_created'
          END
        ELSE event_type_name
      END
    ELSE event_type_name
  END;

  -- Insert audit event
  INSERT INTO sof_audit_events (
    business_case_id,
    system_map_id,
    entity_id,
    relationship_id,
    intervention_point_id,
    outcome_hypothesis_id,
    feedback_loop_id,
    event_type,
    event_description,
    previous_state,
    new_state,
    actor_type,
    metadata
  ) VALUES (
    COALESCE(NEW.business_case_id, OLD.business_case_id),
    CASE TG_TABLE_NAME
      WHEN 'sof_system_maps' THEN COALESCE(NEW.id, OLD.id)
      ELSE COALESCE(NEW.system_map_id, OLD.system_map_id)
    END,
    CASE WHEN TG_TABLE_NAME = 'sof_entities' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'sof_relationships' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'sof_intervention_points' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'sof_outcome_hypotheses' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'sof_feedback_loops' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    event_type_name,
    TG_OP || ' on ' || TG_TABLE_NAME,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
    'system',
    jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Apply Audit Triggers to SOF Tables
-- ============================================================================

DROP TRIGGER IF EXISTS audit_sof_system_maps ON sof_system_maps;
CREATE TRIGGER audit_sof_system_maps
  AFTER INSERT OR UPDATE OR DELETE ON sof_system_maps
  FOR EACH ROW EXECUTE FUNCTION log_sof_audit_event();

DROP TRIGGER IF EXISTS audit_sof_entities ON sof_entities;
CREATE TRIGGER audit_sof_entities
  AFTER INSERT OR UPDATE OR DELETE ON sof_entities
  FOR EACH ROW EXECUTE FUNCTION log_sof_audit_event();

DROP TRIGGER IF EXISTS audit_sof_relationships ON sof_relationships;
CREATE TRIGGER audit_sof_relationships
  AFTER INSERT OR UPDATE OR DELETE ON sof_relationships
  FOR EACH ROW EXECUTE FUNCTION log_sof_audit_event();

DROP TRIGGER IF EXISTS audit_sof_intervention_points ON sof_intervention_points;
CREATE TRIGGER audit_sof_intervention_points
  AFTER INSERT OR UPDATE OR DELETE ON sof_intervention_points
  FOR EACH ROW EXECUTE FUNCTION log_sof_audit_event();

DROP TRIGGER IF EXISTS audit_sof_outcome_hypotheses ON sof_outcome_hypotheses;
CREATE TRIGGER audit_sof_outcome_hypotheses
  AFTER INSERT OR UPDATE OR DELETE ON sof_outcome_hypotheses
  FOR EACH ROW EXECUTE FUNCTION log_sof_audit_event();

DROP TRIGGER IF EXISTS audit_sof_feedback_loops ON sof_feedback_loops;
CREATE TRIGGER audit_sof_feedback_loops
  AFTER INSERT OR UPDATE OR DELETE ON sof_feedback_loops
  FOR EACH ROW EXECUTE FUNCTION log_sof_audit_event();

-- ============================================================================
-- 6. RLS Policies for Governance and Audit Tables
-- ============================================================================

ALTER TABLE sof_governance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE sof_audit_events ENABLE ROW LEVEL SECURITY;

-- Governance controls: users can view controls for their business cases
CREATE POLICY "Users can view governance controls for their business cases"
  ON sof_governance_controls FOR SELECT
  USING (
    business_case_id IN (
      SELECT id FROM business_cases
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Governance controls: admins can manage controls
CREATE POLICY "Admins can manage governance controls"
  ON sof_governance_controls FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN business_cases bc ON bc.organization_id = om.organization_id
      WHERE bc.id = business_case_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  );

-- Audit events: users can view audit events for their business cases
CREATE POLICY "Users can view audit events for their business cases"
  ON sof_audit_events FOR SELECT
  USING (
    business_case_id IN (
      SELECT id FROM business_cases
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Audit events: system can insert (no user updates/deletes - immutable)
CREATE POLICY "System can insert audit events"
  ON sof_audit_events FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 7. Helper Functions for Governance
-- ============================================================================

-- Check if business case meets governance requirements
CREATE OR REPLACE FUNCTION check_sof_governance_compliance(
  p_business_case_id uuid
)
RETURNS TABLE (
  is_compliant boolean,
  blocking_controls integer,
  at_risk_controls integer,
  non_compliant_controls integer,
  details jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    NOT EXISTS (
      SELECT 1 FROM sof_governance_controls
      WHERE business_case_id = p_business_case_id
        AND enforcement_level = 'blocking'
        AND compliance_status IN ('non_compliant', 'at_risk')
    ) as is_compliant,
    COUNT(*) FILTER (
      WHERE enforcement_level = 'blocking' 
        AND compliance_status IN ('non_compliant', 'at_risk')
    )::integer as blocking_controls,
    COUNT(*) FILTER (WHERE compliance_status = 'at_risk')::integer as at_risk_controls,
    COUNT(*) FILTER (WHERE compliance_status = 'non_compliant')::integer as non_compliant_controls,
    jsonb_agg(
      jsonb_build_object(
        'control_name', control_name,
        'control_type', control_type,
        'compliance_status', compliance_status,
        'enforcement_level', enforcement_level
      )
    ) FILTER (WHERE compliance_status != 'compliant') as details
  FROM sof_governance_controls
  WHERE business_case_id = p_business_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get audit trail for a specific SOF entity
CREATE OR REPLACE FUNCTION get_sof_entity_audit_trail(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  event_description text,
  actor_type text,
  change_summary text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id as event_id,
    sof_audit_events.event_type,
    sof_audit_events.event_description,
    sof_audit_events.actor_type,
    sof_audit_events.change_summary,
    sof_audit_events.created_at
  FROM sof_audit_events
  WHERE
    CASE p_entity_type
      WHEN 'system_map' THEN system_map_id = p_entity_id
      WHEN 'entity' THEN entity_id = p_entity_id
      WHEN 'relationship' THEN relationship_id = p_entity_id
      WHEN 'intervention' THEN intervention_point_id = p_entity_id
      WHEN 'outcome' THEN outcome_hypothesis_id = p_entity_id
      WHEN 'feedback_loop' THEN feedback_loop_id = p_entity_id
      ELSE false
    END
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Integration with Lifecycle Artifact Links
-- ============================================================================

-- Function to create lifecycle link when SOF entities are created
CREATE OR REPLACE FUNCTION create_sof_lifecycle_link(
  p_source_stage text,
  p_source_type text,
  p_source_id uuid,
  p_target_stage text,
  p_target_type text,
  p_target_id uuid,
  p_relationship_type text DEFAULT 'derived_from',
  p_reasoning_trace text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_link_id uuid;
BEGIN
  INSERT INTO lifecycle_artifact_links (
    source_stage,
    source_type,
    source_artifact_id,
    target_stage,
    target_type,
    target_artifact_id,
    relationship_type,
    reasoning_trace
  ) VALUES (
    p_source_stage,
    p_source_type,
    p_source_id,
    p_target_stage,
    p_target_type,
    p_target_id,
    p_relationship_type,
    p_reasoning_trace
  )
  RETURNING id INTO v_link_id;
  
  RETURN v_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_sof_lifecycle_link IS 'Create lifecycle artifact link for SOF entities';

-- ============================================================================
-- 9. Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sof_governance_enforcement 
  ON sof_governance_controls(enforcement_level, compliance_status);

CREATE INDEX IF NOT EXISTS idx_sof_audit_actor 
  ON sof_audit_events(actor_type, actor_id);

CREATE INDEX IF NOT EXISTS idx_lifecycle_links_sof_stages 
  ON lifecycle_artifact_links(source_stage, target_stage)
  WHERE source_stage IN ('opportunity', 'target', 'realization', 'expansion', 'integrity');
