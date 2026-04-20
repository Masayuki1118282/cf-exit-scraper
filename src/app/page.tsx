import Link from 'next/link';
import { createSessionClient } from '@/lib/supabase/server-session';
import { createAdminClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PipelineFunnel } from '@/components/deals/PipelineFunnel';
import { STATUS_LABELS, PLATFORM_LABELS, STATUS_ORDER, type Deal, type DealStatus } from '@/types/deal';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<DealStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  replied: 'bg-cyan-100 text-cyan-700',
  meeting: 'bg-yellow-100 text-yellow-700',
  valuation: 'bg-orange-100 text-orange-700',
  negotiating: 'bg-purple-100 text-purple-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
};

function formatAmount(amount: number | null) {
  if (!amount) return '-';
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}億円`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000)}万円`;
  return `${amount.toLocaleString()}円`;
}

const TAB_OPTIONS: { label: string; value: string }[] = [
  { label: 'すべて', value: '' },
  { label: '未対応', value: 'new' },
  { label: 'DM送信済み', value: 'contacted' },
  { label: '返信あり', value: 'replied' },
  { label: '面談', value: 'meeting' },
  { label: '査定中', value: 'valuation' },
  { label: '交渉中', value: 'negotiating' },
  { label: '成約', value: 'closed_won' },
  { label: '失注', value: 'closed_lost' },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus } = await searchParams;
  const sessionClient = await createSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return null; // proxy.ts handles redirect

  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: allDeals },
    { count: newThisMonth },
    { count: staleCount },
    { data: pipelineDeals },
  ] = await Promise.all([
    admin.from('deals').select('*').order('updated_at', { ascending: false }),
    admin.from('deals').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    admin
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'contacted')
      .lt('contacted_at', threeDaysAgo),
    admin
      .from('deals')
      .select('estimated_commission, actual_commission, status')
      .in('status', ['negotiating', 'closed_won']),
  ]);

  const estimatedTotal = (pipelineDeals ?? [])
    .filter((d) => d.status === 'negotiating')
    .reduce((sum, d) => sum + (d.estimated_commission ?? 0), 0);

  const closedTotal = (pipelineDeals ?? [])
    .filter((d) => d.status === 'closed_won')
    .reduce((sum, d) => sum + (d.actual_commission ?? 0), 0);

  // Status counts for funnel
  const statusCounts: Partial<Record<DealStatus, number>> = {};
  for (const status of STATUS_ORDER) {
    statusCounts[status] = (allDeals ?? []).filter((d) => d.status === status).length;
  }

  // Filtered deals for table
  const deals = (allDeals ?? []).filter((d) =>
    filterStatus ? d.status === filterStatus : true
  ) as Deal[];

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-[#1B2B4B] text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-wide">CF Exit ダッシュボード</h1>
        <Link href="/deals/new">
          <Button className="bg-white text-[#1B2B4B] hover:bg-gray-100 font-semibold text-sm">
            + 新規案件追加
          </Button>
        </Link>
      </header>

      <main className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-gray-500 font-medium">今月の新規登録</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#1B2B4B]">
                {newThisMonth ?? 0}<span className="text-sm font-normal text-gray-500 ml-1">件</span>
              </p>
            </CardContent>
          </Card>
          <Card className={staleCount ? 'border-orange-300' : ''}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-gray-500 font-medium">返信待ち放置（3日超）</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${staleCount ? 'text-orange-500' : 'text-[#1B2B4B]'}`}>
                {staleCount ?? 0}<span className="text-sm font-normal text-gray-500 ml-1">件</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-gray-500 font-medium">成約見込み手数料</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#1B2B4B]">{formatAmount(estimatedTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-gray-500 font-medium">今月の成約確定</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatAmount(closedTotal)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pipeline Funnel */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700">パイプライン</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineFunnel counts={statusCounts} />
            </CardContent>
          </Card>

          {/* Deals Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="text-sm text-gray-700">
                  案件一覧
                  <span className="ml-2 text-xs font-normal text-gray-400">{deals.length}件</span>
                </CardTitle>
              </div>
              {/* Filter tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                {TAB_OPTIONS.map((tab) => {
                  const isActive = (filterStatus ?? '') === tab.value;
                  return (
                    <Link
                      key={tab.value}
                      href={tab.value ? `/?status=${tab.value}` : '/'}
                      className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
                        isActive
                          ? 'bg-[#1B2B4B] text-white border-[#1B2B4B]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-2">
              {deals.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="mb-4">
                    {filterStatus ? `「${STATUS_LABELS[filterStatus as DealStatus]}」の案件はありません` : '案件がまだ登録されていません'}
                  </p>
                  {!filterStatus && (
                    <Link href="/deals/new">
                      <Button variant="outline">最初の案件を追加する</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                        <th className="text-left px-4 py-3 font-medium">プロジェクト名</th>
                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">PF</th>
                        <th className="text-right px-4 py-3 font-medium hidden md:table-cell">達成額</th>
                        <th className="text-left px-4 py-3 font-medium">ステータス</th>
                        <th className="text-right px-4 py-3 font-medium">想定手数料</th>
                        <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">最終更新</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deals.map((deal) => (
                        <tr key={deal.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/deals/${deal.id}`} className="font-medium text-gray-900 hover:text-[#1B2B4B] line-clamp-1">
                              {deal.project_title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{PLATFORM_LABELS[deal.platform]}</td>
                          <td className="px-4 py-3 text-right text-gray-700 hidden md:table-cell">{formatAmount(deal.achieved_amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[deal.status]}`}>
                              {STATUS_LABELS[deal.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatAmount(deal.estimated_commission)}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                            {new Date(deal.updated_at).toLocaleDateString('ja-JP')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
