-- P0 Production Readiness: Health Check Table
-- 
-- Creates a dedicated table for database health checks
-- Used by bootstrap process to verify database connectivity

-- Create health check table
CREATE TABLE IF NOT EXISTS _health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a single row for health checks
INSERT INTO _health_check (count) 
VALUES (1)
ON CONFLICT DO NOTHING;

-- Create function to create health check table (for runtime creation)
CREATE OR REPLACE FUNCTION create_health_check_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS _health_check (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  INSERT INTO _health_check (count) 
  VALUES (1)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Add comment
COMMENT ON TABLE _health_check IS 'Health check table for database connectivity tests';
COMMENT ON FUNCTION create_health_check_table() IS 'Creates health check table if it does not exist';
