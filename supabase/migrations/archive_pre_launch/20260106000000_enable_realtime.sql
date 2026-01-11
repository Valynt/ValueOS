-- Enable Realtime for Collaborative Business Case
-- This migration enables real-time updates for collaborative editing

-- Enable realtime on value_cases table
ALTER PUBLICATION supabase_realtime ADD TABLE value_cases;

-- Enable realtime on value_case_metrics table (for metric updates)
ALTER PUBLICATION supabase_realtime ADD TABLE value_case_metrics;

-- Create canvas_elements table for collaborative canvas
CREATE TABLE IF NOT EXISTS canvas_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID NOT NULL REFERENCES value_cases(id) ON DELETE CASCADE,
  element_type TEXT NOT NULL CHECK (element_type IN ('text', 'shape', 'connector', 'sticky_note', 'image')),
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC,
  height NUMERIC,
  content JSONB NOT NULL DEFAULT '{}',
  style JSONB DEFAULT '{}',
  z_index INTEGER DEFAULT 0,
  locked BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on canvas_elements
ALTER TABLE canvas_elements ENABLE ROW LEVEL SECURITY;

-- RLS policies for canvas_elements
CREATE POLICY "Users can view canvas elements for their value cases"
  ON canvas_elements FOR SELECT
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert canvas elements for their value cases"
  ON canvas_elements FOR INSERT
  WITH CHECK (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update canvas elements for their value cases"
  ON canvas_elements FOR UPDATE
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete canvas elements for their value cases"
  ON canvas_elements FOR DELETE
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Enable realtime on canvas_elements
ALTER PUBLICATION supabase_realtime ADD TABLE canvas_elements;

-- Create indexes for performance
CREATE INDEX idx_canvas_elements_value_case_id ON canvas_elements(value_case_id);
CREATE INDEX idx_canvas_elements_z_index ON canvas_elements(z_index);
CREATE INDEX idx_canvas_elements_updated_at ON canvas_elements(updated_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_canvas_element_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
CREATE TRIGGER update_canvas_elements_timestamp
  BEFORE UPDATE ON canvas_elements
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_element_timestamp();

-- Create presence tracking table
CREATE TABLE IF NOT EXISTS canvas_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID NOT NULL REFERENCES value_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  cursor_x NUMERIC,
  cursor_y NUMERIC,
  selected_element_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'idle', 'away')),
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(value_case_id, user_id)
);

-- Enable RLS on canvas_presence
ALTER TABLE canvas_presence ENABLE ROW LEVEL SECURITY;

-- RLS policies for canvas_presence
CREATE POLICY "Users can view presence for their value cases"
  ON canvas_presence FOR SELECT
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own presence"
  ON canvas_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presence"
  ON canvas_presence FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own presence"
  ON canvas_presence FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime on canvas_presence
ALTER PUBLICATION supabase_realtime ADD TABLE canvas_presence;

-- Create indexes for presence
CREATE INDEX idx_canvas_presence_value_case_id ON canvas_presence(value_case_id);
CREATE INDEX idx_canvas_presence_user_id ON canvas_presence(user_id);
CREATE INDEX idx_canvas_presence_last_seen ON canvas_presence(last_seen);

-- Create function to clean up stale presence
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM canvas_presence
  WHERE last_seen < now() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create comments table for collaborative discussions
CREATE TABLE IF NOT EXISTS canvas_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id UUID NOT NULL REFERENCES value_cases(id) ON DELETE CASCADE,
  element_id UUID REFERENCES canvas_elements(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES canvas_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on canvas_comments
ALTER TABLE canvas_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for canvas_comments
CREATE POLICY "Users can view comments for their value cases"
  ON canvas_comments FOR SELECT
  USING (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert comments for their value cases"
  ON canvas_comments FOR INSERT
  WITH CHECK (
    value_case_id IN (
      SELECT id FROM value_cases 
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own comments"
  ON canvas_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON canvas_comments FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime on canvas_comments
ALTER PUBLICATION supabase_realtime ADD TABLE canvas_comments;

-- Create indexes for comments
CREATE INDEX idx_canvas_comments_value_case_id ON canvas_comments(value_case_id);
CREATE INDEX idx_canvas_comments_element_id ON canvas_comments(element_id);
CREATE INDEX idx_canvas_comments_parent_id ON canvas_comments(parent_comment_id);
CREATE INDEX idx_canvas_comments_user_id ON canvas_comments(user_id);
CREATE INDEX idx_canvas_comments_created_at ON canvas_comments(created_at);

-- Create function to update comment timestamp
CREATE OR REPLACE FUNCTION update_canvas_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment updated_at
CREATE TRIGGER update_canvas_comments_timestamp
  BEFORE UPDATE ON canvas_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_comment_timestamp();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON canvas_elements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON canvas_presence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON canvas_comments TO authenticated;

-- Add helpful comments
COMMENT ON TABLE canvas_elements IS 'Stores collaborative canvas elements for value cases';
COMMENT ON TABLE canvas_presence IS 'Tracks active users on the collaborative canvas';
COMMENT ON TABLE canvas_comments IS 'Stores comments and discussions on canvas elements';
