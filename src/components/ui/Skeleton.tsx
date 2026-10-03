import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton', className)} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-product w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LineSkeleton({ className }: SkeletonProps) {
  return <Skeleton className={clsx('h-4 w-full', className)} />;
}

export function OrderRowSkeleton() {
  return (
    <div className="surface space-y-3 p-5">
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function CartLineSkeleton() {
  return (
    <div className="flex gap-4">
      <Skeleton className="h-32 w-24 shrink-0" />
      <div className="flex-1 space-y-3 py-1">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  );
}
