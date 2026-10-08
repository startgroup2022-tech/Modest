'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * A single POST action button for the Tailor Portal. Disabled for supervisors
 * (`readOnly`) so a read-only viewer cannot even attempt a write.
 */
export function TailorActionButton({
  endpoint,
  body,
  children,
  variant = 'primary',
  confirm,
  readOnly,
  disabled,
  className,
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'danger';
  confirm?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Action failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  const cls = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    danger: 'btn-outline text-danger',
  }[variant];

  if (readOnly) return null;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={busy || disabled} className={cn(cls, className)}>
        {busy ? '…' : children}
      </button>
      {error && <span className="text-caption text-danger" role="alert">{error}</span>}
    </span>
  );
}
