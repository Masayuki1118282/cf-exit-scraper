'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { NoteType } from '@/types/deal';

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  dm_sent: 'DM送信',
  reply_received: '返信受信',
  meeting: '面談',
  memo: 'メモ',
  status_change: 'ステータス変更',
};

export function NoteForm({ dealId }: { dealId: string }) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('memo');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError('');

    startTransition(async () => {
      const res = await fetch(`/api/deals/${dealId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_type: noteType, content: content.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed');
        return;
      }
      setContent('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as NoteType)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
        >
          {(Object.entries(NOTE_TYPE_LABELS) as [NoteType, string][])
            .filter(([t]) => t !== 'status_change')
            .map(([t, label]) => (
              <option key={t} value={t}>{label}</option>
            ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="メモを入力..."
        rows={3}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B] resize-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={!content.trim() || isPending}
        size="sm"
        className="bg-[#1B2B4B] hover:bg-[#243860] text-white"
      >
        {isPending ? '保存中...' : 'メモを追加'}
      </Button>
    </form>
  );
}
