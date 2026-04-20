import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createSessionClient } from '@/lib/supabase/server-session';
import { createAdminClient } from '@/lib/supabase/server';
import { STATUS_LABELS, PLATFORM_LABELS, type Deal, type DealNote, type DealStatus } from '@/types/deal';
import { StatusSelector } from '@/components/deals/StatusSelector';
import { NoteForm } from '@/components/deals/NoteForm';
import { NoteList } from '@/components/deals/NoteList';
import { PriceEditor } from '@/components/deals/PriceEditor';
import { ContactEditor } from '@/components/deals/ContactEditor';
import { DeleteDealButton } from '@/components/deals/DeleteDealButton';
import { ValuationCalculator } from '@/components/deals/ValuationCalculator';
import { RefreshPreviewButton } from '@/components/deals/RefreshPreviewButton';

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

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const admin = createAdminClient();

  const [{ data: deal }, { data: notes }] = await Promise.all([
    admin.from('deals').select('*').eq('id', id).single(),
    admin.from('deal_notes').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
  ]);

  if (!deal) notFound();

  const d = deal as Deal;
  const n = (notes ?? []) as DealNote[];

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-[#1B2B4B] text-white px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-white/70 hover:text-white text-sm">← ダッシュボード</Link>
        <h1 className="text-lg font-bold truncate flex-1">{d.project_title}</h1>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Project info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            {d.project_image_url && (
              <Image
                src={d.project_image_url}
                alt={d.project_title}
                width={400}
                height={240}
                className="w-full rounded-lg object-cover"
                unoptimized
              />
            )}
            <div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {PLATFORM_LABELS[d.platform]}
              </span>
              <h2 className="font-bold text-gray-900 mt-1 leading-snug">{d.project_title}</h2>
              <a
                href={d.project_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 block truncate"
              >
                {d.project_url}
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t text-sm">
              <div>
                <p className="text-xs text-gray-400">達成額</p>
                <p className="font-semibold">{formatAmount(d.achieved_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">支援者数</p>
                <p className="font-semibold">
                  {d.supporter_count ? `${d.supporter_count.toLocaleString()}人` : '-'}
                </p>
              </div>
              {d.category && (
                <div>
                  <p className="text-xs text-gray-400">カテゴリ</p>
                  <p className="font-semibold">{d.category}</p>
                </div>
              )}
              {d.project_end_date && (
                <div>
                  <p className="text-xs text-gray-400">終了日</p>
                  <p className="font-semibold">{d.project_end_date}</p>
                </div>
              )}
            </div>

            {(d.owner_name || d.owner_company) && (
              <div className="pt-3 border-t text-sm">
                <p className="text-xs text-gray-400 mb-1">起案者</p>
                {d.owner_company && <p className="font-semibold">{d.owner_company}</p>}
                {d.owner_name && <p className="text-gray-700">{d.owner_name}</p>}
              </div>
            )}

            {/* Timestamps */}
            <div className="pt-3 border-t space-y-1">
              <p className="text-xs text-gray-400">登録日: {formatDate(d.created_at)}</p>
              {d.contacted_at && <p className="text-xs text-gray-400">DM送信: {formatDate(d.contacted_at)}</p>}
              {d.last_reply_at && <p className="text-xs text-gray-400">最終返信: {formatDate(d.last_reply_at)}</p>}
              {d.closed_at && <p className="text-xs text-gray-400">成約日: {formatDate(d.closed_at)}</p>}
            </div>

            {/* Refresh + Delete */}
            <div className="pt-3 border-t space-y-2">
              <RefreshPreviewButton dealId={d.id} projectUrl={d.project_url} />
              <DeleteDealButton dealId={d.id} />
            </div>
          </div>
        </div>

        {/* Right: Status + Notes */}
        <div className="lg:col-span-3 space-y-4">
          {/* Status & Price & Contact */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">現在のステータス</p>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[d.status]}`}>
                  {STATUS_LABELS[d.status]}
                </span>
                <StatusSelector dealId={d.id} currentStatus={d.status} />
              </div>
            </div>

            <PriceEditor
              dealId={d.id}
              estimatedPrice={d.estimated_price}
              estimatedCommission={d.estimated_commission}
              actualPrice={d.actual_price}
              actualCommission={d.actual_commission}
              status={d.status}
            />

            <ValuationCalculator dealId={d.id} />

            <ContactEditor
              dealId={d.id}
              contactEmail={d.contact_email}
              contactSnsUrl={d.contact_sns_url}
              contactNote={d.contact_note}
            />
          </div>

          {/* Activity timeline */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">アクティビティ</h3>
            <NoteForm dealId={d.id} />
            <NoteList notes={n} />
          </div>
        </div>
      </main>
    </div>
  );
}
