'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProductDangerZone({
  productId,
  locale,
  dict,
}: {
  productId: string;
  locale: 'en' | 'ar';
  dict: { products: Record<string, string>; common: Record<string, string> };
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`${dict.common.delete}? ${dict.common.irreversible}`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; archived?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setError(out.error ?? 'Failed');
        return;
      }
      router.push(`/${locale}/admin/products`);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-small text-ink-muted">
        {locale === 'ar'
          ? 'المنتجات المرتبطة بطلبات سابقة ستُؤرشف بدلاً من حذفها للحفاظ على السجل المالي.'
          : 'Products referenced by past orders are archived instead of deleted, preserving financial history.'}
      </p>
      {error && <p className="text-caption text-danger">{error}</p>}
      <button type="button" disabled={busy} onClick={remove} className="adm-btn-danger">
        {dict.common.delete}
      </button>
    </div>
  );
}
