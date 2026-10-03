'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageField } from './ImageField';

export interface SettingField {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'checkbox' | 'email' | 'url' | 'password' | 'image';
  full?: boolean;
  placeholder?: string;
  help?: string;
}

/**
 * Edits one SiteSetting JSON blob. Secrets (TAPP keys, webhook secrets) are
 * rendered as password fields and are only sent when the operator types a new
 * value, so a saved credential is never round-tripped to the browser.
 */
export function SettingForm({
  settingKey,
  initial,
  fields,
  dict,
  locale = 'en',
}: {
  settingKey: string;
  initial: Record<string, unknown>;
  fields: SettingField[];
  dict: { common: Record<string, string>; settings?: Record<string, string> };
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
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: settingKey, value: data }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
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

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} className={f.full ? 'sm:col-span-2' : undefined}>
          {f.type === 'checkbox' ? (
            <span className="flex items-center gap-2 text-small text-ink">
              <input type="checkbox" checked={Boolean(data[f.key])} onChange={(e) => set(f.key, e.target.checked)} className="h-4 w-4 accent-ink" />
              {f.label}
            </span>
          ) : (
            <>
              <span className="adm-kpi-label">{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea rows={3} value={String(data[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} className="adm-input mt-1 resize-y" placeholder={f.placeholder} />
              ) : f.type === 'image' ? (
                <ImageField value={String(data[f.key] ?? '')} onChange={(url) => set(f.key, url)} locale={locale} />
              ) : (
                <input
                  type={f.type ?? 'text'}
                  value={String(data[f.key] ?? '')}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="adm-input mt-1"
                  placeholder={f.placeholder}
                  autoComplete={f.type === 'password' ? 'new-password' : undefined}
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
