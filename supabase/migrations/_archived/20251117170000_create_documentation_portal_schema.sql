/*
  # Documentation Portal Database Schema

  1. New Tables
    - `doc_categories` - Main documentation categories
    - `doc_pages` - Individual documentation pages
    - `doc_versions` - Version history for documentation
    - `doc_search_index` - Full-text search index
    - `doc_feedback` - User feedback and ratings
    - `doc_analytics` - Page view analytics
    - `doc_media` - Images, videos, attachments
    - `doc_related_pages` - Cross-references between pages

  2. Security
    - Enable RLS on all tables
    - Public read access for published docs
    - Admin-only write access

  3. Features
    - Full-text search with rankings
    - Version control
    - Analytics tracking
    - User feedback system
*/

-- Documentation Categories
CREATE TABLE IF NOT EXISTS doc_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES doc_categories(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_categories_slug ON doc_categories(slug);
CREATE INDEX IF NOT EXISTS idx_doc_categories_parent ON doc_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_doc_categories_order ON doc_categories(display_order);

ALTER TABLE doc_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published categories" ON doc_categories
  FOR SELECT
  USING (published = true);

CREATE POLICY "Admins can manage categories" ON doc_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'documentation.manage' = ANY(permissions)
      )
    )
  );

-- Documentation Pages
CREATE TABLE IF NOT EXISTS doc_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES doc_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'html')),
  version TEXT DEFAULT '1.0.0',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id UUID,
  featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  search_rank REAL DEFAULT 1.0,
  tags TEXT[] DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_pages_slug ON doc_pages(slug);
CREATE INDEX IF NOT EXISTS idx_doc_pages_category ON doc_pages(category_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_status ON doc_pages(status);
CREATE INDEX IF NOT EXISTS idx_doc_pages_featured ON doc_pages(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_doc_pages_tags ON doc_pages USING gin(tags);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_doc_pages_search
  ON doc_pages USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content, ''))
  );

ALTER TABLE doc_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published pages" ON doc_pages
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can manage pages" ON doc_pages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'documentation.manage' = ANY(permissions)
      )
    )
  );

-- Documentation Versions
CREATE TABLE IF NOT EXISTS doc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'markdown',
  author_id UUID,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_page ON doc_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_created ON doc_versions(created_at DESC);

ALTER TABLE doc_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view versions" ON doc_versions
  FOR SELECT
  USING (true);

-- Documentation Feedback
CREATE TABLE IF NOT EXISTS doc_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
  user_id UUID,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  helpful BOOLEAN,
  comment TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('helpful', 'rating', 'suggestion', 'error')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'dismissed')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_feedback_page ON doc_feedback(page_id);
CREATE INDEX IF NOT EXISTS idx_doc_feedback_status ON doc_feedback(status);
CREATE INDEX IF NOT EXISTS idx_doc_feedback_type ON doc_feedback(feedback_type);

ALTER TABLE doc_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback" ON doc_feedback
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view feedback" ON doc_feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()::text
      AND user_roles.role_id IN (
        SELECT id FROM roles WHERE 'documentation.manage' = ANY(permissions)
      )
    )
  );

-- Documentation Analytics
CREATE TABLE IF NOT EXISTS doc_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'search', 'download', 'share')),
  user_id UUID,
  session_id TEXT,
  referrer TEXT,
  search_query TEXT,
  time_on_page INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_analytics_page ON doc_analytics(page_id);
CREATE INDEX IF NOT EXISTS idx_doc_analytics_event ON doc_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_doc_analytics_created ON doc_analytics(created_at DESC);

ALTER TABLE doc_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log analytics" ON doc_analytics
  FOR INSERT
  WITH CHECK (true);

-- Documentation Media
CREATE TABLE IF NOT EXISTS doc_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  file_url TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_media_page ON doc_media(page_id);

ALTER TABLE doc_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view media" ON doc_media
  FOR SELECT
  USING (true);

-- Related Pages (Cross-references)
CREATE TABLE IF NOT EXISTS doc_related_pages (
  page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
  related_page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'related' CHECK (relationship_type IN ('related', 'prerequisite', 'next_step')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (page_id, related_page_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_related_from ON doc_related_pages(page_id);
CREATE INDEX IF NOT EXISTS idx_doc_related_to ON doc_related_pages(related_page_id);

ALTER TABLE doc_related_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view related pages" ON doc_related_pages
  FOR SELECT
  USING (true);

-- Search Function
CREATE OR REPLACE FUNCTION search_documentation(
  search_query TEXT,
  category_filter UUID DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  category_name TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.slug,
    p.title,
    p.description,
    c.name as category_name,
    ts_rank(
      to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.content, '')),
      plainto_tsquery('english', search_query)
    ) * p.search_rank as rank
  FROM doc_pages p
  LEFT JOIN doc_categories c ON p.category_id = c.id
  WHERE
    p.status = 'published'
    AND (category_filter IS NULL OR p.category_id = category_filter)
    AND (
      to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.content, ''))
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY rank DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Popular Pages View
CREATE OR REPLACE VIEW popular_pages AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.description,
  p.view_count,
  c.name as category_name,
  COUNT(f.id) FILTER (WHERE f.helpful = true) as helpful_count,
  AVG(f.rating) as avg_rating
FROM doc_pages p
LEFT JOIN doc_categories c ON p.category_id = c.id
LEFT JOIN doc_feedback f ON p.id = f.page_id
WHERE p.status = 'published'
GROUP BY p.id, c.name
ORDER BY p.view_count DESC, helpful_count DESC
LIMIT 10;

-- Recent Updates View
CREATE OR REPLACE VIEW recent_updates AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.description,
  p.updated_at,
  c.name as category_name
FROM doc_pages p
LEFT JOIN doc_categories c ON p.category_id = c.id
WHERE p.status = 'published'
ORDER BY p.updated_at DESC
LIMIT 10;

-- Trigger to update page view count
CREATE OR REPLACE FUNCTION increment_page_view()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'view' THEN
    UPDATE doc_pages
    SET view_count = view_count + 1
    WHERE id = NEW.page_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_page_view
  AFTER INSERT ON doc_analytics
  FOR EACH ROW
  EXECUTE FUNCTION increment_page_view();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_doc_pages_updated
  BEFORE UPDATE ON doc_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_doc_categories_updated
  BEFORE UPDATE ON doc_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
