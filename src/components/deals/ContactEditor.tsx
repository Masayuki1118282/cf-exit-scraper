'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  dealId: string;
  contactEmail: string | null;
  contactSnsUrl: string | null;
  contactNote: string | null;
}

export function ContactEditor({ dealId, contactEmail, contactSnsUrl, contactNote }: Props) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(contactEmail ?? '');
  const [sns, setSns] = useState(contactSnsUrl ?? '');
  const [note, setNote] = useState(contactNote ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSave() {
    setError('');
    startTransition(async () => {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_email: email.trim() || null,
          contact_sns_url: sns.trim() || null,
          contact_note: note.trim() || null,
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
    const hasAny = contactEmail || contactSnsUrl || contactNote;
    return (
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">連絡先</p>
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
            編集
          </button>
        </div>
        {hasAny ? (
          <div className="space-y-1 text-sm">
            {contactEmail && (
              <p className="text-gray-700">
                <span className="text-xs text-gray-400 mr-2">メール</span>
                <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>
              </p>
            )}
            {contactSnsUrl && (
              <p className="text-gray-700">
                <span className="text-xs text-gray-400 mr-2">SNS</span>
                <a href={contactSnsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-xs inline-block">{contactSnsUrl}</a>
              </p>
            )}
            {contactNote && (
              <p className="text-gray-700 whitespace-pre-wrap">
                <span className="text-xs text-gray-400 mr-2">メモ</span>
                {contactNote}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">未設定</p>
        )}
      </div>
    );
  }

  return (
    <div className="pt-3 border-t space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
          placeholder="contact@example.com"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">SNS / DM URL</label>
        <input
          type="url"
          value={sns}
          onChange={(e) => setSns(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
          placeholder="https://twitter.com/..."
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">連絡先メモ</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B] resize-none"
          placeholder="問い合わせ方法など"
        />
      </div>
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
