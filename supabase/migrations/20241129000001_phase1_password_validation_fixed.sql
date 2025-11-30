-- Phase 1: Password Validation & Account Security (Fixed)
-- Created: 2024-11-29
-- FIXED: Uses public schema instead of auth schema

-- ============================================================================
-- Password Validation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_password_strength(password TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  errors TEXT[]
) AS $$
DECLARE
  error_list TEXT[] := ARRAY[]::TEXT[];
  valid BOOLEAN := TRUE;
BEGIN
  -- Check minimum length
  IF LENGTH(password) < 12 THEN
    error_list := array_append(error_list, 'Password must be at least 12 characters long');
    valid := FALSE;
  END IF;
  
  -- Check for uppercase letter
  IF password !~ '[A-Z]' THEN
    error_list := array_append(error_list, 'Password must contain at least one uppercase letter');
    valid := FALSE;
  END IF;
  
  -- Check for lowercase letter
  IF password !~ '[a-z]' THEN
    error_list := array_append(error_list, 'Password must contain at least one lowercase letter');
    valid := FALSE;
  END IF;
  
  -- Check for number
  IF password !~ '[0-9]' THEN
    error_list := array_append(error_list, 'Password must contain at least one number');
    valid := FALSE;
  END IF;
  
  -- Check for special character
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    error_list := array_append(error_list, 'Password must contain at least one special character');
    valid := FALSE;
  END IF;
  
  RETURN QUERY SELECT valid, error_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.validate_password_strength IS 
'Validates password strength according to security requirements: min 12 chars, uppercase, lowercase, number, special char';

-- ============================================================================
-- Login Attempts Tracking (Public Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_timestamp ON public.login_attempts(attempted_at);

COMMENT ON TABLE public.login_attempts IS 
'Tracks all login attempts for security monitoring and account lockout';

-- ============================================================================
-- Account Lockout Check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_account_lockout(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  failed_attempts INT;
  lockout_duration INTERVAL := '15 minutes';
  max_attempts INT := 5;
BEGIN
  SELECT COUNT(*)
  INTO failed_attempts
  FROM public.login_attempts
  WHERE email = user_email
    AND success = FALSE
    AND attempted_at > NOW() - lockout_duration;
  
  RETURN failed_attempts >= max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_account_lockout IS 
'Returns true if account is locked due to too many failed login attempts (5 failures in 15 minutes)';

-- ============================================================================
-- Log Login Attempt
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_login_attempt(
  user_email TEXT,
  attempt_success BOOLEAN,
  client_ip INET DEFAULT NULL,
  client_user_agent TEXT DEFAULT NULL,
  reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.login_attempts (
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
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_login_attempt IS 
'Logs a login attempt with IP address and user agent information';

-- ============================================================================
-- Cleanup Old Login Attempts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_login_attempts IS 
'Removes login attempts older than 90 days for compliance and performance';

-- Grant permissions
GRANT SELECT ON public.login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_password_strength TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_account_lockout TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_attempt TO authenticated;
