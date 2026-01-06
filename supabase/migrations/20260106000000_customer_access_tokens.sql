-- Customer Access Token System
-- Enables secure, token-based access for customers to view their value realization data

-- Create customer access tokens table
CREATE TABLE IF NOT EXISTS customer_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID NOT NULL REFERENCES value_cases(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT
);

-- Indexes for performance
CREATE INDEX idx_customer_tokens_token ON customer_access_tokens(token);
CREATE INDEX idx_customer_tokens_value_case ON customer_access_tokens(value_case_id);
CREATE INDEX idx_customer_tokens_expires ON customer_access_tokens(expires_at);
CREATE INDEX idx_customer_tokens_active ON customer_access_tokens(expires_at, revoked_at) 
  WHERE revoked_at IS NULL;

-- Function to generate secure random token
CREATE OR REPLACE FUNCTION generate_customer_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create customer access token
CREATE OR REPLACE FUNCTION create_customer_access_token(
  p_value_case_id UUID,
  p_expires_in_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  token TEXT,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Generate unique token
  v_token := generate_customer_token();
  v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
  
  -- Insert token
  INSERT INTO customer_access_tokens (
    value_case_id,
    token,
    expires_at
  ) VALUES (
    p_value_case_id,
    v_token,
    v_expires_at
  );
  
  RETURN QUERY SELECT v_token, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate and track token usage
CREATE OR REPLACE FUNCTION validate_customer_token(p_token TEXT)
RETURNS TABLE (
  value_case_id UUID,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Find token
  SELECT * INTO v_token_record
  FROM customer_access_tokens
  WHERE token = p_token;
  
  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid token';
    RETURN;
  END IF;
  
  -- Token revoked
  IF v_token_record.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Token has been revoked';
    RETURN;
  END IF;
  
  -- Token expired
  IF v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Token has expired';
    RETURN;
  END IF;
  
  -- Update access tracking
  UPDATE customer_access_tokens
  SET 
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE token = p_token;
  
  -- Return valid token
  RETURN QUERY SELECT v_token_record.value_case_id, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke token
CREATE OR REPLACE FUNCTION revoke_customer_token(
  p_token TEXT,
  p_revoked_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE customer_access_tokens
  SET 
    revoked_at = NOW(),
    revoked_by = p_revoked_by,
    revoke_reason = p_reason
  WHERE token = p_token
    AND revoked_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE customer_access_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage tokens for their tenant's value cases
CREATE POLICY customer_tokens_tenant_isolation ON customer_access_tokens
  FOR ALL
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_customer_token() TO authenticated;
GRANT EXECUTE ON FUNCTION create_customer_access_token(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_customer_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION revoke_customer_token(TEXT, UUID, TEXT) TO authenticated;

-- Comments
COMMENT ON TABLE customer_access_tokens IS 'Secure tokens for customer portal access';
COMMENT ON FUNCTION create_customer_access_token IS 'Generate new customer access token';
COMMENT ON FUNCTION validate_customer_token IS 'Validate token and track usage';
COMMENT ON FUNCTION revoke_customer_token IS 'Revoke customer access token';
