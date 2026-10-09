'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Signs a tailor out by clearing the tailor session cookie server-side. */
export function TailorSignOutButton({ locale, label }: { locale: 'en' | 'ar'; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/tailor/auth/signout', { method: 'POST' });
    } catch {
      // Fall through: the redirect below still clears the client view.
    } finally {
      router.push(`/${locale}/tailor/sign-in`);
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className="link-underline text-small text-ink-muted">
      {label}
    </button>
  );
}
