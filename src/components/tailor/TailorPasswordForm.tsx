'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Tailor password form. On first login the tailor is blocked from the portal
 * until they replace the temporary password. Policy: 8+ characters, at least
 * one number, different from the temporary password, confirmation matches.
 */
export function TailorPasswordForm({
  locale,
  name,
  mustChange,
}: {
  locale: 'en' | 'ar';
  name: string;
  mustChange: boolean;
}) {
  const router = useRouter();
  const ar = locale === 'ar';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (newPassword.length < 8) return ar ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters';
    if (!/\d/.test(newPassword)) return ar ? 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل' : 'Password must contain at least one number';
    if (newPassword === currentPassword) return ar ? 'اختر كلمة مرور مختلفة عن المؤقتة' : 'Choose a password different from the temporary one';
    if (newPassword !== confirmPassword) return ar ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match';
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const local = validate();
    if (local) {
      setError(local);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/tailor/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? (ar ? 'تعذّر تغيير كلمة المرور' : 'Could not change password'));
        return;
      }
      setDone(true);
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
        <h1 className="text-h2">{ar ? 'تغيير كلمة المرور' : 'Change your password'}</h1>
        <p className="mt-2 text-small text-ink-muted">
          {mustChange
            ? ar
              ? `مرحبًا ${name}. يجب عليك تعيين كلمة مرور جديدة قبل المتابعة.`
              : `Welcome ${name}. You must set a new password before continuing.`
            : ar
              ? `مرحبًا ${name}. يمكنك تعيين كلمة مرور جديدة.`
              : `Welcome ${name}. You can set a new password.`}
        </p>
      </header>

      {done ? (
        <p className="border border-success bg-paper p-4 text-small text-ink">
          {ar ? 'تم تحديث كلمة المرور بنجاح.' : 'Your password has been updated.'}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="tl-cur" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
              {ar ? 'كلمة المرور الحالية' : 'Current password'}
            </label>
            <input
              id="tl-cur"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="field"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="tl-new" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
              {ar ? 'كلمة المرور الجديدة' : 'New password'}
            </label>
            <input
              id="tl-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="field"
              autoComplete="new-password"
            />
            <p className="mt-1 text-caption text-ink-faint">
              {ar ? '٨ أحرف على الأقل، وتحتوي على رقم.' : 'At least 8 characters, including a number.'}
            </p>
          </div>
          <div>
            <label htmlFor="tl-conf" className="mb-2 block text-caption uppercase tracking-[0.12em] text-ink-muted">
              {ar ? 'تأكيد كلمة المرور' : 'Confirm password'}
            </label>
            <input
              id="tl-conf"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="field"
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-caption text-danger" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary btn-block">
            {busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'حفظ كلمة المرور' : 'Save password'}
          </button>
        </form>
      )}
    </div>
  );
}
