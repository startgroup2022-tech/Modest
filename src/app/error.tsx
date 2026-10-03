'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Never surface the raw error to the visitor; log for operators only.
    console.error('[app-error]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow mb-4">500</p>
      <h1 className="text-h1">Something went wrong</h1>
      <p className="mt-4 max-w-md text-body text-ink-muted">
        We hit an unexpected problem while loading this page. Please try again — if it keeps happening, contact us.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/en" className="btn-outline">
          Go home
        </Link>
      </div>
    </div>
  );
}
