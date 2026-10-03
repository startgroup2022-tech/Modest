'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ProductFormData {
  id?: string;
  slug: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  subtitleEn: string;
  subtitleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  materialsEn: string;
  materialsAr: string;
  careEn: string;
  careAr: string;
  priceBhd: string;
  compareAtBhd: string;
  status: string;
  kind: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  madeToOrder: boolean;
  leadTimeMinDays: string;
  leadTimeMaxDays: string;
  lowStockThreshold: string;
  metaTitleEn: string;
  metaTitleAr: string;
  metaDescEn: string;
  metaDescAr: string;
  noIndex: boolean;
  categoryIds: string[];
  collectionIds: string[];
}

export const emptyProduct: ProductFormData = {
  slug: '',
  sku: '',
  nameEn: '',
  nameAr: '',
  subtitleEn: '',
  subtitleAr: '',
  descriptionEn: '',
  descriptionAr: '',
  materialsEn: '',
  materialsAr: '',
  careEn: '',
  careAr: '',
  priceBhd: '',
  compareAtBhd: '',
  status: 'DRAFT',
  kind: 'READY_TO_WEAR',
  isFeatured: false,
  isNewArrival: false,
  madeToOrder: false,
  leadTimeMinDays: '14',
  leadTimeMaxDays: '21',
  lowStockThreshold: '5',
  metaTitleEn: '',
  metaTitleAr: '',
  metaDescEn: '',
  metaDescAr: '',
  noIndex: false,
  categoryIds: [],
  collectionIds: [],
};

const TABS = ['general', 'contentTab', 'pricing', 'madeToOrderTab', 'seoTab'] as const;

