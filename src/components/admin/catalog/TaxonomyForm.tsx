'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface TaxonomyData {
  id?: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  imageUrl: string;
  taglineEn?: string;
  taglineAr?: string;
  metaTitleEn: string;
  metaTitleAr: string;
  metaDescEn: string;
  metaDescAr: string;
  noIndex: boolean;
  isActive: boolean;
  isFeatured?: boolean;
  sortOrder: string;
}

export function TaxonomyForm({
  kind,
  initial,
  dict,
  locale,
}: {
  kind: 'categories' | 'collections';
  initial: TaxonomyData;
  dict: Record<string, Record<string, string>>;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const c = dict.common;
  const isCollection = kind === 'collections';

  function set<K extends keyof TaxonomyData>(key: K, value: TaxonomyData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...data,
        sortOrder: Number(data.sortOrder) || 0,
        slug: data.slug || undefined,
      };
      const res = await fetch(data.id ? `/api/admin/${kind}/${data.id}` : `/api/admin/${kind}`, {
        method: data.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
        setBusy(false);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, key: keyof TaxonomyData, type: 'text' | 'textarea' = 'text') => (
    <label className="block">
      <span className="adm-kpi-label">{label}</span>
      {type === 'textarea' ? (
        <textarea value={String(data[key] ?? '')} onChange={(e) => set(key, e.target.value as never)} rows={3} className="adm-input mt-1 resize-y" />
      ) : (
        <input value={String(data[key] ?? '')} onChange={(e) => set(key, e.target.value as never)} className="adm-input mt-1" />
      )}
    </label>
  );

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      {field(`${c.language === 'Language' ? 'Name' : 'الاسم'} (EN)`, 'nameEn')}
      {field(`الاسم (AR)`, 'nameAr')}
      {field('Slug', 'slug')}
      {field(locale === 'ar' ? 'ترتيب العرض' : 'Sort order', 'sortOrder')}
      {isCollection && field('Tagline (EN)', 'taglineEn')}
      {isCollection && field('Tagline (AR)', 'taglineAr')}
      <div className="sm:col-span-2">{field(locale === 'ar' ? 'الوصف (EN)' : 'Description (EN)', 'descriptionEn', 'textarea')}</div>
      <div className="sm:col-span-2">{field('الوصف (AR)', 'descriptionAr', 'textarea')}</div>
      <div className="sm:col-span-2">{field(locale === 'ar' ? 'رابط الصورة' : 'Image URL', 'imageUrl')}</div>
      {field('Meta title (EN)', 'metaTitleEn')}
      {field('Meta title (AR)', 'metaTitleAr')}
      <div className="sm:col-span-2">{field('Meta description (EN)', 'metaDescEn', 'textarea')}</div>
      <div className="sm:col-span-2">{field('Meta description (AR)', 'metaDescAr', 'textarea')}</div>
      <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
        <label className="flex items-center gap-2 text-small text-ink">
          <input type="checkbox" checked={data.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 accent-ink" />
          {c.enabled}
        </label>
        {isCollection && (
          <label className="flex items-center gap-2 text-small text-ink">
            <input type="checkbox" checked={Boolean(data.isFeatured)} onChange={(e) => set('isFeatured', e.target.checked)} className="h-4 w-4 accent-ink" />
            {dict.products?.featured ?? 'Featured'}
          </label>
        )}
        <label className="flex items-center gap-2 text-small text-ink">
          <input type="checkbox" checked={data.noIndex} onChange={(e) => set('noIndex', e.target.checked)} className="h-4 w-4 accent-ink" />
          noindex
        </label>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className="adm-btn-primary">
          {busy ? c.saving : c.save}
        </button>
        {saved && <span className="text-small text-success">{c.saved}</span>}
        {error && <span className="text-caption text-danger">{error}</span>}
      </div>
    </form>
  );
}
