-- Fix: Enable RLS on Base Schema Tables
-- Addresses: CRITICAL security issue - user data exposed
-- Issue: Cases, workflows, and messages tables have no RLS protection

BEGIN;

-- Enable RLS on all base tables
ALTER TABLE IF EXISTS public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- Cases: Users own their cases
DROP POLICY IF EXISTS "Users own their cases" ON public.cases;
CREATE POLICY "Users own their cases"
  ON public.cases
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass for cases
CREATE POLICY "Service role full access to cases"
  ON public.cases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Workflows: Users own their workflows
DROP POLICY IF EXISTS "Users own their workflows" ON public.workflows;
CREATE POLICY "Users own their workflows"
  ON public.workflows
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass for workflows
CREATE POLICY "Service role full access to workflows"
  ON public.workflows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Messages: Users own their messages
DROP POLICY IF EXISTS "Users own their messages" ON public.messages;
CREATE POLICY "Users own their messages"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass for messages
CREATE POLICY "Service role full access to messages"
  ON public.messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

-- Verification
DO $$
DECLARE
  missing_rls text[];
BEGIN
  SELECT array_agg(tablename)
  INTO missing_rls
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename IN ('cases', 'workflows', 'messages')
    AND rowsecurity = false;
  
  IF array_length(missing_rls, 1) > 0 THEN
    RAISE EXCEPTION 'RLS not enabled on: %', array_to_string(missing_rls, ', ');
  END IF;
  
  RAISE NOTICE '✅ SUCCESS: RLS enabled on base schema tables (cases, workflows, messages)';
END $$;
