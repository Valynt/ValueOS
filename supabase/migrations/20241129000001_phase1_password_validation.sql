-- Phase 1: Password Validation and Security Functions
-- Created: 2024-11-29

-- ============================================================================
-- Password Strength Validation
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_password_strength(password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    LENGTH(password) >= 12
    AND password ~ '[A-Z]'          -- At least one uppercase
    AND password ~ '[a-z]'          -- At least one lowercase
    AND password ~ '[0-9]'          -- At least one number
    AND password ~ '[!@#$%^&*(),.?":{}|<>]'  -- At least one special char
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_password_strength IS 
'Validates password meets complexity requirements: 12+ chars, uppercase, lowercase, number, special char';

-- ============================================================================
-- Login Attempt Tracking (for account lockout)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON auth.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_timestamp ON auth.login_attempts(attempted_at);

COMMENT ON TABLE auth.login_attempts IS 
'Tracks all login attempts for security monitoring and account lockout';

-- ============================================================================
-- Account Lockout Check
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.check_account_lockout(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  failed_attempts INT;
  lockout_duration INTERVAL := '15 minutes';
  max_attempts INT := 5;
BEGIN
  SELECT COUNT(*)
  INTO failed_attempts
  FROM auth.login_attempts
  WHERE email = user_email
    AND success = FALSE
    AND attempted_at > NOW() - lockout_duration;
  
  RETURN failed_attempts >= max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auth.check_account_lockout IS 
'Returns true if account is locked due to too many failed login attempts (5 failures in 15 minutes)';

-- ============================================================================
-- Log Login Attempt
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.log_login_attempt(
  user_email TEXT,
  attempt_success BOOLEAN,
  client_ip INET DEFAULT NULL,
  client_user_agent TEXT DEFAULT NULL,
  reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  attempt_id UUID;
BEGIN
  INSERT INTO auth.login_attempts (
    email,
    success,
    ip_address,
    user_agent,
    failure_reason
  ) VALUES (
    user_email,
    attempt_success,
    client_ip,
    client_user_agent,
    reason
  )
  RETURNING id INTO attempt_id;
  
  RETURN attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auth.log_login_attempt IS 
'Logs a login attempt for security monitoring';

-- ============================================================================
-- Cleanup Old Login Attempts (retention: 90 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM auth.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auth.cleanup_old_login_attempts IS 
'Removes login attempts older than 90 days';