export function ProductForm({
  initial,
  categories,
  collections,
  dict,
  locale,
}: {
  initial: ProductFormData;
  categories: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  dict: Record<string, Record<string, string>>;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const p = dict.products;
  const c = dict.common;
  const [tab, setTab] = useState<(typeof TABS)[number]>('general');
  const [data, setData] = useState<ProductFormData>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...data,
        priceBhd: Number(data.priceBhd),
        compareAtBhd: data.compareAtBhd ? Number(data.compareAtBhd) : null,
        leadTimeMinDays: Number(data.leadTimeMinDays),
        leadTimeMaxDays: Number(data.leadTimeMaxDays),
        lowStockThreshold: Number(data.lowStockThreshold),
        sku: data.sku || null,
        slug: data.slug || undefined,
      };
      const res = await fetch(data.id ? `/api/admin/products/${data.id}` : '/api/admin/products', {
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
      if (!data.id && out.id) router.push(`/${locale}/admin/products/${out.id}`);
      else router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, key: keyof ProductFormData, type: 'text' | 'textarea' | 'number' = 'text') => (
    <label className="block">
      <span className="adm-kpi-label">{label}</span>
      {type === 'textarea' ? (
        <textarea
          value={String(data[key] ?? '')}
          onChange={(e) => set(key, e.target.value as never)}
          rows={4}
          className="adm-input mt-1 resize-y"
        />
      ) : (
        <input
          type={type}
          step={type === 'number' ? '0.001' : undefined}
          value={String(data[key] ?? '')}
          onChange={(e) => set(key, e.target.value as never)}
          className="adm-input mt-1"
        />
      )}
    </label>
  );

  const check = (label: string, key: keyof ProductFormData) => (
    <label className="flex items-center gap-2 text-small text-ink">
      <input
        type="checkbox"
        checked={Boolean(data[key])}
        onChange={(e) => set(key, e.target.checked as never)}
        className="h-4 w-4 accent-ink"
      />
      {label}
    </label>
  );

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="adm-scroll flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[0.8125rem] transition-colors ${
              tab === t ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {p[t]}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="grid gap-5 sm:grid-cols-2">
          {field(p.nameEn, 'nameEn')}
          {field(p.nameAr, 'nameAr')}
          {field(p.subtitleEn, 'subtitleEn')}
          {field(p.subtitleAr, 'subtitleAr')}
          {field('Slug', 'slug')}
          {field(c.sku, 'sku')}
          <label className="block">
            <span className="adm-kpi-label">{p.status}</span>
            <select value={data.status} onChange={(e) => set('status', e.target.value)} className="adm-select mt-1">
              <option value="DRAFT">{locale === 'ar' ? 'مسودة' : 'Draft'}</option>
              <option value="ACTIVE">{locale === 'ar' ? 'نشط' : 'Active'}</option>
              <option value="ARCHIVED">{locale === 'ar' ? 'مؤرشف' : 'Archived'}</option>
            </select>
          </label>
          <label className="block">
            <span className="adm-kpi-label">{p.kind}</span>
            <select value={data.kind} onChange={(e) => set('kind', e.target.value)} className="adm-select mt-1">
              <option value="READY_TO_WEAR">{locale === 'ar' ? 'جاهز للارتداء' : 'Ready to wear'}</option>
              <option value="MADE_TO_ORDER">{locale === 'ar' ? 'حسب الطلب' : 'Made to order'}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
            {check(p.featured, 'isFeatured')}
            {check(p.newArrival, 'isNewArrival')}
            {check(p.madeToOrderTab, 'madeToOrder')}
          </div>
          <div className="sm:col-span-2">
            <span className="adm-kpi-label">{c.category}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 border border-line px-3 py-1.5 text-small">
                  <input
                    type="checkbox"
                    checked={data.categoryIds.includes(cat.id)}
                    onChange={(e) =>
                      set('categoryIds', e.target.checked ? [...data.categoryIds, cat.id] : data.categoryIds.filter((x) => x !== cat.id))
                    }
                    className="h-3.5 w-3.5 accent-ink"
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <span className="adm-kpi-label">{c.collection}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {collections.map((col) => (
                <label key={col.id} className="flex items-center gap-2 border border-line px-3 py-1.5 text-small">
                  <input
                    type="checkbox"
                    checked={data.collectionIds.includes(col.id)}
                    onChange={(e) =>
                      set('collectionIds', e.target.checked ? [...data.collectionIds, col.id] : data.collectionIds.filter((x) => x !== col.id))
                    }
                    className="h-3.5 w-3.5 accent-ink"
                  />
                  {col.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'contentTab' && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{field(p.descriptionEn, 'descriptionEn', 'textarea')}</div>
          <div className="sm:col-span-2">{field(p.descriptionAr, 'descriptionAr', 'textarea')}</div>
          {field(p.materialsEn, 'materialsEn', 'textarea')}
          {field(p.materialsAr, 'materialsAr', 'textarea')}
          {field(p.careEn, 'careEn', 'textarea')}
          {field(p.careAr, 'careAr', 'textarea')}
        </div>
      )}

      {tab === 'pricing' && (
        <div className="grid gap-5 sm:grid-cols-3">
          {field(p.priceBhd, 'priceBhd', 'number')}
          {field(p.compareAtBhd, 'compareAtBhd', 'number')}
          {field(p.lowStockThreshold, 'lowStockThreshold', 'number')}
        </div>
      )}

      {tab === 'madeToOrderTab' && (
        <div className="grid gap-5 sm:grid-cols-2">
          {check(p.madeToOrderTab, 'madeToOrder')}
          {field(`${p.leadTime} — min`, 'leadTimeMinDays', 'number')}
          {field(`${p.leadTime} — max`, 'leadTimeMaxDays', 'number')}
        </div>
      )}

      {tab === 'seoTab' && (
        <div className="grid gap-5 sm:grid-cols-2">
          {field('Meta title (EN)', 'metaTitleEn')}
          {field('Meta title (AR)', 'metaTitleAr')}
          <div className="sm:col-span-2">{field('Meta description (EN)', 'metaDescEn', 'textarea')}</div>
          <div className="sm:col-span-2">{field('Meta description (AR)', 'metaDescAr', 'textarea')}</div>
          <div className="sm:col-span-2">{check('noindex', 'noIndex')}</div>
        </div>
      )}

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-paper py-4">
        <button type="submit" disabled={busy} className="adm-btn-primary">
          {busy ? c.saving : c.save}
        </button>
        {saved && <span className="text-small text-success">{c.saved}</span>}
        {error && <span className="text-caption text-danger">{error}</span>}
        <button type="button" onClick={() => router.back()} className="adm-btn-ghost ms-auto">
          {c.cancel}
        </button>
      </div>
    </form>
  );
}
