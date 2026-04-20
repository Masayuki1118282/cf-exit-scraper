'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  dealId: string;
  projectUrl: string;
}

export function RefreshPreviewButton({ dealId, projectUrl }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  function handleRefresh() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const previewRes = await fetch(`/api/preview/refresh?url=${encodeURIComponent(projectUrl)}`);
      if (!previewRes.ok) {
        const body = await previewRes.json().catch(() => ({}));
        setError(body.error ?? 'プレビュー取得に失敗しました');
        return;
      }
      const preview = await previewRes.json();
      const patchRes = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: preview.platform,
          project_title: preview.project_title,
          project_image_url: preview.project_image_url,
          owner_name: preview.owner_name,
          owner_company: preview.owner_company,
          achieved_amount: preview.achieved_amount,
          supporter_count: preview.supporter_count,
          category: preview.category,
          project_end_date: preview.project_end_date,
        }),
      });
      if (!patchRes.ok) {
        setError('DB更新に失敗しました');
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={isPending}
        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
      >
        {isPending ? '取得中...' : '↻ プレビュー再取得'}
      </button>
      {done && <span className="text-xs text-green-600">✓ 更新しました</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
