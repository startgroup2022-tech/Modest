'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface TailorCredentialSummary {
  hasCredential: boolean;
  username: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  credentialsSentAt: string | null;
  lastPasswordChangeAt: string | null;
  lastLoginAt: string | null;
}

/**
 * Admin control for a tailor's login. Issuing or resetting generates a secure
 * temporary password that is shown exactly once, here, for the administrator to
 * hand over out of band. Only the hash is stored server-side.
 */
export function TailorCredentials({
  tailorId,
  summary,
  locale,
  canManage,
}: {
  tailorId: string;
  summary: TailorCredentialSummary;
  locale: 'en' | 'ar';
  canManage: boolean;
}) {
  const router = useRouter();
  const ar = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ username: string; temporaryPassword: string } | null>(null);

  async function act(action: 'issue' | 'enable' | 'disable') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tailors/${tailorId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        username?: string;
        temporaryPassword?: string;
      };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Action failed');
        return;
      }
      if (action === 'issue' && out.temporaryPassword) {
        setIssued({ username: out.username ?? '', temporaryPassword: out.temporaryPassword });
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <span className="text-caption text-ink-faint">{label}</span>
      <span className="text-small text-ink">{value}</span>
    </div>
  );

  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(ar ? 'ar-BH' : 'en-GB') : '—');

  return (
    <div className="grid gap-4">
      <div>
        {row(ar ? 'اسم المستخدم' : 'Username', summary.username ?? '—')}
        {row(
          ar ? 'حالة الدخول' : 'Login status',
          summary.hasCredential
            ? summary.isActive
              ? ar
                ? 'مفعّل'
                : 'Enabled'
              : ar
                ? 'معطّل'
                : 'Disabled'
            : ar
              ? 'لا توجد بيانات دخول'
              : 'No credentials yet',
        )}
        {row(
          ar ? 'كلمة المرور' : 'Password',
          summary.hasCredential
            ? summary.mustChangePassword
              ? ar
                ? 'مؤقتة — يجب التغيير'
                : 'Temporary — must change'
              : ar
                ? 'تم تعيينها من قبل الخياط'
                : 'Set by tailor'
            : '—',
        )}
        {row(ar ? 'أُرسلت في' : 'Issued at', dt(summary.credentialsSentAt))}
        {row(ar ? 'آخر تغيير لكلمة المرور' : 'Last password change', dt(summary.lastPasswordChangeAt))}
        {row(ar ? 'آخر تسجيل دخول' : 'Last login', dt(summary.lastLoginAt))}
      </div>

      {issued && (
        <div className="border border-success bg-paper p-3">
          <p className="text-caption text-ink-muted">
            {ar
              ? 'انسخ كلمة المرور المؤقتة الآن — لن تُعرض مرة أخرى.'
              : 'Copy the temporary password now — it will not be shown again.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="select-all border border-line bg-paper-warm px-2 py-1 text-small text-ink">
              {issued.username}
            </code>
            <code className="select-all border border-line bg-paper-warm px-2 py-1 text-small text-ink">
              {issued.temporaryPassword}
            </code>
          </div>
        </div>
      )}

      {error && <p className="text-caption text-danger">{error}</p>}

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => act('issue')} disabled={busy} className="adm-btn-primary adm-btn-sm">
            {summary.hasCredential
              ? ar
                ? 'إعادة تعيين كلمة المرور'
                : 'Reset password'
              : ar
                ? 'إنشاء بيانات الدخول'
                : 'Issue credentials'}
          </button>
          {summary.hasCredential && (
            <button
              type="button"
              onClick={() => act(summary.isActive ? 'disable' : 'enable')}
              disabled={busy}
              className="adm-btn-sm border border-line px-3"
            >
              {summary.isActive ? (ar ? 'تعطيل الدخول' : 'Disable login') : ar ? 'تفعيل الدخول' : 'Enable login'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-caption text-ink-faint">
          {ar ? 'لا تملك صلاحية إدارة الخياطين.' : 'You do not have permission to manage tailor credentials.'}
        </p>
      )}
    </div>
  );
}
