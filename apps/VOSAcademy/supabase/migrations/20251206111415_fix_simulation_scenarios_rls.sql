/*
  # Fix Simulation Scenarios RLS Policy
  
  ## Changes
  - Add RLS policy for authenticated users to read simulation scenarios
  - The existing policy only allows public (anonymous) users
  - Authenticated users need their own policy
  
  ## Security
  - Maintains read-only access to simulation scenarios for all users
  - No changes to write permissions
*/

-- Add policy for authenticated users to read simulation scenarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'simulation_scenarios' 
    AND policyname = 'Authenticated users can read simulation scenarios'
  ) THEN
    CREATE POLICY "Authenticated users can read simulation scenarios"
      ON simulation_scenarios FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
