'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from '@/components/ui/icons';

export interface AccordionItem {
  title: string;
  body: string;
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const visible = items.filter((i) => i.body.trim().length > 0);
  if (!visible.length) return null;

  return (
    <div className="border-t border-line">
      {visible.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.title} className="border-b border-line">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-start"
              >
                <span className="text-caption uppercase tracking-[0.14em] text-ink">{item.title}</span>
                <ChevronDown
                  className={clsx('h-4 w-4 shrink-0 text-ink-muted transition-transform duration-400', isOpen && 'rotate-180')}
                />
              </button>
            </h3>
            <div
              className={clsx(
                'grid transition-all duration-400 ease-luxe',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="prose-luxe pb-6 text-small text-ink-muted" dangerouslySetInnerHTML={{ __html: item.body }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
