-- Guest Access System
-- Enables external stakeholders to access business cases with limited permissions

-- Create guest_users table
CREATE TABLE IF NOT EXISTS guest_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, organization_id)
);

-- Create guest_access_tokens table
CREATE TABLE IF NOT EXISTS guest_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_user_id UUID NOT NULL REFERENCES guest_users(id) ON DELETE CASCADE,
  value_case_id UUID NOT NULL REFERENCES value_cases(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{"can_view": true, "can_comment": false, "can_edit": false}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create guest_activity_log table
CREATE TABLE IF NOT EXISTS guest_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_user_id UUID NOT NULL REFERENCES guest_users(id) ON DELETE CASCADE,
  guest_access_token_id UUID NOT NULL REFERENCES guest_access_tokens(id) ON DELETE CASCADE,
  value_case_id UUID NOT NULL REFERENCES value_cases(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'access', 'view_element', 'add_comment', 'view_metric', 
    'export_pdf', 'export_excel', 'share_email'
  )),
  activity_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on guest tables
ALTER TABLE guest_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_users
CREATE POLICY "Users can view guest users in their organization"
  ON guest_users FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create guest users in their organization"
  ON guest_users FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update guest users in their organization"
  ON guest_users FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete guest users in their organization"
  ON guest_users FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- RLS policies for guest_access_tokens
CREATE POLICY "Users can view guest tokens for their value cases"
  ON guest_access_tokens FOR SELECT
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create guest tokens for their value cases"
  ON guest_access_tokens FOR INSERT
  WITH CHECK (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update guest tokens for their value cases"
  ON guest_access_tokens FOR UPDATE
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete guest tokens for their value cases"
  ON guest_access_tokens FOR DELETE
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS policies for guest_activity_log
CREATE POLICY "Users can view guest activity for their value cases"
  ON guest_activity_log FOR SELECT
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert guest activity"
  ON guest_activity_log FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_guest_users_email ON guest_users(email);
CREATE INDEX idx_guest_users_organization_id ON guest_users(organization_id);
CREATE INDEX idx_guest_users_created_by ON guest_users(created_by);

CREATE INDEX idx_guest_access_tokens_token ON guest_access_tokens(token);
CREATE INDEX idx_guest_access_tokens_guest_user_id ON guest_access_tokens(guest_user_id);
CREATE INDEX idx_guest_access_tokens_value_case_id ON guest_access_tokens(value_case_id);
CREATE INDEX idx_guest_access_tokens_expires_at ON guest_access_tokens(expires_at);
CREATE INDEX idx_guest_access_tokens_revoked ON guest_access_tokens(revoked);

CREATE INDEX idx_guest_activity_log_guest_user_id ON guest_activity_log(guest_user_id);
CREATE INDEX idx_guest_activity_log_value_case_id ON guest_activity_log(value_case_id);
CREATE INDEX idx_guest_activity_log_created_at ON guest_activity_log(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_guest_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at
CREATE TRIGGER update_guest_users_timestamp
  BEFORE UPDATE ON guest_users
  FOR EACH ROW
  EXECUTE FUNCTION update_guest_timestamp();

CREATE TRIGGER update_guest_access_tokens_timestamp
  BEFORE UPDATE ON guest_access_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_guest_timestamp();

-- Create function to validate guest token
CREATE OR REPLACE FUNCTION validate_guest_token(token_value TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  guest_user_id UUID,
  value_case_id UUID,
  permissions JSONB,
  guest_name TEXT,
  guest_email TEXT,
  error_message TEXT
) AS $$
DECLARE
  token_record RECORD;
  guest_record RECORD;
BEGIN
  -- Find token
  SELECT * INTO token_record
  FROM guest_access_tokens
  WHERE token = token_value;

  -- Check if token exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::JSONB, NULL::TEXT, NULL::TEXT, 'Token not found';
    RETURN;
  END IF;

  -- Check if token is revoked
  IF token_record.revoked THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::JSONB, NULL::TEXT, NULL::TEXT, 'Token has been revoked';
    RETURN;
  END IF;

  -- Check if token is expired
  IF token_record.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::JSONB, NULL::TEXT, NULL::TEXT, 'Token has expired';
    RETURN;
  END IF;

  -- Get guest user info
  SELECT * INTO guest_record
  FROM guest_users
  WHERE id = token_record.guest_user_id;

  -- Update last accessed
  UPDATE guest_access_tokens
  SET 
    last_accessed_at = now(),
    access_count = access_count + 1
  WHERE id = token_record.id;

  -- Return valid token info
  RETURN QUERY SELECT 
    true,
    token_record.guest_user_id,
    token_record.value_case_id,
    token_record.permissions,
    guest_record.name,
    guest_record.email,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke guest token
CREATE OR REPLACE FUNCTION revoke_guest_token(
  token_value TEXT,
  revoked_by_user UUID,
  reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE guest_access_tokens
  SET 
    revoked = true,
    revoked_at = now(),
    revoked_by = revoked_by_user,
    revoke_reason = reason
  WHERE token = token_value;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_guest_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete tokens expired more than 30 days ago
  DELETE FROM guest_access_tokens
  WHERE expires_at < now() - INTERVAL '30 days'
  AND revoked = false;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON guest_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guest_access_tokens TO authenticated;
GRANT SELECT, INSERT ON guest_activity_log TO authenticated;

GRANT EXECUTE ON FUNCTION validate_guest_token TO anon;
GRANT EXECUTE ON FUNCTION revoke_guest_token TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_guest_tokens TO authenticated;

-- Add helpful comments
COMMENT ON TABLE guest_users IS 'External users with limited access to value cases';
COMMENT ON TABLE guest_access_tokens IS 'Magic link tokens for guest access';
COMMENT ON TABLE guest_activity_log IS 'Audit log of guest user activities';
COMMENT ON FUNCTION validate_guest_token IS 'Validates a guest access token and returns user info';
COMMENT ON FUNCTION revoke_guest_token IS 'Revokes a guest access token';
COMMENT ON FUNCTION cleanup_expired_guest_tokens IS 'Removes expired tokens older than 30 days';
