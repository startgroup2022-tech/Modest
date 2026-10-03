'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { OrderStatus } from '@prisma/client';

const FRIENDLY: Record<string, { en: string; ar: string }> = {
  PENDING: { en: 'Pending', ar: 'قيد الانتظار' },
  CONFIRMED: { en: 'Confirm order', ar: 'تأكيد الطلب' },
  PREPARING: { en: 'Start preparing', ar: 'بدء التحضير' },
  IN_PRODUCTION: { en: 'Send to production', ar: 'إرسال للإنتاج' },
  QUALITY_CHECK: { en: 'Send to quality check', ar: 'إرسال لفحص الجودة' },
  READY: { en: 'Mark ready', ar: 'تحديد كجاهز' },
  SHIPPED: { en: 'Mark shipped', ar: 'تحديد كمشحون' },
  DELIVERED: { en: 'Mark delivered', ar: 'تحديد كموصّل' },
  CANCELLED: { en: 'Cancel order', ar: 'إلغاء الطلب' },
  REFUND_REQUESTED: { en: 'Request refund', ar: 'طلب استرداد' },
  REFUNDED: { en: 'Mark refunded', ar: 'تحديد كمسترد' },
};

export function OrderStatusActions({
  orderId,
  current,
  transitions,
  locale,
  labels,
}: {
  orderId: string;
  current: OrderStatus;
  transitions: OrderStatus[];
  locale: 'en' | 'ar';
  labels: {
    update: string;
    advance: string;
    cancel: string;
    cancelReason: string;
    markShipped: string;
    markDelivered: string;
    trackingNumber: string;
    carrier: string;
    blocked: string;
    confirmCancel: string;
    note: string;
    apply: string;
    canUpdate: boolean;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [reason, setReason] = useState('');

  if (!labels.canUpdate) {
    return <p className="text-small text-ink-muted">{labels.blocked}</p>;
  }
  if (transitions.length === 0) {
    return <p className="text-small text-ink-muted">{labels.blocked}</p>;
  }

  async function apply(to: OrderStatus) {
    if (to === 'CANCELLED' && !window.confirm(labels.confirmCancel)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          note: note || undefined,
          trackingNumber: to === 'SHIPPED' ? tracking || undefined : undefined,
          carrier: to === 'SHIPPED' ? carrier || undefined : undefined,
          cancelReason: to === 'CANCELLED' ? reason || undefined : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? labels.blocked);
        setBusy(false);
        return;
      }
      setNote('');
      setTracking('');
      setCarrier('');
      setReason('');
      router.refresh();
    } catch {
      setError(labels.blocked);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {transitions.map((to) => {
          const isCancel = to === 'CANCELLED';
          const isPrimary = to === 'CONFIRMED' || to === 'SHIPPED' || to === 'DELIVERED' || to === 'READY';
          return (
            <button
              key={to}
              type="button"
              disabled={busy}
              onClick={() => apply(to)}
              className={
                isCancel
                  ? 'adm-btn-danger adm-btn-sm'
                  : isPrimary
                    ? 'adm-btn-primary adm-btn-sm'
                    : 'adm-btn-outline adm-btn-sm'
              }
            >
              {FRIENDLY[to]?.[locale] ?? to}
            </button>
          );
        })}
      </div>

      {transitions.includes('SHIPPED') && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={labels.carrier} className="adm-input" />
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder={labels.trackingNumber} className="adm-input" />
        </div>
      )}
      {transitions.includes('CANCELLED') && (
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={labels.cancelReason} className="adm-input" />
      )}

      <label className="block">
        <span className="sr-only">{labels.note}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={labels.note} className="adm-input" />
      </label>

      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
