'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RefundForm({
  orderId,
  max,
  locale,
  dict,
}: {
  orderId: string;
  max: number;
  locale: 'en' | 'ar';
  dict: { finance: { issueRefund: string; amount: string; method: string; reference: string; reason: string }; common: { save: string } };
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(max > 0 ? max.toFixed(3) : '');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amountBhd: Number(amount),
          method,
          reference: reference || undefined,
          reason: reason || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Refund failed');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="adm-kpi-label">{dict.finance.amount}</span>
        <input
          type="number"
          step="0.001"
          min="0"
          max={max}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="adm-input mt-1"
          required
        />
      </label>
      <label className="block">
        <span className="adm-kpi-label">{dict.finance.method}</span>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="adm-select mt-1">
          <option value="BANK_TRANSFER">{locale === 'ar' ? 'تحويل بنكي' : 'Bank transfer'}</option>
          <option value="BENEFIT">BenefitPay</option>
          <option value="TAPP">TAPP</option>
          <option value="CASH">{locale === 'ar' ? 'نقداً' : 'Cash'}</option>
          <option value="STORE_CREDIT">{locale === 'ar' ? 'رصيد المتجر' : 'Store credit'}</option>
        </select>
      </label>
      <label className="block">
        <span className="adm-kpi-label">{dict.finance.reference}</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className="adm-input mt-1" />
      </label>
      <label className="block">
        <span className="adm-kpi-label">{dict.finance.reason}</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="adm-input mt-1" />
      </label>
      {error && <p className="text-caption text-danger">{error}</p>}
      <button type="submit" disabled={busy || max <= 0} className="adm-btn-danger w-full">
        {busy ? '…' : dict.finance.issueRefund}
      </button>
    </form>
  );
}
