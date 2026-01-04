-- Audit Log Anonymization Trigger
-- Purpose: Anonymize user_id in audit logs after user deletion
-- Compliance: GDPR Article 17, SOC2 CC6.8

-- Function to anonymize audit logs on user deletion
CREATE OR REPLACE FUNCTION anonymize_audit_logs_on_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Anonymize user_id in security_audit_events
  UPDATE security_audit_events
  SET user_id = '[DELETED-' || SUBSTRING(OLD.id::TEXT FROM 1 FOR 8) || ']',
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{anonymized_at}',
        to_jsonb(NOW())
      ),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{original_user_email}',
        to_jsonb('[REDACTED]')
      )
  WHERE user_id = OLD.id::TEXT;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (runs after legal hold check)
CREATE TRIGGER anonymize_audit_logs_after_user_delete
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_audit_logs_on_user_deletion();

COMMENT ON FUNCTION anonymize_audit_logs_on_user_deletion IS 'Anonymizes audit logs when user is deleted while preserving audit trail';
