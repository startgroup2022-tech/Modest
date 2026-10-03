'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface MethodConfig {
  method: string;
  enabled: boolean;
  visible: boolean;
  sortOrder: number;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  instructionsEn: string;
  instructionsAr: string;
  minOrderBhd: number | null;
  maxOrderBhd: number | null;
}

interface Props {
  configs: MethodConfig[];
  locale: 'en' | 'ar';
  labels: Record<string, string>;
  canEdit: boolean;
}

/**
 * Full operational control for the four payment methods. Everything the owner
 * changes here is persisted to `payments_config` and read back by the checkout.
 */
export function PaymentMethodManager({ configs, locale, labels, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<MethodConfig[]>(configs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<{ state: string; ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function patch(method: string, key: keyof MethodConfig, value: unknown) {
    setRows((r) => r.map((row) => (row.method === method ? { ...row, [key]: value } : row)));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, MethodConfig> = {};
      for (const row of rows) {
        const norm = (v: number | null) => (v === null || v === undefined || Number(v) <= 0 ? null : Number(v));
        payload[row.method] = {
          ...row,
          minOrderBhd: norm(row.minOrderBhd),
          maxOrderBhd: norm(row.maxOrderBhd),
        };
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'payments_config', value: payload }),
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

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch('/api/admin/payments/tapp-test', { method: 'POST' });
      const out = (await res.json().catch(() => ({}))) as { state?: string; ok?: boolean; message?: string };
      setTest({ state: out.state ?? 'failed', ok: Boolean(out.ok), message: out.message ?? '' });
    } catch {
      setTest({ state: 'failed', ok: false, message: 'Network error' });
    } finally {
      setTesting(false);
    }
  }

  const f = (method: string, label: string, node: React.ReactNode, full = false) => (
    <label key={`${method}-${label}`} className={cn('block', full && 'sm:col-span-2')}>
      <span className="adm-kpi-label">{label}</span>
      {node}
    </label>
  );

  const input = (method: string, key: keyof MethodConfig, type = 'text') => (
    <input
      type={type}
      value={String(rows.find((r) => r.method === method)?.[key] ?? '')}
      disabled={!canEdit}
      onChange={(e) => patch(method, key, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      className="adm-input mt-1"
    />
  );

  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <div key={row.method} className="border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper-warm px-4 py-3">
            <span className="font-medium text-ink">{row.method.replace(/_/g, ' ')}</span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-small text-ink">
                <input type="checkbox" checked={row.enabled} disabled={!canEdit} onChange={(e) => patch(row.method, 'enabled', e.target.checked)} className="h-4 w-4 accent-ink" />
                {labels.methodEnabled}
              </label>
              <label className="flex items-center gap-2 text-small text-ink">
                <input type="checkbox" checked={row.visible} disabled={!canEdit} onChange={(e) => patch(row.method, 'visible', e.target.checked)} className="h-4 w-4 accent-ink" />
                {labels.methodVisible}
              </label>
            </div>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {f(row.method, labels.methodLabelEn, input(row.method, 'labelEn'))}
            {f(row.method, labels.methodLabelAr, input(row.method, 'labelAr'))}
            {f(row.method, labels.methodDescEn, input(row.method, 'descriptionEn'), true)}
            {f(row.method, labels.methodDescAr, input(row.method, 'descriptionAr'), true)}
            {f(row.method, labels.instructionsEn, input(row.method, 'instructionsEn'), true)}
            {f(row.method, labels.instructionsAr, input(row.method, 'instructionsAr'), true)}
            {f(row.method, labels.sortOrder, input(row.method, 'sortOrder', 'number'))}
            <span />
            {f(row.method, labels.minOrder, input(row.method, 'minOrderBhd', 'number'))}
            {f(row.method, labels.maxOrder, input(row.method, 'maxOrderBhd', 'number'))}
          </div>
          {row.method === 'TAPP' ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
              <button type="button" onClick={runTest} disabled={testing || !canEdit} className="adm-btn-outline adm-btn-sm">
                {testing ? labels.testConnection : labels.testConnection}
              </button>
              {test ? (
                <span className={cn('text-caption', test.ok ? 'text-success' : 'text-danger')}>
                  {test.ok ? labels.testSuccess : labels.testFailed} — {test.message}
                </span>
              ) : (
                <span className="text-caption text-ink-faint">{labels.testHint}</span>
              )}
            </div>
          ) : null}
        </div>
      ))}

      {error && <p className="text-caption text-danger">{error}</p>}
      {canEdit ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="adm-btn-primary">
            {busy ? labels.saving : labels.saveMethods}
          </button>
          {saved && <span className="text-small text-success">{labels.saved}</span>}
        </div>
      ) : null}
    </div>
  );
}
