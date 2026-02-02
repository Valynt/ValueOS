-- Update guest token validation to include expiration timestamp
CREATE OR REPLACE FUNCTION validate_guest_token(token_value TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  guest_user_id UUID,
  value_case_id UUID,
  permissions JSONB,
  guest_name TEXT,
  guest_email TEXT,
  expires_at TIMESTAMPTZ,
  error_message TEXT
) AS $$
DECLARE
  token_record RECORD;
  guest_record RECORD;
BEGIN
  SELECT * INTO token_record
  FROM guest_access_tokens
  WHERE token = token_value;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::JSONB, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Token not found';
    RETURN;
  END IF;

  IF token_record.revoked THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::JSONB, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Token has been revoked';
    RETURN;
  END IF;

  IF token_record.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::JSONB, NULL::TEXT, NULL::TEXT, token_record.expires_at, 'Token has expired';
    RETURN;
  END IF;

  SELECT * INTO guest_record
  FROM guest_users
  WHERE id = token_record.guest_user_id;

  UPDATE guest_access_tokens
  SET
    last_accessed_at = now(),
    access_count = access_count + 1
  WHERE id = token_record.id;

  RETURN QUERY SELECT
    true,
    token_record.guest_user_id,
    token_record.value_case_id,
    token_record.permissions,
    guest_record.name,
    guest_record.email,
    token_record.expires_at,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_guest_token IS 'Validates a guest access token and returns user info with expiration';
