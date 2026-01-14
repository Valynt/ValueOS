-- Customer RLS Policies
-- Row-level security for customer portal access

-- Helper function to get value_case_id from customer token
CREATE OR REPLACE FUNCTION get_value_case_from_token()
RETURNS UUID AS $$
DECLARE
  v_token TEXT;
  v_value_case_id UUID;
BEGIN
  -- Get token from request header or setting
  v_token := current_setting('request.headers', true)::json->>'x-customer-token';
  
  IF v_token IS NULL THEN
    v_token := current_setting('app.customer_token', true);
  END IF;
  
  IF v_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Validate token and get value_case_id
  SELECT value_case_id INTO v_value_case_id
  FROM customer_access_tokens
  WHERE token = v_token
    AND expires_at > NOW()
    AND revoked_at IS NULL;
  
  RETURN v_value_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS Policy for value_cases (read-only for customers)
CREATE POLICY customer_read_value_cases ON value_cases
  FOR SELECT
  TO anon, authenticated
  USING (
    id = get_value_case_from_token()
  );

-- RLS Policy for realization_metrics (read-only for customers)
CREATE POLICY customer_read_realization_metrics ON realization_metrics
  FOR SELECT
  TO anon, authenticated
  USING (
    value_case_id = get_value_case_from_token()
  );

-- RLS Policy for value_drivers (read-only for customers)
CREATE POLICY customer_read_value_drivers ON value_drivers
  FOR SELECT
  TO anon, authenticated
  USING (
    value_case_id = get_value_case_from_token()
  );

-- RLS Policy for financial_models (read-only for customers)
CREATE POLICY customer_read_financial_models ON financial_models
  FOR SELECT
  TO anon, authenticated
  USING (
    value_case_id = get_value_case_from_token()
  );

-- RLS Policy for opportunities (read-only for customers)
CREATE POLICY customer_read_opportunities ON opportunities
  FOR SELECT
  TO anon, authenticated
  USING (
    value_case_id = get_value_case_from_token()
  );

-- RLS Policy for benchmarks (public read access)
CREATE POLICY customer_read_benchmarks ON benchmarks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Grant select permissions to anon role
GRANT SELECT ON value_cases TO anon;
GRANT SELECT ON realization_metrics TO anon;
GRANT SELECT ON value_drivers TO anon;
GRANT SELECT ON financial_models TO anon;
GRANT SELECT ON opportunities TO anon;
GRANT SELECT ON benchmarks TO anon;

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION get_value_case_from_token() TO anon, authenticated;

-- Comments
COMMENT ON FUNCTION get_value_case_from_token IS 'Extract value_case_id from customer token in request';
COMMENT ON POLICY customer_read_value_cases ON value_cases IS 'Allow customers to read their value case';
COMMENT ON POLICY customer_read_realization_metrics ON realization_metrics IS 'Allow customers to read their metrics';
