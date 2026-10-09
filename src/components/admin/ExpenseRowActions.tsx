'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Approve / reject / pay transitions for an expense row. Approval is only shown
 * to holders of expenses.approve; the API re-checks it regardless.
 */
export function ExpenseRowActions({
  id,
  status,
  canApprove,
  locale,
  dict,
}: {
  id: string;
  status: string;
  canApprove: boolean;
  locale: 'en' | 'ar';
  dict: { finance: Record<string, string>; common: Record<string, string> };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'submit' | 'approve' | 'reject' | 'pay') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const btn = (label: string, action: 'submit' | 'approve' | 'reject' | 'pay', variant: string) => (
    <button type="button" disabled={busy} onClick={() => act(action)} className={variant}>
      {label}
    </button>
  );

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {status === 'DRAFT' && btn(dict.finance.submit, 'submit', 'adm-btn-outline adm-btn-sm')}
      {status === 'SUBMITTED' && canApprove && (
        <>
          {btn(dict.finance.approve, 'approve', 'adm-btn-primary adm-btn-sm')}
          {btn(dict.finance.reject, 'reject', 'adm-btn-ghost adm-btn-sm')}
        </>
      )}
      {status === 'APPROVED' && btn(dict.finance.markPaid, 'pay', 'adm-btn-outline adm-btn-sm')}
      {error && <span className="text-caption text-danger">{error}</span>}
    </span>
  );
}
