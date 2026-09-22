import { cn } from '../../lib/cn';

export default function Skeleton({ width = '100%', height = 16, className }) {
  return <div className={cn('qz-skeleton', className)} style={{ width, height }} aria-hidden="true" />;
}

export function CardSkeleton() {
  return <CardSkeletonContent />;
}

function CardSkeletonContent() {
  return (
    <div className="qz-card qz-card__body" aria-label="Memuat konten">
      <Skeleton width="42%" height={14} />
      <div style={{ height: 12 }} />
      <Skeleton width="76%" height={20} />
      <div style={{ height: 8 }} />
      <Skeleton width="90%" height={12} />
    </div>
  );
}
