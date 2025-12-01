-- Phase 2: Approval System for Agent Actions
-- Created: 2024-11-29
-- Implements approval workflow and dual control for high-risk agent operations

-- ============================================================================
-- Approval Requests Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request details
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  task_id TEXT,
  action TEXT NOT NULL,
  description TEXT,
  
  -- Cost and risk assessment
  estimated_cost DECIMAL(10, 2),
  is_destructive BOOLEAN DEFAULT FALSE,
  involves_data_export BOOLEAN DEFAULT FALSE,
  requires_dual_control BOOLEAN DEFAULT FALSE,
  
  -- Requester info
  requester_id UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status tracking
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')) DEFAULT 'pending',
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_agent ON public.approval_requests(agent_name);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created ON public.approval_requests(created_at);

COMMENT ON TABLE public.approval_requests IS 
'Phase 2: Stores requests for human approval of agent actions';

-- ============================================================================
-- Approvals Table (tracks individual approvals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to request
  request_id UUID REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  
  -- Approver info
  approver_id UUID REFERENCES auth.users(id),
  approver_email TEXT,
  approver_role TEXT,
  
  -- Second approver (for dual control)
  second_approver_id UUID REFERENCES auth.users(id),
  second_approver_email TEXT,
  
  -- Decision
  decision TEXT CHECK (decision IN ('approved', 'rejected')) NOT NULL,
  notes TEXT,
  
  -- Timestamps
  approved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_request ON public.approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON public.approvals(approver_id);

COMMENT ON TABLE public.approvals IS 
'Phase 2: Records approval decisions (including dual control)';

-- ============================================================================
-- Approver Roles Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approver_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL,
  
  -- Permissions
  can_approve_high_cost BOOLEAN DEFAULT FALSE,
  can_approve_destructive BOOLEAN DEFAULT FALSE,
  can_approve_data_export BOOLEAN DEFAULT FALSE,
  max_approval_amount DECIMAL(10, 2),
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approver_roles_user ON public.approver_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_approver_roles_active ON public.approver_roles(active);

COMMENT ON TABLE public.approver_roles IS 
'Phase 2: Defines who can approve what types of requests';

-- ============================================================================
-- Functions
-- ============================================================================

-- Create approval request
CREATE OR REPLACE FUNCTION public.create_approval_request(
  p_agent_name TEXT,
  p_action TEXT,
  p_description TEXT,
  p_estimated_cost DECIMAL,
  p_is_destructive BOOLEAN,
  p_involves_data_export BOOLEAN,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  request_id UUID;
  requires_dual BOOLEAN;
BEGIN
  -- Determine if dual control is required
  requires_dual := (p_estimated_cost > 100) OR p_action IN (
    'DELETE_USER', 'PURGE_DATABASE', 'MODIFY_BILLING', 'GRANT_ADMIN_ACCESS'
  );
  
  INSERT INTO public.approval_requests (
    agent_name,
    action,
    description,
    estimated_cost,
    is_destructive,
    involves_data_export,
    requires_dual_control,
    requester_id,
    metadata
  ) VALUES (
    p_agent_name,
    p_action,
    p_description,
    p_estimated_cost,
    p_is_destructive,
    p_involves_data_export,
    requires_dual,
    auth.uid(),
    p_metadata
  )
  RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_approval_request IS 
'Phase 2: Creates a new approval request for an agent action';

-- Approve request
CREATE OR REPLACE FUNCTION public.approve_request(
  p_request_id UUID,
  p_second_approver_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  request RECORD;
  approver_valid BOOLEAN;
  existing_approval UUID;
BEGIN
  -- Get request details
  SELECT * INTO request
  FROM public.approval_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;
  
  -- Check if request has expired
  IF request.expires_at < NOW() THEN
    UPDATE public.approval_requests
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_request_id;
    
    RAISE EXCEPTION 'Request has expired';
  END IF;
  
  -- Check if approver has permission
  SELECT EXISTS (
    SELECT 1 FROM public.approver_roles
    WHERE user_id = auth.uid()
      AND active = TRUE
      AND (
        (request.estimated_cost <= max_approval_amount) OR
        (can_approve_high_cost AND request.estimated_cost > 100) OR
        (can_approve_destructive AND request.is_destructive) OR
        (can_approve_data_export AND request.involves_data_export)
      )
  ) INTO approver_valid;
  
  IF NOT approver_valid THEN
    RAISE EXCEPTION 'User does not have permission to approve this request';
  END IF;
  
  -- Check dual control requirement
  IF request.requires_dual_control AND p_second_approver_email IS NULL THEN
    RAISE EXCEPTION 'This request requires dual control (second approver)';
  END IF;
  
  -- Check if already approved
  SELECT id INTO existing_approval
  FROM public.approvals
  WHERE request_id = p_request_id;
  
  IF existing_approval IS NOT NULL THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;
  
  -- Record approval
  INSERT INTO public.approvals (
    request_id,
    approver_id,
    approver_email,
    second_approver_email,
    decision,
    notes
  ) VALUES (
    p_request_id,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    p_second_approver_email,
    'approved',
    p_notes
  );
  
  -- Update request status
  UPDATE public.approval_requests
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.approve_request IS 
'Phase 2: Approves an approval request (with dual control check)';

-- Reject request
CREATE OR REPLACE FUNCTION public.reject_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if request exists and is pending
  IF NOT EXISTS (
    SELECT 1 FROM public.approval_requests
    WHERE id = p_request_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;
  
  -- Record rejection
  INSERT INTO public.approvals (
    request_id,
    approver_id,
    approver_email,
    decision,
    notes
  ) VALUES (
    p_request_id,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'rejected',
    p_notes
  );
  
  -- Update request status
  UPDATE public.approval_requests
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.reject_request IS 
'Phase 2: Rejects an approval request';

-- Cleanup expired requests
CREATE OR REPLACE FUNCTION public.cleanup_expired_approval_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.approval_requests
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.cleanup_expired_approval_requests IS 
'Phase 2: Marks expired approval requests';

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approver_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "users_can_view_own_requests"
  ON public.approval_requests FOR SELECT
  USING (requester_id = auth.uid());

-- Approvers can see pending requests
CREATE POLICY "approvers_can_view_pending"
  ON public.approval_requests FOR SELECT
  USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM public.approver_roles
      WHERE user_id = auth.uid() AND active = TRUE
    )
  );

-- Approvals are viewable by approvers and requesters
CREATE POLICY "approvals_viewable_by_stakeholders"
  ON public.approvals FOR SELECT
  USING (
    approver_id = auth.uid() OR
    request_id IN (
      SELECT id FROM public.approval_requests WHERE requester_id = auth.uid()
    )
  );

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 2 Approval System Installed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - approval_requests';
  RAISE NOTICE '  - approvals';
  RAISE NOTICE '  - approver_roles';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - create_approval_request(...)';
  RAISE NOTICE '  - approve_request(request_id, second_approver, notes)';
  RAISE NOTICE '  - reject_request(request_id, notes)';
  RAISE NOTICE '  - cleanup_expired_approval_requests()';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies applied for data isolation';
  RAISE NOTICE '';
END $$;
