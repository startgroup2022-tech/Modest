'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export function ContactForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locale }),
      });
      setStatus(res.ok ? 'success' : 'error');
      if (res.ok) setForm({ name: '', email: '', phone: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="c-name" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.contact.name}
        </label>
        <input id="c-name" value={form.name} onChange={set('name')} required className="field" autoComplete="name" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-email" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.contact.email}
          </label>
          <input id="c-email" type="email" value={form.email} onChange={set('email')} required className="field" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="c-phone" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.contact.phone}
          </label>
          <input id="c-phone" type="tel" value={form.phone} onChange={set('phone')} className="field" autoComplete="tel" />
        </div>
      </div>
      <div>
        <label htmlFor="c-message" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.contact.message}
        </label>
        <textarea id="c-message" value={form.message} onChange={set('message')} required rows={6} className="field resize-none" />
      </div>

      <button type="submit" disabled={status === 'sending'} className="btn-primary">
        {status === 'sending' ? dict.contact.sending : dict.contact.send}
      </button>

      <p
        aria-live="polite"
        className={clsx('text-small', status === 'success' ? 'text-success' : status === 'error' ? 'text-danger' : 'text-transparent')}
      >
        {status === 'success' ? dict.contact.success : status === 'error' ? dict.contact.error : '·'}
      </p>
    </form>
  );
}
