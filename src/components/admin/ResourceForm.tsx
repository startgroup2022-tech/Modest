'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TRANSFORMS } from './transforms';
import { ImageField } from './ImageField';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'email' | 'url' | 'image';
  options?: { value: string; label: string }[];
  step?: string;
  placeholder?: string;
  full?: boolean;
  help?: string;
}

/**
 * Declarative create/edit form shared by the simpler admin resources
 * (coupons, promotions, shipping, pages, currencies…). Numbers are coerced,
 * empty strings become null so optional fields clear cleanly.
 */
export function ResourceForm({
  endpoint,
  initial,
  fields,
  dict,
  redirectTo,
  transformKey,
  locale = 'en',
}: {
  endpoint: string;
  initial: Record<string, unknown>;
  fields: FieldDef[];
  dict: { common: Record<string, string> };
  redirectTo?: string;
  /** Key into {@link TRANSFORMS} for server-safe payload coercion. */
  transformKey?: string;
  locale?: 'en' | 'ar';
}) {
  const router = useRouter();
  const c = dict.common;
  const [data, setData] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set(key: string, value: unknown) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let payload: Record<string, unknown> = { ...data };
      const transform = transformKey ? TRANSFORMS[transformKey] : undefined;
      payload = transform ? transform(payload) : payload;
      const id = data.id as string | undefined;
      const res = await fetch(id ? `${endpoint}/${id}` : endpoint, {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
        setBusy(false);
        return;
      }
      setSaved(true);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} className={f.full ? 'sm:col-span-2' : undefined}>
          {f.type === 'checkbox' ? (
            <span className="flex items-center gap-2 text-small text-ink">
              <input
                type="checkbox"
                checked={Boolean(data[f.key])}
                onChange={(e) => set(f.key, e.target.checked)}
                className="h-4 w-4 accent-ink"
              />
              {f.label}
            </span>
          ) : (
            <>
              <span className="adm-kpi-label">{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea
                  value={String(data[f.key] ?? '')}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={4}
                  className="adm-input mt-1 resize-y"
                  placeholder={f.placeholder}
                />
              ) : f.type === 'image' ? (
                <ImageField
                  value={String(data[f.key] ?? '')}
                  onChange={(url) => set(f.key, url)}
                  locale={locale}
                />
              ) : f.type === 'select' ? (
                <select value={String(data[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} className="adm-select mt-1">
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type ?? 'text'}
                  step={f.step}
                  value={String(data[f.key] ?? '')}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="adm-input mt-1"
                  placeholder={f.placeholder}
                />
              )}
              {f.help && <span className="mt-1 block text-caption text-ink-faint">{f.help}</span>}
            </>
          )}
        </label>
      ))}
      {error && <p className="text-caption text-danger sm:col-span-2">{error}</p>}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className="adm-btn-primary">
          {busy ? c.saving : c.save}
        </button>
        {saved && <span className="text-small text-success">{c.saved}</span>}
      </div>
    </form>
  );
}
