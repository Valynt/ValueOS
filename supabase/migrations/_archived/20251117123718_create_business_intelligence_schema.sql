/*
  # Business Intelligence Canvas Schema

  1. New Tables
    - `business_cases`
      - `id` (uuid, primary key) - Unique identifier for business case
      - `name` (text) - Name of the business case
      - `client` (text) - Client name
      - `status` (text) - Status: draft, in-review, presented
      - `owner_id` (uuid) - User who owns this case
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `metadata` (jsonb) - Additional metadata
    
    - `canvas_components`
      - `id` (uuid, primary key) - Unique identifier for component
      - `case_id` (uuid, foreign key) - Reference to business case
      - `type` (text) - Component type: metric-card, interactive-chart, data-table, narrative-block
      - `position_x` (integer) - X coordinate on canvas
      - `position_y` (integer) - Y coordinate on canvas
      - `width` (integer) - Component width
      - `height` (integer) - Component height
      - `props` (jsonb) - Component-specific properties
      - `created_by` (text) - Creator: user or agent name
      - `created_at` (timestamptz) - Creation timestamp
      - `modified_at` (timestamptz) - Last modification timestamp
      - `is_dirty` (boolean) - Whether component has unsaved changes
    
    - `component_history`
      - `id` (uuid, primary key) - Unique identifier for history entry
      - `component_id` (uuid, foreign key) - Reference to component
      - `action_type` (text) - Type of action: created, updated, deleted, moved
      - `actor` (text) - Who performed the action: user or agent name
      - `changes` (jsonb) - JSON describing the changes made
      - `timestamp` (timestamptz) - When action occurred
    
    - `agent_activities`
      - `id` (uuid, primary key) - Unique identifier for activity
      - `case_id` (uuid, foreign key) - Reference to business case
      - `agent_name` (text) - Name of the agent
      - `activity_type` (text) - Type: suggestion, calculation, visualization, narrative
      - `title` (text) - Activity title
      - `content` (text) - Activity description
      - `metadata` (jsonb) - Additional activity metadata
      - `timestamp` (timestamptz) - When activity occurred
    
    - `component_relationships`
      - `id` (uuid, primary key) - Unique identifier for relationship
      - `source_component_id` (uuid, foreign key) - Source component
      - `target_component_id` (uuid, foreign key) - Target component
      - `relationship_type` (text) - Type: depends_on, updates, calculates
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Public read access not allowed by default
*/

-- Create business_cases table
CREATE TABLE IF NOT EXISTS business_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'in-review', 'presented')),
  owner_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE business_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business cases"
  ON business_cases FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own business cases"
  ON business_cases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own business cases"
  ON business_cases FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own business cases"
  ON business_cases FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Create canvas_components table
CREATE TABLE IF NOT EXISTS canvas_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES business_cases(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('metric-card', 'interactive-chart', 'data-table', 'narrative-block')),
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 300,
  height integer NOT NULL DEFAULT 120,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  modified_at timestamptz DEFAULT now(),
  is_dirty boolean DEFAULT false
);

ALTER TABLE canvas_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view components in own cases"
  ON canvas_components FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_cases
      WHERE business_cases.id = canvas_components.case_id
      AND business_cases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert components in own cases"
  ON canvas_components FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_cases
      WHERE business_cases.id = canvas_components.case_id
      AND business_cases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update components in own cases"
  ON canvas_components FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_cases
      WHERE business_cases.id = canvas_components.case_id
      AND business_cases.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_cases
      WHERE business_cases.id = canvas_components.case_id
      AND business_cases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete components in own cases"
  ON canvas_components FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_cases
      WHERE business_cases.id = canvas_components.case_id
      AND business_cases.owner_id = auth.uid()
    )
  );

-- Create component_history table
CREATE TABLE IF NOT EXISTS component_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES canvas_components(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted', 'moved', 'resized')),
  actor text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE component_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of own components"
  ON component_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM canvas_components
      JOIN business_cases ON business_cases.id = canvas_components.case_id
      WHERE canvas_components.id = component_history.component_id
      AND business_cases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert history for own components"
  ON component_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvas_components
      JOIN business_cases ON business_cases.id = canvas_components.case_id
      WHERE canvas_components.id = component_history.component_id
      AND business_cases.owner_id = auth.uid()
    )
  );

-- Create agent_activities table
CREATE TABLE IF NOT EXISTS agent_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES business_cases(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('suggestion', 'calculation', 'visualization', 'narrative', 'data-import')),
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities in own cases"
  ON agent_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_cases
      WHERE business_cases.id = agent_activities.case_id
      AND business_cases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activities in own cases"
  ON agent_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_cases
      WHERE business_cases.id = agent_activities.case_id
      AND business_cases.owner_id = auth.uid()
    )
  );

-- Create component_relationships table
CREATE TABLE IF NOT EXISTS component_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_component_id uuid NOT NULL REFERENCES canvas_components(id) ON DELETE CASCADE,
  target_component_id uuid NOT NULL REFERENCES canvas_components(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('depends_on', 'updates', 'calculates')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_component_id, target_component_id, relationship_type)
);

ALTER TABLE component_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relationships for own components"
  ON component_relationships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM canvas_components
      JOIN business_cases ON business_cases.id = canvas_components.case_id
      WHERE canvas_components.id = component_relationships.source_component_id
      AND business_cases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert relationships for own components"
  ON component_relationships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvas_components
      JOIN business_cases ON business_cases.id = canvas_components.case_id
      WHERE canvas_components.id = component_relationships.source_component_id
      AND business_cases.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete relationships for own components"
  ON component_relationships FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM canvas_components
      JOIN business_cases ON business_cases.id = canvas_components.case_id
      WHERE canvas_components.id = component_relationships.source_component_id
      AND business_cases.owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_canvas_components_case_id ON canvas_components(case_id);
CREATE INDEX IF NOT EXISTS idx_component_history_component_id ON component_history(component_id);
CREATE INDEX IF NOT EXISTS idx_component_history_timestamp ON component_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activities_case_id ON agent_activities(case_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_timestamp ON agent_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_component_relationships_source ON component_relationships(source_component_id);
CREATE INDEX IF NOT EXISTS idx_component_relationships_target ON component_relationships(target_component_id);

-- Create function to update modified_at timestamp
CREATE OR REPLACE FUNCTION update_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for canvas_components
DROP TRIGGER IF EXISTS update_canvas_components_modified_at ON canvas_components;
CREATE TRIGGER update_canvas_components_modified_at
  BEFORE UPDATE ON canvas_components
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at();

-- Create trigger for business_cases
DROP TRIGGER IF EXISTS update_business_cases_updated_at ON business_cases;
CREATE TRIGGER update_business_cases_updated_at
  BEFORE UPDATE ON business_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_at();