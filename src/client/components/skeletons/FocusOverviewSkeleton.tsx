import { cn } from '@/client/lib/utils';

interface FocusOverviewSkeletonProps {
  className?: string;
}

export default function FocusOverviewSkeleton({ className }: FocusOverviewSkeletonProps) {
  return (
    <div className={cn("container-lg space-y-8", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-11 w-32 bg-white/10 rounded-lg animate-pulse" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl bg-white/5">
            <div className="h-8 w-20 bg-white/10 rounded mx-auto mb-2 animate-pulse" />
            <div className="h-3 w-20 bg-white/5 rounded mx-auto animate-pulse" />
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      <div className="card-dark p-6 space-y-4">
        <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-14 bg-white/5 rounded animate-pulse" />
              <div className="flex-1 h-8 bg-white/5 rounded animate-pulse" />
              <div className="h-8 w-14 bg-white/10 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Session List */}
      <div className="space-y-4">
        <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card-dark p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                <div className="h-5 w-20 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-4 bg-white/5 rounded w-full max-w-xs animate-pulse" />
              <div className="flex items-center gap-3">
                <div className="h-8 w-12 bg-white/5 rounded animate-pulse" />
                <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
                <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
