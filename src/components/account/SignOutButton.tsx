'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Dict } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export function SignOutButton({ locale, dict, className }: { locale: Locale; dict: Dict; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      router.push(`/${locale}`);
      router.refresh();
    }
  };

  return (
    <button type="button" onClick={signOut} disabled={busy} className={className ?? 'btn-quiet'}>
      {busy ? dict.common.loading : dict.account.logout}
    </button>
  );
}
