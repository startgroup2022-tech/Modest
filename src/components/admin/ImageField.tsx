'use client';

import { useRef, useState } from 'react';

/**
 * Image value editor that accepts a real file upload (stored via
 * `/api/admin/media`) or a pasted URL. Used for logos, hero/banner imagery,
 * product gallery images and CMS images so operators never have to host
 * assets elsewhere.
 */
export function ImageField({
  value,
  onChange,
  locale,
  accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/x-icon',
}: {
  value: string;
  onChange: (url: string) => void;
  locale: 'en' | 'ar';
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/media', { method: 'POST', body: form });
      const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !out.url) {
        setError(out.error ?? t('Upload failed', 'فشل الرفع'));
        return;
      }
      onChange(out.url);
    } catch {
      setError(t('Network error', 'خطأ في الشبكة'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 grid gap-2">
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-line bg-paper-subtle">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-caption text-ink-faint">{t('No image', 'لا صورة')}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 grid gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="adm-input"
            placeholder="/uploads/… or https://…"
            dir="ltr"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="adm-btn-outline">
              {busy ? t('Uploading…', 'جارٍ الرفع…') : t('Upload file', 'رفع ملف')}
            </button>
            {value ? (
              <button
                type="button"
                onClick={async () => {
                  onChange('');
                  await fetch('/api/admin/media', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: value }),
                  }).catch(() => {});
                }}
                className="text-caption text-danger"
              >
                {t('Remove', 'إزالة')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
