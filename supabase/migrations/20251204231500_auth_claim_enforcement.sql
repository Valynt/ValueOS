-- Enforce MFA + breach claims on profile updates
BEGIN;

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users require MFA + clean password to update profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'mfa_verified')::boolean, false) = true
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'password_breached')::boolean, false) = false
  )
  WITH CHECK (
    auth.uid() = id
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'mfa_verified')::boolean, false) = true
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'password_breached')::boolean, false) = false
  );

COMMENT ON POLICY "Users require MFA + clean password to update profile" ON public.users
  IS 'Blocks profile updates when MFA is not verified or a breached password is flagged via JWT claims.';

COMMIT;
