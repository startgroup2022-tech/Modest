import type { CartPiece } from '@/components/providers/StoreProvider';
import type { Locale } from '@/i18n/config';

/**
 * Renders the frozen per-piece measurement configuration under a cart line.
 * The values are the snapshots written server-side at add-to-cart, so what the
 * buyer reviews here is exactly what is ordered.
 */
export function LineMeasurements({
  pieces,
  needsMeasurements,
  locale,
  labels,
}: {
  pieces: CartPiece[];
  needsMeasurements: boolean;
  locale: Locale;
  labels: { measurements: string; required: string };
}) {
  const ar = locale === 'ar';
  if (!pieces.length && !needsMeasurements) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {needsMeasurements ? (
        <p className="text-caption text-danger">{labels.required}</p>
      ) : null}
      {pieces.map((piece) => (
        <div key={piece.id} className="text-caption text-ink-muted">
          <span className="uppercase tracking-[0.1em]">
            {labels.measurements} {piece.pieceIndex + 1}
          </span>
          {piece.kind === 'READY' && piece.sizeCode ? <span> · {piece.sizeCode}</span> : null}
          {piece.measurements.length ? (
            <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {piece.measurements.map((m) => (
                <li key={m.key} className="tabular-nums">
                  {ar ? m.labelAr : m.labelEn}: {m.value} {m.unit}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
