import { cn } from '@/client/lib/utils';

interface JoinSessionSkeletonProps {
  className?: string;
}

export default function JoinSessionSkeleton({ className }: JoinSessionSkeletonProps) {
  return (
    <div className={cn("container-sm", className)}>
      <div className="py-12 space-y-6 fade-in">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 bg-white/5 rounded-full animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <div className="h-8 w-40 bg-white/10 rounded-lg mx-auto animate-pulse" />
          <div className="h-4 w-64 bg-white/5 rounded mx-auto animate-pulse" />
        </div>

        <div className="space-y-3">
          <div className="h-5 w-24 bg-white/5 rounded animate-pulse" />
          <div className="h-6 w-full bg-white/5 rounded animate-pulse" />
          <div className="h-5 w-32 bg-white/5 rounded animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 w-20 bg-white/10 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>

        <div className="h-11 w-full bg-white/10 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
