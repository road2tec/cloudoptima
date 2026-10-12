import clsx from 'clsx';

export default function Skeleton({ className }) {
  return (
    <div className={clsx('relative overflow-hidden rounded-lg', className)} style={{ background: 'var(--skeleton)' }}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-fg/[0.06] to-transparent" />
    </div>
  );
}

export function SkeletonCard({ className, lines = 3, chart = false }) {
  return (
    <div className={clsx('card space-y-3 p-5', className)}>
      <Skeleton className="h-3.5 w-1/3" />
      {chart ? <Skeleton className="h-56 w-full" /> : Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={clsx('h-3', i % 2 ? 'w-2/3' : 'w-full')} />)}
    </div>
  );
}

export function SkeletonRows({ rows = 8, cols = 6 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="border-t border-line">
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className="px-4 py-3.5">
          <Skeleton className={clsx('h-3', c === 0 ? 'w-40' : 'w-16')} />
        </td>
      ))}
    </tr>
  ));
}
