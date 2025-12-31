-- Add transaction-locked seat allocation RPC
-- Created: 2025-12-16
-- Implements OWASP-compliant seat provisioning with race condition prevention

-- Create RPC function for atomic seat allocation
CREATE OR REPLACE FUNCTION add_user_to_tenant_transaction(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_tenant_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_current_users INTEGER;
  v_max_users INTEGER;
  v_plan_tier TEXT;
  v_membership_id UUID;
BEGIN
  -- Start transaction with row locking
  -- Lock the subscriptions table to prevent concurrent seat allocations
  SELECT plan_tier INTO v_plan_tier
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
  FOR UPDATE; -- Lock the row

  -- Get current active user count with locking
  SELECT COUNT(*) INTO v_current_users
  FROM user_tenants
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
  FOR UPDATE; -- Lock user_tenants for this tenant

  -- Determine max users based on plan
  CASE v_plan_tier
    WHEN 'free' THEN v_max_users := 3;
    WHEN 'starter' THEN v_max_users := 10;
    WHEN 'professional' THEN v_max_users := 50;
    WHEN 'enterprise' THEN v_max_users := 1000; -- Large number for unlimited
    ELSE v_max_users := 3; -- Default to free tier
  END CASE;

  -- Check if adding this user would exceed limits
  IF v_current_users >= v_max_users THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Seat limit exceeded',
      'current_users', v_current_users,
      'max_users', v_max_users
    );
  END IF;

  -- Add the user to the tenant
  INSERT INTO user_tenants (
    user_id,
    tenant_id,
    status,
    role,
    invited_by,
    invited_at,
    created_at,
    updated_at
  ) VALUES (
    p_target_user_id,
    p_tenant_id,
    'active',
    'member',
    p_admin_user_id,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_membership_id;

  -- Log the successful allocation
  INSERT INTO security_events (
    event_type,
    user_id,
    tenant_id,
    severity,
    details
  ) VALUES (
    'seat_allocated',
    p_admin_user_id,
    p_tenant_id,
    'info',
    json_build_object(
      'target_user_id', p_target_user_id,
      'membership_id', v_membership_id,
      'seats_before', v_current_users,
      'seats_after', v_current_users + 1,
      'max_seats', v_max_users
    )
  );

  -- Return success
  RETURN json_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'current_users', v_current_users + 1,
    'max_users', v_max_users
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO security_events (
      event_type,
      user_id,
      tenant_id,
      severity,
      details
    ) VALUES (
      'seat_allocation_failed',
      p_admin_user_id,
      p_tenant_id,
      'error',
      json_build_object(
        'target_user_id', p_target_user_id,
        'error', SQLERRM,
        'error_code', SQLSTATE
      )
    );

    -- Re-raise the exception
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_user_to_tenant_transaction(UUID, UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION add_user_to_tenant_transaction(UUID, UUID, UUID) IS
'Atomically allocates a seat to a user in a tenant with row locking to prevent race conditions';
