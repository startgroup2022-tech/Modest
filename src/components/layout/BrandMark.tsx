import Link from 'next/link';
import { clsx } from 'clsx';

interface BrandMarkProps {
  className?: string;
}

/**
 * The house wordmark. Rendered as type rather than an image so it stays crisp
 * at any size and remains selectable/crawlable for search.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      className={clsx(
        'font-sans font-semibold uppercase leading-none tracking-[0.3em] text-current',
        className,
      )}
    >
      Attention
    </span>
  );
}

export function Logo({ href, className, logoUrl }: { href: string; className?: string; logoUrl?: string | null }) {
  return (
    <Link href={href} aria-label="Attention — home" className={clsx('inline-flex items-center', className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Attention"
          className="h-7 w-auto max-w-[180px] object-contain sm:h-8"
        />
      ) : (
        <BrandMark className="text-[1.05rem] sm:text-[1.15rem]" />
      )}
    </Link>
  );
}
