import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/client/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import Tooltip from '@/client/components/ui/Tooltip';

type FloatingSessionWidgetProps = {
  className?: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string; bgClass: string }> = {
  waiting: { label: 'Waiting', className: 'text-white/70', bgClass: 'bg-white/5' },
  warmup: { label: 'Starting', className: 'text-emerald-300/80', bgClass: 'bg-emerald-500/10' },
  focusing: { label: 'Focus', className: 'text-emerald-300/80', bgClass: 'bg-emerald-500/20' },
  break: { label: 'Break', className: 'text-amber-300/80', bgClass: 'bg-amber-500/20' },
  cooldown: { label: 'Ending', className: 'text-blue-300/80', bgClass: 'bg-blue-500/20' },
};

export default function FloatingSessionWidget({ className }: FloatingSessionWidgetProps) {
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const { data: activeSession } = useQuery({
    ...modelenceQuery<{
      sessionId: string;
      topic: string;
      status: 'waiting' | 'warmup' | 'focusing' | 'break' | 'cooldown';
      isActiveParticipant: boolean;
      timer?: {
        remainingSeconds: number;
        serverTimestamp: number;
      };
    } | null>('focus.getActiveSession', {}),
    enabled: true,
    refetchInterval: 10000,
    retry: false,
  });

  // Sync timer
  useEffect(() => {
    if (activeSession?.timer && activeSession.status === 'focusing') {
      const networkDelay = Date.now() - activeSession.timer.serverTimestamp;
      const adjustedRemaining = Math.max(0, activeSession.timer.remainingSeconds - Math.floor(networkDelay / 1000));
      setLocalRemaining(adjustedRemaining);
    }
  }, [activeSession?.timer, activeSession?.status]);

  useEffect(() => {
    if (localRemaining === null || localRemaining <= 0 || activeSession?.status !== 'focusing') return;

    const interval = setInterval(() => {
      setLocalRemaining((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localRemaining, activeSession?.status]);

  // Auto-hide when no active session
  useEffect(() => {
    if (!activeSession || !activeSession.isActiveParticipant) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
  }, [activeSession]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (!isVisible || !activeSession || !activeSession.isActiveParticipant) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[activeSession.status] || STATUS_CONFIG.waiting;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "animate-slide-up",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-2xl",
          "bg-stone-900/95 backdrop-blur-md",
          "border border-white/10 shadow-xl",
          "transition-all duration-300",
          "hover:border-white/20 hover:shadow-2xl"
        )}
      >
        {/* Status Badge */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl",
          statusConfig.bgClass
        )}>
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          <span className={cn("text-xs font-semibold", statusConfig.className)}>
            {statusConfig.label}
          </span>
        </div>

        {/* Session Info */}
        <Link
          to={`/focus/${activeSession.sessionId}`}
          className="flex items-center gap-3 min-w-0 flex-1"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate max-w-[200px]">
              {activeSession.topic}
            </p>
            {localRemaining !== null && localRemaining > 0 ? (
              <p className="text-xs text-white/60 font-mono tabular-nums">
                {formatTime(localRemaining)}
              </p>
            ) : (
              <p className="text-xs text-white/40">
                {activeSession.sessionId ? 'In Session' : 'Loading...'}
              </p>
            )}
          </div>
        </Link>

        {/* Dismiss Button */}
        <Tooltip label="Hide widget">
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            aria-label="Hide session widget"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
