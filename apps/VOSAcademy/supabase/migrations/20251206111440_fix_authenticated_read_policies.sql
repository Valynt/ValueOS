/*
  # Fix RLS Policies for Authenticated Users
  
  ## Changes
  - Add RLS policies for authenticated users to read public content
  - The existing policies only allow public (anonymous) users
  - Authenticated users need separate policies for: pillars, quiz_questions, resources, simulation_scenarios
  
  ## Security
  - Maintains read-only access to curriculum content for all users
  - No changes to write permissions
  - Follows Postgres RLS best practice of separate policies per role
*/

-- Add policy for authenticated users to read pillars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pillars' 
    AND policyname = 'Authenticated users can read pillars'
  ) THEN
    CREATE POLICY "Authenticated users can read pillars"
      ON pillars FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Add policy for authenticated users to read quiz questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quiz_questions' 
    AND policyname = 'Authenticated users can read quiz questions'
  ) THEN
    CREATE POLICY "Authenticated users can read quiz questions"
      ON quiz_questions FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Add policy for authenticated users to read resources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'resources' 
    AND policyname = 'Authenticated users can read resources'
  ) THEN
    CREATE POLICY "Authenticated users can read resources"
      ON resources FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
