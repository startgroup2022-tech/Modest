'use client';

import { useStore } from '@/components/providers/StoreProvider';
import { formatMoney } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

/**
 * Renders a BHD accounting amount in the visitor's selected currency.
 * Conversion happens client-side from the rate captured at page load so the
 * displayed price always matches the order's presentment currency.
 */
export function Price({
  amountBhd,
  locale,
  className,
  compareAtBhd,
}: {
  amountBhd: number;
  locale: Locale;
  className?: string;
  compareAtBhd?: number | null;
}) {
  const { currencyMeta } = useStore();
  const display = Math.round(amountBhd * currencyMeta.rateToBhd * 10 ** currencyMeta.decimals) / 10 ** currencyMeta.decimals;

  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="tabular-nums">
        {formatMoney(display, {
          code: currencyMeta.code,
          symbol: currencyMeta.symbol,
          decimals: currencyMeta.decimals,
          symbolPosition: currencyMeta.symbolPosition,
          locale,
        })}
      </span>
      {compareAtBhd && compareAtBhd > amountBhd ? (
        <span className="text-caption text-ink-faint line-through">
          {formatMoney(compareAtBhd * currencyMeta.rateToBhd, {
            code: currencyMeta.code,
            symbol: currencyMeta.symbol,
            decimals: currencyMeta.decimals,
            symbolPosition: currencyMeta.symbolPosition,
            locale,
          })}
        </span>
      ) : null}
    </span>
  );
}
