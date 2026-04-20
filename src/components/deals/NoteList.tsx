import type { DealNote, NoteType } from '@/types/deal';

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  dm_sent: 'DM送信',
  reply_received: '返信受信',
  meeting: '面談',
  memo: 'メモ',
  status_change: 'ステータス変更',
};

const NOTE_TYPE_COLORS: Record<NoteType, string> = {
  dm_sent: 'bg-blue-100 text-blue-700',
  reply_received: 'bg-cyan-100 text-cyan-700',
  meeting: 'bg-yellow-100 text-yellow-700',
  memo: 'bg-gray-100 text-gray-600',
  status_change: 'bg-purple-100 text-purple-700',
};

export function NoteList({ notes }: { notes: DealNote[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">まだメモがありません</p>;
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note.id} className="flex gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {note.note_type && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NOTE_TYPE_COLORS[note.note_type]}`}>
                  {NOTE_TYPE_LABELS[note.note_type]}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {new Date(note.created_at).toLocaleString('ja-JP', {
                  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
