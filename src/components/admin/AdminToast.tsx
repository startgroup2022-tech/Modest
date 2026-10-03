'use client';

import { useEffect, useState } from 'react';

/**
 * Self-contained toast for the admin surface. Listens for `att:toast` custom
 * events dispatched by ActionButton and other client actions.
 */
export function AdminToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    function onToast(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      setMessage(detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 3200);
    }
    window.addEventListener('att:toast', onToast as EventListener);
    return () => {
      window.removeEventListener('att:toast', onToast as EventListener);
      window.clearTimeout(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 start-1/2 z-[210] -translate-x-1/2 rtl:translate-x-1/2"
    >
      <div className="animate-fade-up border border-ink bg-ink px-6 py-3 text-caption uppercase tracking-[0.14em] text-paper shadow-lg">
        {message}
      </div>
    </div>
  );
}
