import { STATUS_LABELS, STATUS_ORDER, type DealStatus } from '@/types/deal';
import Link from 'next/link';

const STATUS_BAR_COLORS: Record<DealStatus, string> = {
  new: 'bg-gray-400',
  contacted: 'bg-blue-400',
  replied: 'bg-cyan-400',
  meeting: 'bg-yellow-400',
  valuation: 'bg-orange-400',
  negotiating: 'bg-purple-400',
  closed_won: 'bg-green-500',
  closed_lost: 'bg-red-400',
};

interface Props {
  counts: Partial<Record<DealStatus, number>>;
}

export function PipelineFunnel({ counts }: Props) {
  const activeStatuses = STATUS_ORDER.filter((s) => s !== 'closed_lost');
  const max = Math.max(...activeStatuses.map((s) => counts[s] ?? 0), 1);

  return (
    <div className="space-y-2">
      {activeStatuses.map((status) => {
        const count = counts[status] ?? 0;
        const pct = Math.round((count / max) * 100);
        return (
          <Link
            key={status}
            href={`/?status=${status}`}
            className="flex items-center gap-3 group"
          >
            <span className="text-xs text-gray-500 w-20 shrink-0 text-right">
              {STATUS_LABELS[status]}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${STATUS_BAR_COLORS[status]} ${count === 0 ? 'opacity-30' : ''}`}
                style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700 w-6 shrink-0">
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
