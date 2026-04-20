import { createAdminClient } from '@/lib/supabase/server';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import type { LeadRow } from '@/components/dashboard/LeadsTable';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createAdminClient();

  const { data: raw } = await supabase
    .from('leads')
    .select(`
      id, priority_score, priority_reason, status, notes,
      contacted_at, created_at,
      projects (
        id, platform, title, url, category,
        owner_name, owner_company, owner_profile_url,
        achieved_amount, target_amount, achievement_rate,
        supporter_count, end_date
      )
    `)
    .order('priority_score', { ascending: false })
    .limit(500);

  // Supabase returns projects as array for 1:N joins; normalize to single object
  const leads: LeadRow[] = (raw ?? []).map((row) => ({
    ...row,
    projects: Array.isArray(row.projects) ? (row.projects[0] ?? null) : row.projects,
  })) as LeadRow[];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-bold text-gray-800">CF Exit ダッシュボード</h1>
      </header>
      <main className="p-6">
        <LeadsTable leads={leads} />
      </main>
    </div>
  );
}
