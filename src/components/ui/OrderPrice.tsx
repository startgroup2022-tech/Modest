import 'server-only';
import { formatMoney } from '@/lib/utils';
import { currencyMetaFor } from '@/lib/currency-select';
import type { Locale } from '@/i18n/config';

/**
 * Renders a historical order amount in the currency it was actually placed in.
 *
 * Unlike `Price`, this never consults the live storefront currency: an order's
 * presentment currency and rate are frozen at checkout, so a later change to the
 * exchange rate or the visitor's selected currency must not alter what a past
 * order displays. The captured `rate` (presentment units per BHD) is applied to
 * the accounting amount.
 */
export function OrderPrice({
  amountBhd,
  code,
  rate,
  locale,
  className,
}: {
  amountBhd: number;
  code: string | null | undefined;
  rate: number;
  locale: Locale;
  className?: string;
}) {
  const meta = currencyMetaFor(code);
  const display = Math.round(amountBhd * rate * 10 ** meta.decimals) / 10 ** meta.decimals;
  return (
    <span className={className}>
      {formatMoney(display, {
        code: meta.code,
        symbol: locale === 'ar' ? meta.symbolAr : meta.symbolEn,
        decimals: meta.decimals,
        symbolPosition: meta.symbolPosition,
        locale,
      })}
    </span>
  );
}
