'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { safeRedirect as safePath } from '@/lib/redirect-safety';

export function AuthForm({ locale, dict, mode }: { locale: Locale; dict: Dict; mode: 'signin' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptsMarketing: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && form.password !== form.confirmPassword) {
      setError(dict.account.passwordMismatch);
      return;
    }
    if (mode === 'signup' && form.password.length < 8) {
      setError(dict.account.passwordTooShort);
      return;
    }

    setBusy(true);
    try {
      const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'signin' ? { email: form.email, password: form.password, redirect } : form),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; redirect?: string | null };
      if (!res.ok || !data.ok) {
        setError(
          data.error === 'emailTaken'
            ? dict.account.emailTaken
            : data.error === 'invalidCredentials'
              ? dict.account.invalidCredentials
              : data.error && data.error.includes(' ')
                ? data.error
                : dict.errors.generic,
        );
        setBusy(false);
        return;
      }
      const target = safePath(data.redirect) || safePath(redirect) || `/${locale}/account`;
      router.push(target);
      router.refresh();
    } catch {
      setError(dict.errors.network);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <header className="mb-8 text-center">
        <h1 className="text-h2">{mode === 'signin' ? dict.account.signIn : dict.account.signUp}</h1>
        <p className="mt-2 text-small text-ink-muted">
          {mode === 'signin' ? dict.account.signInBody : dict.account.signUpBody}
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5" noValidate>
        {mode === 'signup' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="au-first" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
                {dict.account.firstName}
              </label>
              <input id="au-first" value={form.firstName} onChange={set('firstName')} placeholder={dict.account.firstNamePlaceholder} required className="field" autoComplete="given-name" />
            </div>
            <div>
              <label htmlFor="au-last" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
                {dict.account.lastName}
              </label>
              <input id="au-last" value={form.lastName} onChange={set('lastName')} placeholder={dict.account.lastNamePlaceholder} required className="field" autoComplete="family-name" />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="au-email" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.account.email}
          </label>
          <input id="au-email" type="email" value={form.email} onChange={set('email')} placeholder={dict.account.emailPlaceholder} required className="field" autoComplete="email" />
        </div>

        {mode === 'signup' ? (
          <div>
            <label htmlFor="au-phone" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
              {dict.checkout.phone}
            </label>
            <input id="au-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder={dict.account.phonePlaceholder} className="field" autoComplete="tel" />
          </div>
        ) : null}

        <div>
          <label htmlFor="au-password" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {dict.account.password}
          </label>
          <input
            id="au-password"
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder={dict.account.passwordPlaceholder}
            required
            className="field"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>

        {mode === 'signup' ? (
          <>
            <div>
              <label htmlFor="au-confirm" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
                {dict.account.confirmPassword}
              </label>
              <input id="au-confirm" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required className="field" autoComplete="new-password" />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-small text-ink-muted">
              <input type="checkbox" checked={form.acceptsMarketing} onChange={set('acceptsMarketing')} className="mt-1 h-4 w-4 accent-ink" />
              <span>{locale === 'ar' ? 'أرغب في استلام أخبار المجموعات والعروض.' : 'Send me news about collections and offers.'}</span>
            </label>
          </>
        ) : null}

        {error ? (
          <p role="alert" className={clsx('text-small', 'text-danger')}>
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn-primary btn-block">
          {busy
            ? mode === 'signin'
              ? dict.account.signingIn
              : dict.account.creating
            : mode === 'signin'
              ? dict.account.signIn
              : dict.account.createAccount}
        </button>
      </form>

      <p className="mt-6 text-center text-small text-ink-muted">
        {mode === 'signin' ? dict.account.noAccount : dict.account.haveAccount}{' '}
        <Link href={`/${locale}/account/${mode === 'signin' ? 'sign-up' : 'sign-in'}`} className="link-underline text-ink">
          {mode === 'signin' ? dict.account.createAccount : dict.account.signIn}
        </Link>
      </p>
    </div>
  );
}
