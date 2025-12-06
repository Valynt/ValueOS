-- Ensure user seat provisioning is serialized to prevent over-allocation
-- Adds locking to the seat entitlement row so concurrent seat grants cannot race

CREATE OR REPLACE FUNCTION public.provision_user_seat(
  p_org_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, message TEXT) AS $$
DECLARE
  v_entitlement billing_entitlements%ROWTYPE;
  v_current_seats INTEGER;
BEGIN
  -- Lock the latest seat entitlement row to serialize seat provisioning
  SELECT * INTO v_entitlement
  FROM billing_entitlements
  WHERE organization_id = p_org_id
    AND feature_code = 'user_seats'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_entitlement.limit_type IS NULL OR v_entitlement.limit_value IS NULL OR v_entitlement.limit_value < 0 THEN
    RETURN QUERY SELECT true, NULL::INTEGER, 'Unlimited seats';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_current_seats
  FROM organization_members
  WHERE organization_id = p_org_id
    AND status = 'active';

  IF v_entitlement.limit_type = 'hard' AND v_current_seats >= v_entitlement.limit_value THEN
    RETURN QUERY SELECT false, 0, 'Seat limit reached';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, GREATEST(v_entitlement.limit_value - v_current_seats - 1, 0), 'Seat reserved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.provision_user_seat(UUID, UUID)
  IS 'Serializes user seat provisioning using FOR UPDATE to prevent license overages during concurrent signup flows.';
