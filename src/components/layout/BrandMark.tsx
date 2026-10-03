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

export function Logo({ href, className }: { href: string; className?: string }) {
  return (
    <Link href={href} aria-label="Attention — home" className={clsx('inline-flex items-center', className)}>
      <BrandMark className="text-[1.05rem] sm:text-[1.15rem]" />
    </Link>
  );
}
