'use client';

import { useStore } from '@/components/providers/StoreProvider';

/**
 * Lightweight confirmation toast. Content is either a dictionary key
 * ("saved"/"removed") or a server-provided message.
 */
export function Toast() {
  const { flash } = useStore();
  if (!flash) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 start-1/2 z-[90] -translate-x-1/2 md:bottom-8 rtl:translate-x-1/2"
    >
      <div className="animate-fade-up border border-ink bg-ink px-6 py-3 text-caption uppercase tracking-[0.14em] text-paper shadow-lg">
        {flash}
      </div>
    </div>
  );
}
