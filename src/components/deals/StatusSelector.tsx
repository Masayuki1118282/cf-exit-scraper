'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS, STATUS_ORDER, type DealStatus } from '@/types/deal';

export function StatusSelector({ dealId, currentStatus }: { dealId: string; currentStatus: DealStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleChange(newStatus: DealStatus) {
    if (newStatus === currentStatus) return;
    setError('');
    startTransition(async () => {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, add_note: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <select
        value={currentStatus}
        onChange={(e) => handleChange(e.target.value as DealStatus)}
        disabled={isPending}
        className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B] disabled:opacity-60"
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
