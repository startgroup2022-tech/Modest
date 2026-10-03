import { ProductGridSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="shell py-12">
      <div className="mb-10 h-10 w-64 skeleton" />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
