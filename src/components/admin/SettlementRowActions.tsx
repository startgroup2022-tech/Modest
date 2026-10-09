'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Admin-side controls for a settlement's payout chain. The transfer step will
 * not submit without a proof (file URL or reference), and the API refuses a
 * payout that has not been transferred — the button set mirrors that chain.
 */
export function SettlementRowActions({
  settlementId,
  status,
  canManage,
  locale,
}: {
  settlementId: string;
  status: string;
  canManage: boolean;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const ar = locale === 'ar';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [reference, setReference] = useState('');

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/settlements/${settlementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (ar ? 'فشل الإجراء' : 'Action failed'));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(ar ? 'خطأ في الشبكة' : 'Network error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return <span className="text-caption text-ink-faint">—</span>;

  const buttons: { action: string; label: string; tone?: string }[] = [];
  if (status === 'PENDING') buttons.push({ action: 'approve', label: ar ? 'اعتماد' : 'Approve' });
  if (status === 'APPROVED') buttons.push({ action: 'transfer', label: ar ? 'تحويل' : 'Transfer' });
  if (status === 'TRANSFERRED') buttons.push({ action: 'pay', label: ar ? 'دفع' : 'Pay' });
  if (['PENDING', 'APPROVED', 'TRANSFERRED'].includes(status)) buttons.push({ action: 'cancel', label: ar ? 'إلغاء' : 'Cancel', tone: 'danger' });

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-1">
        {buttons.map((b) => (
          <button
            key={b.action}
            type="button"
            disabled={busy}
            className={b.tone === 'danger' ? 'adm-btn-danger adm-btn-sm' : 'adm-btn-outline adm-btn-sm'}
            onClick={() => {
              if (b.action === 'transfer') {
                setTransferOpen((v) => !v);
                return;
              }
              if (b.action === 'cancel' && !window.confirm(ar ? 'إلغاء هذه التسوية؟' : 'Cancel this settlement?')) return;
              if (b.action === 'pay' && !window.confirm(ar ? 'تأكيد دفع هذه التسوية؟' : 'Confirm this payout?')) return;
              void send({ action: b.action });
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {transferOpen ? (
        <div className="grid gap-2">
          <input
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder={ar ? 'رابط إثبات التحويل' : 'Transfer proof URL'}
            className="adm-input"
          />
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={ar ? 'مرجع التحويل' : 'Transfer reference'}
            className="adm-input"
          />
          <button
            type="button"
            disabled={busy || (!proofUrl.trim() && !reference.trim())}
            className="adm-btn-primary adm-btn-sm"
            onClick={async () => {
              const ok = await send({ action: 'transfer', transferProofUrl: proofUrl.trim(), transferReference: reference.trim() });
              if (ok) {
                setTransferOpen(false);
                setProofUrl('');
                setReference('');
              }
            }}
          >
            {ar ? 'تأكيد التحويل' : 'Confirm transfer'}
          </button>
          <p className="text-caption text-ink-faint">
            {ar ? 'إثبات التحويل مطلوب قبل الدفع.' : 'A transfer proof is required before payout.'}
          </p>
        </div>
      ) : null}

      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </div>
  );
}
