-- Phase 1: Standalone Security Features (No Dependencies)
-- Created: 2024-11-29
-- Can be applied to empty database

-- ============================================================================
-- Password Strength Validation (Public Schema)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_password_strength(password TEXT)
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

COMMENT ON FUNCTION public.validate_password_strength IS 
'Phase 1: Validates password meets complexity requirements';

-- Test the function
DO $$
BEGIN
  ASSERT public.validate_password_strength('weak') = FALSE, 'Weak password should fail';
  ASSERT public.validate_password_strength('StrongPass123!') = TRUE, 'Strong password should pass';
  RAISE NOTICE 'Password validation tests passed!';
END $$;

-- ============================================================================
-- Login Attempt Tracking (Public Schema)
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
'Phase 1: Tracks all login attempts for security monitoring and account lockout';

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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_account_lockout IS 
'Phase 1: Returns true if account is locked (5 failures in 15 minutes)';

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
RETURNS UUID AS $$
DECLARE
  attempt_id UUID;
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
  )
  RETURNING id INTO attempt_id;
  
  RETURN attempt_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.log_login_attempt IS 
'Phase 1: Logs a login attempt for security monitoring';

-- ============================================================================
-- Cleanup Old Login Attempts (90-day retention)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.cleanup_old_login_attempts IS 
'Phase 1: Removes login attempts older than 90 days';

-- ============================================================================
-- Test Data & Verification
-- ============================================================================

-- Test lockout function
DO $$
DECLARE
  is_locked BOOLEAN;
BEGIN
  -- Clean test data
  DELETE FROM public.login_attempts WHERE email = 'test@example.com';
  
  -- Should not be locked initially
  is_locked := public.check_account_lockout('test@example.com');
  ASSERT is_locked = FALSE, 'Account should not be locked initially';
  
  -- Add 5 failed attempts
  FOR i IN 1..5 LOOP
    PERFORM public.log_login_attempt('test@example.com', FALSE, '127.0.0.1', 'test-agent', 'test');
  END LOOP;
  
  -- Should be locked now
  is_locked := public.check_account_lockout('test@example.com');
  ASSERT is_locked = TRUE, 'Account should be locked after 5 failures';
  
  -- Clean up
  DELETE FROM public.login_attempts WHERE email = 'test@example.com';
  
  RAISE NOTICE 'Account lockout tests passed!';
END $$;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 1 Security Features Installed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - validate_password_strength(password TEXT)';
  RAISE NOTICE '  - check_account_lockout(user_email TEXT)';
  RAISE NOTICE '  - log_login_attempt(...)';
  RAISE NOTICE '  - cleanup_old_login_attempts()';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - public.login_attempts';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage Examples:';
  RAISE NOTICE '  SELECT validate_password_strength(''weak'');  -- Returns false';
  RAISE NOTICE '  SELECT validate_password_strength(''StrongPass123!'');  -- Returns true';
  RAISE NOTICE '  SELECT check_account_lockout(''user@example.com'');';
  RAISE NOTICE '';
END $$;
