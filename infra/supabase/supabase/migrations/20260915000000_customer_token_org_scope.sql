-- ============================================================================
-- Migration: customer token validation organization scope
--
-- Extends validate_customer_token() to return the owning organization_id along
-- with value_case_id so customer portal handlers can scope every query to the
-- validated tenant boundary.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_customer_token(p_token TEXT)
RETURNS TABLE (
  value_case_id UUID,
  organization_id UUID,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_token_record RECORD;
  v_value_case RECORD;
BEGIN
  SELECT * INTO v_token_record
  FROM public.customer_access_tokens
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Invalid token';
    RETURN;
  END IF;

  IF v_token_record.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Token has been revoked';
    RETURN;
  END IF;

  IF v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Token has expired';
    RETURN;
  END IF;

  SELECT id, organization_id INTO v_value_case
  FROM public.value_cases
  WHERE id = v_token_record.value_case_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Value case not found';
    RETURN;
  END IF;

  UPDATE public.customer_access_tokens
  SET
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE token = p_token;

  RETURN QUERY
  SELECT v_value_case.id, v_value_case.organization_id, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
