-- Create academy_pillars table for pillar metadata
-- This table stores the static metadata for each VOS Academy pillar
-- Supports tenant-specific overrides in the future

CREATE TABLE IF NOT EXISTS public.academy_pillars (
    id integer PRIMARY KEY,
    number integer NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    icon text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Insert default pillar data (10 pillars)
INSERT INTO public.academy_pillars (id, number, title, description, icon, color) VALUES
(1, 1, 'Value Selling Fundamentals', 'Master the core principles of value-based selling', 'target', '#3B82F6'),
(2, 2, 'Value Realization', 'Track and communicate realized value to customers', 'trending-up', '#10B981'),
(3, 3, 'Expansion Selling', 'Identify and execute expansion opportunities', 'expand', '#8B5CF6'),
(4, 4, 'Value-Based Negotiation', 'Negotiate based on demonstrated value', 'handshake', '#F59E0B'),
(5, 5, 'Executive Business Case', 'Build compelling business cases for executives', 'briefcase', '#EF4444'),
(6, 6, 'ROI Communication', 'Articulate return on investment effectively', 'pie-chart', '#06B6D4'),
(7, 7, 'Value Quantification', 'Quantify and measure customer value', 'calculator', '#84CC16'),
(8, 8, 'Cross-Functional Alignment', 'Align internal teams around customer value', 'users', '#EC4899'),
(9, 9, 'Value-Driven Renewals', 'Secure renewals through demonstrated value', 'refresh-cw', '#6366F1'),
(10, 10, 'Strategic Value Advisory', 'Act as a strategic value advisor to customers', 'crown', '#F97316')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.academy_pillars ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read pillars (global catalog)
CREATE POLICY "Allow authenticated read access to academy_pillars"
ON public.academy_pillars FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow service role to manage pillars
CREATE POLICY "Allow service role full access to academy_pillars"
ON public.academy_pillars
TO service_role
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.academy_pillars TO authenticated;
GRANT ALL ON public.academy_pillars TO service_role;

-- Update the academy_modules pillar foreign key to reference academy_pillars.id
-- First, we need to drop the existing constraint if it exists
ALTER TABLE public.academy_modules DROP CONSTRAINT IF EXISTS academy_modules_pillar_fkey;

-- Add foreign key constraint referencing academy_pillars.id
ALTER TABLE public.academy_modules
ADD CONSTRAINT academy_modules_pillar_fkey
FOREIGN KEY (pillar)
REFERENCES public.academy_pillars (number)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Add comment
COMMENT ON TABLE public.academy_pillars IS 'Academy pillar metadata - global catalog of all VOS Academy pillars';
COMMENT ON COLUMN public.academy_pillars.id IS 'Primary key (1-10)';
COMMENT ON COLUMN public.academy_pillars.number IS 'Pillar number (1-10)';
COMMENT ON COLUMN public.academy_pillars.title IS 'Display title of the pillar';
COMMENT ON COLUMN public.academy_pillars.description IS 'Brief description of the pillar';
COMMENT ON COLUMN public.academy_pillars.icon IS 'Icon identifier for UI';
COMMENT ON COLUMN public.academy_pillars.color IS 'Hex color code for UI';
