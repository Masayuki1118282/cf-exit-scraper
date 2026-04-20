'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PLATFORM_LABELS, type Platform } from '@/types/deal';

interface Preview {
  platform: Platform;
  project_title: string;
  project_image_url: string | null;
  owner_name: string | null;
  owner_company: string | null;
  achieved_amount: number | null;
  supporter_count: number | null;
  category: string | null;
  project_end_date: string | null;
  cached?: boolean;
}

function formatAmount(amount: number | null) {
  if (!amount) return '-';
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}億円`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000)}万円`;
  return `${amount.toLocaleString()}円`;
}

export default function NewDealPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<'input' | 'loading' | 'preview' | 'manual'>('input');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // manual form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualOwner, setManualOwner] = useState('');
  const [manualCompany, setManualCompany] = useState('');

  const urlRef = useRef<HTMLInputElement>(null);

  async function handleUrlChange(value: string) {
    setUrl(value);
    setFetchError('');

    // Auto-fetch when URL looks complete
    if (!value.startsWith('http')) return;
    try { new URL(value); } catch { return; }

    setStep('loading');
    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPreview(data);
      setStep('preview');
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '情報取得に失敗しました');
      setStep('manual');
    }
  }

  async function handleSubmit() {
    setSubmitError('');
    setIsSubmitting(true);

    const payload = step === 'manual'
      ? {
          project_url: url,
          platform: detectPlatform(url),
          project_title: manualTitle,
          owner_name: manualOwner || null,
          owner_company: manualCompany || null,
        }
      : {
          project_url: url,
          ...preview,
        };

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      router.push(`/deals/${data.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  function detectPlatform(u: string): Platform {
    if (u.includes('makuake.com')) return 'makuake';
    if (u.includes('greenfunding.jp')) return 'greenfunding';
    if (u.includes('camp-fire.jp')) return 'campfire';
    return 'other';
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-[#1B2B4B] text-white px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-white/70 hover:text-white text-sm">← ダッシュボード</Link>
        <h1 className="text-lg font-bold">新規案件追加</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Step 1: URL入力 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            プロジェクトURL
          </label>
          <input
            ref={urlRef}
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.makuake.com/project/..."
            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B] disabled:bg-gray-50"
            disabled={step === 'loading' || isSubmitting}
          />
          <p className="text-xs text-gray-400 mt-1">
            Makuake / GreenFunding / CAMPFIRE のURLを貼り付けると情報を自動取得します
          </p>
        </div>

        {/* Loading */}
        {step === 'loading' && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#1B2B4B] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500">情報を取得中...</p>
          </div>
        )}

        {/* Preview */}
        {step === 'preview' && preview && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-start gap-4">
              {preview.project_image_url && (
                <Image
                  src={preview.project_image_url}
                  alt={preview.project_title}
                  width={96}
                  height={72}
                  className="rounded-lg object-cover flex-shrink-0"
                  unoptimized
                />
              )}
              <div className="flex-1 min-w-0">
                <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mb-1">
                  {PLATFORM_LABELS[preview.platform]}
                </span>
                <h2 className="font-bold text-gray-900 leading-snug">{preview.project_title}</h2>
                {(preview.owner_name || preview.owner_company) && (
                  <p className="text-sm text-gray-500 mt-1">
                    {preview.owner_company && <span>{preview.owner_company} </span>}
                    {preview.owner_name && <span>{preview.owner_name}</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t text-center">
              <div>
                <p className="text-xs text-gray-400">達成額</p>
                <p className="font-bold text-gray-800">{formatAmount(preview.achieved_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">支援者数</p>
                <p className="font-bold text-gray-800">
                  {preview.supporter_count ? `${preview.supporter_count.toLocaleString()}人` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">終了日</p>
                <p className="font-bold text-gray-800">{preview.project_end_date ?? '-'}</p>
              </div>
            </div>

            {preview.cached && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
                このURLは既に登録済みです。再登録しようとしています。
              </p>
            )}

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{submitError}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-[#1B2B4B] hover:bg-[#243860] text-white"
            >
              {isSubmitting ? '登録中...' : 'この案件を登録する'}
            </Button>
          </div>
        )}

        {/* Manual fallback */}
        {step === 'manual' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            {fetchError && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded px-3 py-2">
                自動取得失敗: {fetchError}。手動で入力してください。
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                プロジェクト名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
                placeholder="プロジェクトのタイトル"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">起案者名</label>
              <input
                type="text"
                value={manualOwner}
                onChange={(e) => setManualOwner(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
                placeholder="山田 太郎"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">会社名</label>
              <input
                type="text"
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
                placeholder="株式会社〇〇"
              />
            </div>

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{submitError}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!manualTitle || isSubmitting}
              className="w-full bg-[#1B2B4B] hover:bg-[#243860] text-white"
            >
              {isSubmitting ? '登録中...' : '案件を登録する'}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
