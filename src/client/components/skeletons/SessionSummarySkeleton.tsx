import { cn } from '@/client/lib/utils';

interface SessionSummarySkeletonProps {
  className?: string;
}

export default function SessionSummarySkeleton({ className }: SessionSummarySkeletonProps) {
  return (
    <div className={cn("container-sm space-y-6", className)}>
      <div className="text-center space-y-3">
        <div className="h-10 w-40 bg-white/10 rounded-lg mx-auto animate-pulse" />
        <div className="h-4 w-64 bg-white/5 rounded mx-auto animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
        <div className="p-6 text-center bg-white/5 rounded-xl">
          <div className="h-12 w-12 bg-white/10 rounded-full mx-auto mb-3 animate-pulse" />
          <div className="h-8 w-20 bg-white/5 rounded mx-auto mb-2 animate-pulse" />
          <div className="h-3 w-16 bg-white/5 rounded mx-auto animate-pulse" />
        </div>
        <div className="p-6 text-center bg-white/5 rounded-xl">
          <div className="h-12 w-12 bg-white/10 rounded-full mx-auto mb-3 animate-pulse" />
          <div className="h-8 w-20 bg-white/5 rounded mx-auto mb-2 animate-pulse" />
          <div className="h-3 w-16 bg-white/5 rounded mx-auto animate-pulse" />
        </div>
      </div>

      <div className="py-6 border-t border-white/10 space-y-4">
        <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-white/5 rounded animate-pulse" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-white/5 rounded animate-pulse" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-2/3" />
        </div>
      </div>

      <div className="py-6 border-t border-white/10 space-y-3">
        <div className="h-5 w-28 bg-white/10 rounded animate-pulse" />
        <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
      </div>

      <div className="flex justify-center">
        <div className="h-11 w-40 bg-white/10 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
