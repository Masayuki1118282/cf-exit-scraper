'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { DealStatus } from '@/types/deal';

interface Props {
  dealId: string;
  estimatedPrice: number | null;
  estimatedCommission: number | null;
  actualPrice: number | null;
  actualCommission: number | null;
  status: DealStatus;
}

function formatAmount(amount: number | null) {
  if (!amount) return '';
  return amount.toLocaleString();
}

export function PriceEditor({ dealId, estimatedPrice, estimatedCommission, actualPrice, actualCommission, status }: Props) {
  const [editing, setEditing] = useState(false);
  const [estPrice, setEstPrice] = useState(estimatedPrice?.toString() ?? '');
  const [actPrice, setActPrice] = useState(actualPrice?.toString() ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();

  const isClosedWon = status === 'closed_won';

  function calcCommission(price: string) {
    const n = parseInt(price.replace(/,/g, ''), 10);
    return isNaN(n) ? null : Math.round(n * 0.1);
  }

  async function handleSave() {
    setError('');
    const ep = parseInt(estPrice.replace(/,/g, ''), 10) || null;
    const ap = isClosedWon ? (parseInt(actPrice.replace(/,/g, ''), 10) || null) : null;

    startTransition(async () => {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimated_price: ep,
          estimated_commission: ep ? Math.round(ep * 0.1) : null,
          actual_price: ap,
          actual_commission: ap ? Math.round(ap * 0.1) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed');
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">売上予測</p>
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
            編集
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">想定譲渡価格</p>
            <p className="font-semibold">{estimatedPrice ? `¥${formatAmount(estimatedPrice)}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">想定手数料（10%）</p>
            <p className="font-semibold text-green-700">{estimatedCommission ? `¥${formatAmount(estimatedCommission)}` : '-'}</p>
          </div>
          {isClosedWon && (
            <>
              <div>
                <p className="text-xs text-gray-400">実成約価格</p>
                <p className="font-semibold">{actualPrice ? `¥${formatAmount(actualPrice)}` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">実手数料</p>
                <p className="font-semibold text-green-700">{actualCommission ? `¥${formatAmount(actualCommission)}` : '-'}</p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">想定譲渡価格（円）</label>
        <input
          type="text"
          value={estPrice}
          onChange={(e) => setEstPrice(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
          placeholder="5000000"
        />
        {estPrice && (
          <p className="text-xs text-green-700 mt-0.5">
            想定手数料: ¥{(calcCommission(estPrice) ?? 0).toLocaleString()}
          </p>
        )}
      </div>
      {isClosedWon && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">実成約価格（円）</label>
          <input
            type="text"
            value={actPrice}
            onChange={(e) => setActPrice(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
            placeholder="4800000"
          />
          {actPrice && (
            <p className="text-xs text-green-700 mt-0.5">
              実手数料: ¥{(calcCommission(actPrice) ?? 0).toLocaleString()}
            </p>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending} className="bg-[#1B2B4B] hover:bg-[#243860] text-white">
          {isPending ? '保存中...' : '保存'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
      </div>
    </div>
  );
}
