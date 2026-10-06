'use client';

import { useState } from 'react';
import type { Dict } from '@/i18n/dictionaries';

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function PasswordForm({ dict }: { dict: Dict }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/account?kind=password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('saved');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string; field?: string } | null;
        setError(data?.error ?? dict.account.invalidCredentials);
        setStatus('error');
      }
    } catch {
      setStatus('error');
      setError(null);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5" noValidate>
      <div>
        <label htmlFor="pw-current" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
          {dict.account.currentPassword}
        </label>
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={set('currentPassword')}
          className="field"
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pw-new" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.account.newPassword}
          </label>
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.newPassword}
            onChange={set('newPassword')}
            className="field"
            required
          />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.account.confirmPassword}
          </label>
          <input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            className="field"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={status === 'saving'} className="btn-primary">
          {status === 'saving' ? dict.account.saving : dict.account.updatePassword}
        </button>
        <p aria-live="polite" className="text-small">
          {status === 'saved' && <span className="text-ink-muted">{dict.account.passwordChanged}</span>}
          {status === 'error' && <span className="text-danger">{error ?? dict.account.invalidCredentials}</span>}
        </p>
      </div>
    </form>
  );
}
