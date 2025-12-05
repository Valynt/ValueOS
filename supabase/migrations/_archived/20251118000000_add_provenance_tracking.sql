/*
  # Enhanced Provenance and Lifecycle Audit Trail

  Adds lifecycle_artifact_links and provenance_audit_log tables and
  extends ROI model calculations with input/source metadata for
  end-to-end traceability.
*/

-- Lifecycle chain-of-custody between major artifacts
CREATE TABLE IF NOT EXISTS lifecycle_artifact_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  source_stage text CHECK (source_stage IN ('opportunity', 'target', 'realization', 'expansion')),
  source_type text NOT NULL,
  source_artifact_id uuid NOT NULL,
  target_stage text CHECK (target_stage IN ('opportunity', 'target', 'realization', 'expansion')),
  target_type text NOT NULL,
  target_artifact_id uuid NOT NULL,
  relationship_type text DEFAULT 'derived_from',
  reasoning_trace text,
  chain_depth integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_links_source ON lifecycle_artifact_links(source_artifact_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_links_target ON lifecycle_artifact_links(target_artifact_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_links_session ON lifecycle_artifact_links(session_id);

COMMENT ON TABLE lifecycle_artifact_links IS 'Tracks upstream/downstream relationships between lifecycle artifacts (opportunity → target → realization → expansion).';

-- Immutable provenance audit entries
CREATE TABLE IF NOT EXISTS provenance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  agent_id uuid,
  artifact_type text NOT NULL,
  artifact_id uuid NOT NULL,
  action text NOT NULL,
  reasoning_trace text,
  artifact_data jsonb DEFAULT '{}'::jsonb,
  input_variables jsonb DEFAULT '{}'::jsonb,
  output_snapshot jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provenance_audit_session ON provenance_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_provenance_audit_artifact ON provenance_audit_log(artifact_id, artifact_type);

COMMENT ON TABLE provenance_audit_log IS 'Immutable audit log capturing provenance reasoning, inputs, and outputs for regulated artifacts.';

-- Output-level provenance for ROI model calculations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_model_calculations' AND column_name = 'input_variables'
  ) THEN
    ALTER TABLE roi_model_calculations
      ADD COLUMN input_variables jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN source_references jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN reasoning_trace text;

    COMMENT ON COLUMN roi_model_calculations.input_variables IS 'List of variables and their provenance used by this calculation.';
    COMMENT ON COLUMN roi_model_calculations.source_references IS 'Mapping of inputs to upstream artifacts for lineage tracking.';
    COMMENT ON COLUMN roi_model_calculations.reasoning_trace IS 'LLM reasoning trace used to derive the calculation logic.';
  END IF;
END $$;
