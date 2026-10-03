'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

interface AddressRow {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  area: string | null;
  address: string;
  building: string | null;
  unit: string | null;
  notes: string | null;
  isDefault: boolean;
}

const COUNTRIES = ['Bahrain', 'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Oman'];

export function AddressManager({ locale, dict, addresses }: { locale: Locale; dict: Dict; addresses: AddressRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(addresses.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: '',
    fullName: '',
    phone: '',
    country: 'Bahrain',
    city: '',
    area: '',
    address: '',
    building: '',
    unit: '',
    notes: '',
    isDefault: addresses.length === 0,
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account?kind=address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? dict.errors.generic);
        return;
      }
      setForm({ label: '', fullName: '', phone: '', country: 'Bahrain', city: '', area: '', address: '', building: '', unit: '', notes: '', isDefault: false });
      setAdding(false);
      router.refresh();
    } catch {
      setError(dict.errors.network);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await fetch(`/api/account?id=${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {addresses.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="border border-line p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body">{a.fullName}</p>
                  {a.label ? <p className="text-caption uppercase tracking-[0.1em] text-ink-faint">{a.label}</p> : null}
                </div>
                {a.isDefault ? (
                  <span className="border border-ink px-2 py-0.5 text-caption uppercase tracking-[0.1em]">{dict.account.default}</span>
                ) : null}
              </div>
              <address className="mt-3 text-small not-italic text-ink-muted">
                <p>{a.address}</p>
                {a.building ? <p>{dict.checkout.building}: {a.building}</p> : null}
                {a.unit ? <p>{dict.checkout.unit}: {a.unit}</p> : null}
                {a.area ? <p>{a.area}</p> : null}
                <p>{a.city}, {a.country}</p>
                <p className="mt-1 tabular-nums">{a.phone}</p>
              </address>
              <button
                type="button"
                onClick={() => remove(a.id)}
                disabled={busy}
                className="link-underline mt-4 text-caption uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-danger"
              >
                {dict.account.delete}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className="btn-outline">
          {dict.account.addAddress}
        </button>
      ) : (
        <form onSubmit={save} className="space-y-5 border border-line p-6" noValidate>
          <h3 className="text-h4">{dict.account.addAddress}</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="a-label" label={dict.account.addressLabel} value={form.label} onChange={set('label')} />
            <Field id="a-name" label={dict.checkout.fullName} value={form.fullName} onChange={set('fullName')} required />
            <Field id="a-phone" label={dict.checkout.phone} value={form.phone} onChange={set('phone')} required type="tel" />
            <div>
              <label htmlFor="a-country" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
                {dict.checkout.country}
              </label>
              <select id="a-country" value={form.country} onChange={set('country')} className="field">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Field id="a-city" label={dict.checkout.city} value={form.city} onChange={set('city')} required />
            <Field id="a-area" label={dict.checkout.area} value={form.area} onChange={set('area')} />
            <div className="sm:col-span-2">
              <Field id="a-address" label={dict.checkout.address} value={form.address} onChange={set('address')} required />
            </div>
            <Field id="a-building" label={dict.checkout.building} value={form.building} onChange={set('building')} />
            <Field id="a-unit" label={dict.checkout.unit} value={form.unit} onChange={set('unit')} />
          </div>
          {error ? <p role="alert" className="text-small text-danger">{error}</p> : null}
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? dict.account.saving : dict.account.save}
            </button>
            {addresses.length ? (
              <button type="button" onClick={() => setAdding(false)} className="btn-quiet">
                {dict.account.cancel}
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className={clsx(type === 'text' && 'w-full')}>
      <label htmlFor={id} className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </label>
      <input id={id} type={type} value={value} onChange={onChange} required={required} className="field" />
    </div>
  );
}
