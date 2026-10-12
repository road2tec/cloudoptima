import Skeleton, { SkeletonCard } from '../ui/Skeleton';

// Shown while a lazily-loaded page chunk downloads.
export default function PageFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      <SkeletonCard chart />
    </div>
  );
}
