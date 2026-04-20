'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  dealId: string;
}

function toInt(val: string): number {
  return parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
}

function fmt(n: number): string {
  if (n <= 0) return '-';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}億円`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}万円`;
  return `${n.toLocaleString()}円`;
}

export function ValuationCalculator({ dealId }: Props) {
  const [open, setOpen] = useState(false);

  // Inputs
  const [monthlySales, setMonthlySales] = useState('');
  const [marginPct, setMarginPct] = useState('30');
  const [multipleMonths, setMultipleMonths] = useState('12');
  const [trademarkValue, setTrademarkValue] = useState('');
  const [inventoryValue, setInventoryValue] = useState('');
  const [otherAssets, setOtherAssets] = useState('');

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  // Calculations
  const monthlyProfit = Math.round(toInt(monthlySales) * (toInt(marginPct) / 100));
  const businessValue = monthlyProfit * toInt(multipleMonths);
  const assetTotal = toInt(trademarkValue) + toInt(inventoryValue) + toInt(otherAssets);
  const totalPrice = businessValue + assetTotal;
  const commission = Math.round(totalPrice * 0.1);

  function handleSave() {
    if (totalPrice <= 0) return;
    setSaved(false);
    startTransition(async () => {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimated_price: totalPrice,
          estimated_commission: commission,
        }),
      });
      setSaved(true);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="pt-3 border-t">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          + バリュエーション計算機を使う
        </button>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">バリュエーション計算機</p>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">閉じる</button>
      </div>

      {/* 事業価値セクション */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">事業価値</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">月間売上（円）</label>
            <input
              type="text"
              inputMode="numeric"
              value={monthlySales}
              onChange={(e) => setMonthlySales(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
              placeholder="500000"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">利益率（%）</label>
            <input
              type="number"
              min="0"
              max="100"
              value={marginPct}
              onChange={(e) => setMarginPct(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
              placeholder="30"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            評価倍率：<span className="font-semibold text-gray-700">{multipleMonths}ヶ月分</span>
            <span className="text-gray-400 ml-1">（通常12〜24ヶ月）</span>
          </label>
          <input
            type="range"
            min="6"
            max="36"
            step="3"
            value={multipleMonths}
            onChange={(e) => setMultipleMonths(e.target.value)}
            className="w-full accent-[#1B2B4B]"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>6ヶ月</span><span>18ヶ月</span><span>36ヶ月</span>
          </div>
        </div>
        {monthlyProfit > 0 && (
          <div className="text-xs text-gray-500 space-y-0.5 bg-gray-50 rounded px-3 py-2">
            <p>月間利益: <span className="font-medium text-gray-700">{fmt(monthlyProfit)}</span></p>
            <p>事業価値: <span className="font-semibold text-[#1B2B4B]">{fmt(businessValue)}</span>
              <span className="text-gray-400 ml-1">（月間利益 × {multipleMonths}ヶ月）</span>
            </p>
          </div>
        )}
      </div>

      {/* 資産価値セクション */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">資産価値</p>
        <div>
          <label className="block text-xs text-gray-500 mb-1">商標・ブランド価値（円）</label>
          <input
            type="text"
            inputMode="numeric"
            value={trademarkValue}
            onChange={(e) => setTrademarkValue(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">在庫評価額（円）</label>
          <input
            type="text"
            inputMode="numeric"
            value={inventoryValue}
            onChange={(e) => setInventoryValue(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ECサイト・その他資産（円）</label>
          <input
            type="text"
            inputMode="numeric"
            value={otherAssets}
            onChange={(e) => setOtherAssets(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
            placeholder="0"
          />
        </div>
        {assetTotal > 0 && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
            資産合計: <span className="font-semibold text-[#1B2B4B]">{fmt(assetTotal)}</span>
          </p>
        )}
      </div>

      {/* 合計 */}
      {totalPrice > 0 && (
        <div className="rounded-xl bg-[#1B2B4B]/5 border border-[#1B2B4B]/20 p-4 space-y-1">
          <div className="flex justify-between items-baseline">
            <p className="text-xs text-gray-500">事業価値</p>
            <p className="text-sm font-medium text-gray-700">{fmt(businessValue)}</p>
          </div>
          {assetTotal > 0 && (
            <div className="flex justify-between items-baseline">
              <p className="text-xs text-gray-500">資産価値</p>
              <p className="text-sm font-medium text-gray-700">{fmt(assetTotal)}</p>
            </div>
          )}
          <div className="border-t pt-1 mt-1 flex justify-between items-baseline">
            <p className="text-sm font-bold text-[#1B2B4B]">想定譲渡価格</p>
            <p className="text-lg font-bold text-[#1B2B4B]">{fmt(totalPrice)}</p>
          </div>
          <div className="flex justify-between items-baseline">
            <p className="text-xs text-green-700">想定手数料（10%）</p>
            <p className="text-sm font-semibold text-green-700">{fmt(commission)}</p>
          </div>
        </div>
      )}

      {totalPrice > 0 && (
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-[#1B2B4B] hover:bg-[#243860] text-white text-sm"
          >
            {isPending ? '設定中...' : 'この価格を想定譲渡価格に設定する'}
          </Button>
          {saved && <span className="text-xs text-green-600">✓ 保存しました</span>}
        </div>
      )}
    </div>
  );
}
