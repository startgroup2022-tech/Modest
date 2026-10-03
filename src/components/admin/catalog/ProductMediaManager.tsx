'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Media {
  id: string;
  url: string;
  altEn: string;
  altAr: string;
  isPrimary: boolean;
}

export function ProductMediaManager({
  productId,
  media,
  locale,
  dict,
}: {
  productId: string;
  media: Media[];
  locale: 'en' | 'ar';
  dict: { products: Record<string, string>; common: Record<string, string> };
}) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [altEn, setAltEn] = useState('');
  const [altAr, setAltAr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, id?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/media${id ? `/${id}` : ''}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(out.error ?? 'Failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    await call('POST', { url, altEn, altAr, isPrimary: media.length === 0 });
    setUrl('');
    setAltEn('');
    setAltAr('');
  }

  return (
    <div>
      {media.length > 0 ? (
        <ul className="divide-y divide-line">
          {media.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={locale === 'ar' ? m.altAr : m.altEn} className="h-16 w-12 shrink-0 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption text-ink-muted">{m.url}</p>
                {m.isPrimary && <span className="adm-badge-accent mt-1 inline-block">{dict.products.primary}</span>}
              </div>
              <div className="flex flex-col gap-1">
                {!m.isPrimary && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call('PATCH', { isPrimary: true }, m.id)}
                    className="text-caption text-ink-muted hover:text-ink"
                  >
                    {dict.products.primary}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => call('DELETE', undefined, m.id)}
                  className="text-caption text-danger"
                >
                  {dict.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-4 text-small text-ink-muted">{dict.products.saveFirst}</p>
      )}

      <form onSubmit={add} className="grid gap-2 border-t border-line p-4">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={dict.products.imageUrl} className="adm-input" required />
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={altEn} onChange={(e) => setAltEn(e.target.value)} placeholder={`${dict.products.altText} (EN)`} className="adm-input" />
          <input value={altAr} onChange={(e) => setAltAr(e.target.value)} placeholder={`${dict.products.altText} (AR)`} className="adm-input" />
        </div>
        <button type="submit" disabled={busy} className="adm-btn-outline">
          + {dict.products.media}
        </button>
        {error && <p className="text-caption text-danger">{error}</p>}
      </form>
    </div>
  );
}
