-- Team Settings Audit Trigger
-- Phase 3: Enhanced Audit Logging
-- 
-- Ensures all Team-tier changes trigger audit logs with old and new values

-- ============================================================================
-- Audit Log Function for Team Settings
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_team_settings_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_changes JSONB;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  -- Build old and new values
  v_old_values := jsonb_build_object(
    'name', OLD.name,
    'team_settings', OLD.team_settings,
    'organization_id', OLD.organization_id
  );

  v_new_values := jsonb_build_object(
    'name', NEW.name,
    'team_settings', NEW.team_settings,
    'organization_id', NEW.organization_id
  );

  -- Calculate changes
  v_changes := jsonb_build_object();

  IF OLD.name IS DISTINCT FROM NEW.name THEN
    v_changes := v_changes || jsonb_build_object(
      'name', jsonb_build_object('old', OLD.name, 'new', NEW.name)
    );
  END IF;

  IF OLD.team_settings IS DISTINCT FROM NEW.team_settings THEN
    v_changes := v_changes || jsonb_build_object(
      'team_settings', jsonb_build_object('old', OLD.team_settings, 'new', NEW.team_settings)
    );
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    changes,
    metadata,
    created_at
  ) VALUES (
    v_user_id,
    'UPDATE',
    'team_settings',
    NEW.id::TEXT,
    v_old_values,
    v_new_values,
    v_changes,
    jsonb_build_object(
      'team_id', NEW.id,
      'team_name', NEW.name,
      'organization_id', NEW.organization_id,
      'changed_fields', jsonb_object_keys(v_changes)
    ),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Create Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS audit_team_settings_updates ON teams;

CREATE TRIGGER audit_team_settings_updates
  AFTER UPDATE ON teams
  FOR EACH ROW
  WHEN (OLD.team_settings IS DISTINCT FROM NEW.team_settings OR OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION audit_team_settings_changes();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION audit_team_settings_changes() IS
  'Audit trigger for team settings changes. Logs old and new values for compliance.';

COMMENT ON TRIGGER audit_team_settings_updates ON teams IS
  'Automatically creates audit log entries for team settings updates.';

-- ============================================================================
-- Index for Team Audit Logs
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_team_settings
  ON audit_logs(resource_type, resource_id, created_at DESC)
  WHERE resource_type = 'team_settings';
