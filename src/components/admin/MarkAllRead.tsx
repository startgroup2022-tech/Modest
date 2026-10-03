'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function MarkAllRead({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={run} disabled={busy} className="adm-btn-outline">
      {label}
    </button>
  );
}
