'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export function ProfileForm({
  locale,
  dict,
  initial,
}: {
  locale: Locale;
  dict: Dict;
  initial: { firstName: string; lastName: string; phone: string; locale: string; email: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch('/api/account?kind=profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, phone: form.phone, locale: form.locale }),
      });
      setStatus(res.ok ? 'saved' : 'error');
      if (res.ok) router.refresh();
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="p-first" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.account.firstName}
          </label>
          <input id="p-first" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="field" required />
        </div>
        <div>
          <label htmlFor="p-last" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.account.lastName}
          </label>
          <input id="p-last" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="field" required />
        </div>
      </div>
      <div>
        <label htmlFor="p-email" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.account.email}
        </label>
        <input id="p-email" value={form.email} readOnly disabled className="field bg-paper-warm text-ink-faint" />
      </div>
      <div>
        <label htmlFor="p-phone" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.checkout.phone}
        </label>
        <input id="p-phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="field" />
      </div>
      <div>
        <label htmlFor="p-locale" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.account.preferredLocale}
        </label>
        <select id="p-locale" value={form.locale} onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))} className="field">
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={status === 'saving'} className="btn-primary">
          {status === 'saving' ? dict.account.saving : dict.account.saveProfile}
        </button>
        <p
          aria-live="polite"
          className={clsx('text-small', status === 'saved' ? 'text-success' : status === 'error' ? 'text-danger' : 'text-transparent')}
        >
          {status === 'saved' ? dict.account.saved : status === 'error' ? dict.errors.generic : '·'}
        </p>
      </div>
    </form>
  );
}
