import { cn } from '@/client/lib/utils';

interface ProfileSkeletonProps {
  className?: string;
}

export default function ProfileSkeleton({ className }: ProfileSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-white/10 rounded-lg animate-pulse" />
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
          <div className="h-11 bg-white/10 rounded-lg animate-pulse" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
          <div className="h-11 bg-white/10 rounded-lg animate-pulse" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl bg-white/5">
            <div className="h-8 w-16 bg-white/10 rounded mx-auto mb-2 animate-pulse" />
            <div className="h-3 w-16 bg-white/5 rounded mx-auto animate-pulse" />
          </div>
        ))}
      </div>

      <div className="h-11 w-32 bg-white/10 rounded-lg animate-pulse" />
    </div>
  );
}
