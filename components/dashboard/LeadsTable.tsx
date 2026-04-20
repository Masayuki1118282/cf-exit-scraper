'use client';

import { useState, useMemo } from 'react';
import type { LeadStatus } from '@/types/project';

export interface LeadRow {
  id: string;
  priority_score: number;
  priority_reason: string | null;
  status: LeadStatus;
  notes: string | null;
  contacted_at: string | null;
  created_at: string;
  projects: {
    id: string;
    platform: string;
    title: string;
    url: string;
    category: string | null;
    owner_name: string | null;
    owner_company: string | null;
    owner_profile_url: string | null;
    achieved_amount: number;
    target_amount: number | null;
    achievement_rate: number | null;
    supporter_count: number | null;
    end_date: string | null;
  } | null;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: '未対応',
  contacted: '連絡済',
  replied: '返信あり',
  meeting: '商談中',
  closed: '成約',
  rejected: '見送り',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  replied: 'bg-yellow-100 text-yellow-700',
  meeting: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const PLATFORM_LABELS: Record<string, string> = {
  makuake: 'Makuake',
  campfire: 'CAMPFIRE',
  greenfunding: 'GF',
};

function formatAmount(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}万`;
  return n.toLocaleString();
}

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (filterStatus !== 'all' && (statuses[lead.id] ?? lead.status) !== filterStatus) return false;
      if (filterPlatform !== 'all' && lead.projects?.platform !== filterPlatform) return false;
      if (lead.priority_score < filterMinScore) return false;
      return true;
    });
  }, [leads, filterStatus, filterPlatform, filterMinScore, statuses]);

  async function updateStatus(id: string, status: LeadStatus) {
    setUpdating(id);
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setStatuses((prev) => ({ ...prev, [id]: status }));
    setUpdating(null);
  }

  function exportCsv() {
    const rows = [
      ['スコア', 'プラットフォーム', 'タイトル', 'URL', '達成額', 'カテゴリ', '起案者', '会社', '終了日', 'ステータス'],
      ...filtered.map((lead) => {
        const p = lead.projects;
        return [
          lead.priority_score,
          p?.platform ?? '',
          p?.title ?? '',
          p?.url ?? '',
          p?.achieved_amount ?? '',
          p?.category ?? '',
          p?.owner_name ?? '',
          p?.owner_company ?? '',
          p?.end_date ?? '',
          STATUS_LABELS[statuses[lead.id] ?? lead.status],
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cf-exit-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* フィルタパネル */}
      <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ステータス</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'all')}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="all">すべて</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">プラットフォーム</label>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="all">すべて</option>
            <option value="makuake">Makuake</option>
            <option value="campfire">CAMPFIRE</option>
            <option value="greenfunding">GreenFunding</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">最低スコア</label>
          <input
            type="number"
            min={0}
            max={110}
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(Number(e.target.value))}
            className="border rounded px-2 py-1.5 text-sm w-20"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length}件</span>
          <button
            onClick={exportCsv}
            className="bg-green-600 text-white rounded px-3 py-1.5 text-sm hover:bg-green-700"
          >
            CSV出力
          </button>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">スコア</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">PF</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">タイトル</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">達成額</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">達成率</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">カテゴリ</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">起案者</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">終了日</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">ステータス</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((lead) => {
              const p = lead.projects;
              const currentStatus = statuses[lead.id] ?? lead.status;
              return (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className={`font-bold ${lead.priority_score >= 80 ? 'text-red-600' : 'text-gray-700'}`}>
                      {lead.priority_score}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {PLATFORM_LABELS[p?.platform ?? ''] ?? p?.platform}
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <a
                      href={p?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline line-clamp-2"
                    >
                      {p?.title}
                    </a>
                    {p?.owner_profile_url && (
                      <a
                        href={p.owner_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-gray-400 hover:text-blue-500 mt-0.5"
                      >
                        プロフィール →
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {p ? `¥${formatAmount(p.achieved_amount)}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {p?.achievement_rate != null ? `${p.achievement_rate}%` : '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{p?.category ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {p?.owner_company || p?.owner_name || '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {p?.end_date ?? '-'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={currentStatus}
                      disabled={updating === lead.id}
                      onChange={(e) => updateStatus(lead.id, e.target.value as LeadStatus)}
                      className={`rounded px-2 py-1 text-xs font-medium border-0 ${STATUS_COLORS[currentStatus]}`}
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">データがありません</p>
        )}
      </div>
    </div>
  );
}
