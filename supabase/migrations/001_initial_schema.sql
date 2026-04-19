-- projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('makuake', 'campfire', 'greenfunding')),
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  owner_name TEXT,
  owner_company TEXT,
  owner_profile_url TEXT,
  achieved_amount BIGINT NOT NULL,
  target_amount BIGINT,
  achievement_rate NUMERIC,
  supporter_count INTEGER,
  start_date DATE,
  end_date DATE,
  status TEXT,
  raw_html TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_achievement ON projects(achieved_amount DESC);
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_platform ON projects(platform);

-- leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  priority_score INTEGER NOT NULL CHECK (priority_score >= 0 AND priority_score <= 100),
  priority_reason TEXT,
  contact_email TEXT,
  contact_form_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'meeting', 'closed', 'rejected')),
  contacted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- scrape_logs table
CREATE TABLE IF NOT EXISTS scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  total_pages INTEGER DEFAULT 0,
  total_projects INTEGER DEFAULT 0,
  errors JSONB,
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'aborted'))
);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
