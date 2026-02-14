BEGIN;

-- Repair JWT-claim-only tenant policies with membership-aware checks.
DROP POLICY IF EXISTS usage_policies_service_role ON public.usage_policies;
DROP POLICY IF EXISTS billing_approval_policies_service_role ON public.billing_approval_policies;
DROP POLICY IF EXISTS billing_approval_requests_service_role ON public.billing_approval_requests;
DROP POLICY IF EXISTS entitlement_snapshots_service_role ON public.entitlement_snapshots;
DROP POLICY IF EXISTS academy_progress_service_role ON public.academy_progress;
DROP POLICY IF EXISTS academy_certifications_service_role ON public.academy_certifications;
DROP POLICY IF EXISTS user_profile_directory_authenticated ON public.user_profile_directory;
DROP POLICY IF EXISTS user_profile_directory_service_role ON public.user_profile_directory;

DROP POLICY IF EXISTS usage_policies_tenant ON public.usage_policies;
DROP POLICY IF EXISTS billing_approval_policies_tenant ON public.billing_approval_policies;
DROP POLICY IF EXISTS billing_approval_requests_tenant ON public.billing_approval_requests;
DROP POLICY IF EXISTS entitlement_snapshots_tenant ON public.entitlement_snapshots;

CREATE POLICY usage_policies_tenant_member ON public.usage_policies
  FOR ALL TO authenticated
  USING (tenant_id::text = ANY(public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id::text = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY billing_approval_policies_tenant_member ON public.billing_approval_policies
  FOR ALL TO authenticated
  USING (tenant_id::text = ANY(public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id::text = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY billing_approval_requests_tenant_member ON public.billing_approval_requests
  FOR ALL TO authenticated
  USING (tenant_id::text = ANY(public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id::text = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY entitlement_snapshots_tenant_member ON public.entitlement_snapshots
  FOR SELECT TO authenticated
  USING (tenant_id::text = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY usage_policies_service_role ON public.usage_policies
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY billing_approval_policies_service_role ON public.billing_approval_policies
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY billing_approval_requests_service_role ON public.billing_approval_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY entitlement_snapshots_service_role ON public.entitlement_snapshots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure explicit service-role exceptions on academy tables.
CREATE POLICY academy_progress_service_role ON public.academy_progress
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY academy_certifications_service_role ON public.academy_certifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add missing RLS coverage for user_profile_directory.
ALTER TABLE public.user_profile_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profile_directory_authenticated ON public.user_profile_directory
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

CREATE POLICY user_profile_directory_service_role ON public.user_profile_directory
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


COMMIT;
