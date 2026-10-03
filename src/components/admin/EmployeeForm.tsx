'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface EmployeeRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
  roleId: string;
  roleName: string;
  status: string;
  locale: string;
}

/** Create / edit employee drawer with optional password reset. */
export function EmployeeForm({
  roles,
  initial,
  dict,
  onClose,
}: {
  roles: { id: string; name: string; label: string }[];
  initial?: EmployeeRow;
  dict: { common: Record<string, string>; system: Record<string, string> };
  onClose?: () => void;
}) {
  const router = useRouter();
  const c = dict.common;
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    email: initial?.email ?? '',
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    phone: initial?.phone ?? '',
    jobTitle: initial?.jobTitle ?? '',
    roleId: initial?.roleId ?? roles[0]?.id ?? '',
    status: initial?.status ?? 'ACTIVE',
    locale: initial?.locale ?? 'en',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/admin/employees/${initial!.id}` : '/api/admin/employees', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Save failed');
        return;
      }
      setSaved(true);
      onClose?.();
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const label = (text: string, node: React.ReactNode) => (
    <label className="block">
      <span className="adm-kpi-label">{text}</span>
      {node}
    </label>
  );

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {!isEdit &&
        label(
          'Email',
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} className="adm-input mt-1" />,
        )}
      {label(c.customer === 'Customer' ? 'First name' : 'الاسم الأول', <input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className="adm-input mt-1" />)}
      {label(c.customer === 'Customer' ? 'Last name' : 'اسم العائلة', <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className="adm-input mt-1" />)}
      {label(dict.system.jobTitle, <input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} className="adm-input mt-1" />)}
      {label(c.method === 'Method' ? 'Phone' : 'الهاتف', <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="adm-input mt-1" />)}
      {label(
        dict.system.role,
        <select value={form.roleId} onChange={(e) => set('roleId', e.target.value)} className="adm-select mt-1">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>,
      )}
      {label(
        c.status,
        <select value={form.status} onChange={(e) => set('status', e.target.value)} className="adm-select mt-1">
          <option value="ACTIVE">{c.enabled}</option>
          <option value="INACTIVE">{c.disabled}</option>
          <option value="SUSPENDED">{c.status === 'Status' ? 'Suspended' : 'موقوف'}</option>
        </select>,
      )}
      {label(
        isEdit ? dict.system.newPassword : dict.system.password,
        <input
          type="password"
          required={!isEdit}
          minLength={isEdit ? 0 : 8}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          className="adm-input mt-1"
          autoComplete="new-password"
        />,
      )}
      {error && <p className="text-caption text-danger sm:col-span-2">{error}</p>}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className="adm-btn-primary">
          {busy ? c.saving : c.save}
        </button>
        {saved && <span className={cn('text-small text-success')}>{c.saved}</span>}
      </div>
    </form>
  );
}
