export type Platform = 'makuake' | 'campfire';

export type ProjectStatus = 'active' | 'completed' | 'failed';

export type LeadStatus = 'new' | 'contacted' | 'replied' | 'meeting' | 'closed' | 'rejected';

export type ScrapeLogStatus = 'running' | 'completed' | 'failed' | 'aborted';

export interface Project {
  id: string;
  platform: Platform;
  external_id: string;
  url: string;
  title: string;
  description: string | null;
  category: string | null;
  owner_name: string | null;
  owner_company: string | null;
  owner_profile_url: string | null;
  achieved_amount: number;
  target_amount: number | null;
  achievement_rate: number | null;
  supporter_count: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  raw_html: string | null;
  scraped_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  project_id: string;
  priority_score: number;
  priority_reason: string | null;
  contact_email: string | null;
  contact_form_url: string | null;
  status: LeadStatus;
  contacted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapeLog {
  id: string;
  platform: Platform;
  started_at: string;
  finished_at: string | null;
  total_pages: number;
  total_projects: number;
  errors: Record<string, unknown>[] | null;
  status: ScrapeLogStatus;
}

export interface ScrapedProject {
  platform: Platform;
  external_id: string;
  url: string;
  title: string;
  description: string | null;
  category: string | null;
  owner_name: string | null;
  owner_company: string | null;
  owner_profile_url: string | null;
  achieved_amount: number;
  target_amount: number | null;
  achievement_rate: number | null;
  supporter_count: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  raw_html?: string;
}

export interface StructuredLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  action: string;
  data?: Record<string, unknown>;
}
