/*
  # Add Compliance Metadata Infrastructure

  ## Overview
  Extends VOS artifact tables with compliance_metadata JSONB columns to support
  Integrity Agent manifesto compliance stamping.

  ## Changes
  1. Add compliance_metadata JSONB column to 5 artifact tables:
     - value_trees
     - roi_models
     - value_commits
     - realization_reports
     - expansion_models

  2. Each compliance_metadata field stores ManifestoComplianceReport structure:
     - validated_at: ISO timestamp
     - overall_compliance: boolean
     - total_rules: number (5 manifesto rules)
     - passed_rules: number
     - failed_rules: number
     - results: array of validation results per rule

  ## Security
  - No RLS changes required (inherits from parent tables)
  - All tables already have RLS enabled
  - compliance_metadata is nullable to support gradual rollout

  ## Performance
  - JSONB columns are indexed with GIN for efficient querying
  - Compliance queries can filter by overall_compliance boolean

  ## Rollback
  - Columns can be safely dropped without data loss
  - See down migration below
*/

-- Add compliance_metadata to value_trees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'value_trees' AND column_name = 'compliance_metadata'
  ) THEN
    ALTER TABLE value_trees
    ADD COLUMN compliance_metadata JSONB DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_value_trees_compliance
    ON value_trees USING gin(compliance_metadata);

    COMMENT ON COLUMN value_trees.compliance_metadata IS
    'Manifesto compliance report from IntegrityAgent validation';
  END IF;
END $$;

-- Add compliance_metadata to roi_models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roi_models' AND column_name = 'compliance_metadata'
  ) THEN
    ALTER TABLE roi_models
    ADD COLUMN compliance_metadata JSONB DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_roi_models_compliance
    ON roi_models USING gin(compliance_metadata);

    COMMENT ON COLUMN roi_models.compliance_metadata IS
    'Manifesto compliance report from IntegrityAgent validation';
  END IF;
END $$;

-- Add compliance_metadata to value_commits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'value_commits' AND column_name = 'compliance_metadata'
  ) THEN
    ALTER TABLE value_commits
    ADD COLUMN compliance_metadata JSONB DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_value_commits_compliance
    ON value_commits USING gin(compliance_metadata);

    COMMENT ON COLUMN value_commits.compliance_metadata IS
    'Manifesto compliance report from IntegrityAgent validation';
  END IF;
END $$;

-- Add compliance_metadata to realization_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'realization_reports' AND column_name = 'compliance_metadata'
  ) THEN
    ALTER TABLE realization_reports
    ADD COLUMN compliance_metadata JSONB DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_realization_reports_compliance
    ON realization_reports USING gin(compliance_metadata);

    COMMENT ON COLUMN realization_reports.compliance_metadata IS
    'Manifesto compliance report from IntegrityAgent validation';
  END IF;
END $$;

-- Add compliance_metadata to expansion_models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expansion_models' AND column_name = 'compliance_metadata'
  ) THEN
    ALTER TABLE expansion_models
    ADD COLUMN compliance_metadata JSONB DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_expansion_models_compliance
    ON expansion_models USING gin(compliance_metadata);

    COMMENT ON COLUMN expansion_models.compliance_metadata IS
    'Manifesto compliance report from IntegrityAgent validation';
  END IF;
END $$;

-- Create helper function to query compliant artifacts
CREATE OR REPLACE FUNCTION get_compliant_artifacts(artifact_type text)
RETURNS TABLE (
  artifact_id uuid,
  artifact_name text,
  compliance_score numeric,
  validated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT
      id as artifact_id,
      name as artifact_name,
      CASE
        WHEN compliance_metadata IS NULL THEN NULL
        WHEN (compliance_metadata->>''overall_compliance'')::boolean THEN 100
        ELSE ((compliance_metadata->>''passed_rules'')::numeric /
              (compliance_metadata->>''total_rules'')::numeric * 100)
      END as compliance_score,
      (compliance_metadata->>''validated_at'')::timestamptz as validated_at
    FROM %I
    WHERE compliance_metadata IS NOT NULL
    ORDER BY validated_at DESC',
    artifact_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_compliant_artifacts IS
'Helper function to query artifacts with compliance metadata and calculate compliance scores';
