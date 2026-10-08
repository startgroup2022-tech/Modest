'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Tailor Portal sign-in. Tailors never self-register; credentials are issued by staff. */
export function TailorSignInForm({ locale }: { locale: 'en' | 'ar' }) {
  const router = useRouter();
  const ar = locale === 'ar';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/tailor/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; redirect?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? (ar ? 'تعذّر تسجيل الدخول' : 'Sign-in failed'));
        return;
      }
      // Honour the server's destination: a tailor still on a temporary password
      // is sent to the password screen; everyone else lands in the portal.
      const destination = out.redirect === '/tailor' ? '/tailor' : '/tailor/password';
      router.push(`/${locale}${destination}`);
      router.refresh();
    } catch {
      setError(ar ? 'خطأ في الشبكة' : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <header className="mb-8 text-center">
        <h1 className="text-h2">{ar ? 'بوابة الخياطين' : 'Tailor Portal'}</h1>
        <p className="mt-2 text-small text-ink-muted">
          {ar ? 'سجّل الدخول باستخدام بيانات الدخول الممنوحة لك.' : 'Sign in with the credentials issued to you.'}
        </p>
      </header>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="tl-user" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {ar ? 'اسم المستخدم' : 'Username'}
          </label>
          <input
            id="tl-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="field"
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="tl-pass" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
            {ar ? 'كلمة المرور' : 'Password'}
          </label>
          <input
            id="tl-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="field"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-caption text-danger" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary btn-block">
          {busy ? (ar ? 'جارٍ الدخول…' : 'Signing in…') : ar ? 'تسجيل الدخول' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
