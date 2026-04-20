'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function DeleteDealButton({ dealId }: { dealId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      await fetch(`/api/deals/${dealId}`, { method: 'DELETE' });
      router.push('/');
    });
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-red-500 hover:text-red-700 hover:underline"
      >
        この案件を削除
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600">本当に削除しますか？</span>
      <Button
        size="sm"
        variant="destructive"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs h-7 px-3"
      >
        {isPending ? '削除中...' : '削除する'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setConfirming(false)}
        className="text-xs h-7 px-3"
      >
        キャンセル
      </Button>
    </div>
  );
}
