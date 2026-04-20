-- Drop legacy scraper tables if they exist
DROP TABLE IF EXISTS scrape_logs CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- deals table
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- project info (auto-fetched from URL)
  project_url TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('makuake', 'campfire', 'greenfunding', 'other')),
  project_title TEXT NOT NULL,
  project_image_url TEXT,
  owner_name TEXT,
  owner_company TEXT,
  achieved_amount BIGINT,
  supporter_count INTEGER,
  category TEXT,
  project_end_date DATE,

  -- sales pipeline
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'contacted',
    'replied',
    'meeting',
    'valuation',
    'negotiating',
    'closed_won',
    'closed_lost'
  )),
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),

  -- revenue forecast
  estimated_price BIGINT,
  estimated_commission BIGINT,
  actual_price BIGINT,
  actual_commission BIGINT,

  -- action timestamps
  contacted_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_contacted_at ON deals(contacted_at);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

-- deal_notes table
CREATE TABLE deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  note_type TEXT CHECK (note_type IN ('dm_sent', 'reply_received', 'meeting', 'memo', 'status_change')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_deal_id ON deal_notes(deal_id, created_at DESC);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
