export type Platform = 'makuake' | 'campfire' | 'greenfunding' | 'other';

export type DealStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'meeting'
  | 'valuation'
  | 'negotiating'
  | 'closed_won'
  | 'closed_lost';

export type Priority = 'high' | 'medium' | 'low';

export type NoteType = 'dm_sent' | 'reply_received' | 'meeting' | 'memo' | 'status_change';

export interface Deal {
  id: string;
  project_url: string;
  platform: Platform;
  project_title: string;
  project_image_url: string | null;
  owner_name: string | null;
  owner_company: string | null;
  achieved_amount: number | null;
  supporter_count: number | null;
  category: string | null;
  project_end_date: string | null;
  status: DealStatus;
  priority: Priority | null;
  estimated_price: number | null;
  estimated_commission: number | null;
  actual_price: number | null;
  actual_commission: number | null;
  contacted_at: string | null;
  last_reply_at: string | null;
  closed_at: string | null;
  contact_email: string | null;
  contact_sns_url: string | null;
  contact_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealNote {
  id: string;
  deal_id: string;
  note_type: NoteType | null;
  content: string;
  created_at: string;
}

export const STATUS_LABELS: Record<DealStatus, string> = {
  new: '未対応',
  contacted: 'DM送信済み',
  replied: '返信あり',
  meeting: '面談',
  valuation: '査定中',
  negotiating: '交渉中',
  closed_won: '成約',
  closed_lost: '失注',
};

export const STATUS_ORDER: DealStatus[] = [
  'new', 'contacted', 'replied', 'meeting', 'valuation', 'negotiating', 'closed_won', 'closed_lost',
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  makuake: 'Makuake',
  campfire: 'CAMPFIRE',
  greenfunding: 'GreenFunding',
  other: 'その他',
};
