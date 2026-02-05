import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/client/lib/utils';

type ActiveSessionIndicatorProps = {
  sessionId: string;
  topic: string;
  status: 'waiting' | 'focusing' | 'break' | 'cooldown';
  remainingSeconds?: number;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'bg-white/10 text-white/70' },
  focusing: { label: 'Focus', className: 'bg-emerald-500/20 text-emerald-300' },
  break: { label: 'Break', className: 'bg-amber-500/20 text-amber-300' },
  cooldown: { label: 'Ending', className: 'bg-blue-500/20 text-blue-300' },
};

export default function ActiveSessionIndicator({
  sessionId,
  topic,
  status,
  remainingSeconds,
}: ActiveSessionIndicatorProps) {
  const [localRemaining, setLocalRemaining] = useState(remainingSeconds ?? null);

  useEffect(() => {
    setLocalRemaining(remainingSeconds ?? null);
  }, [remainingSeconds]);

  useEffect(() => {
    if (localRemaining === null || localRemaining <= 0 || status !== 'focusing') return;

    const interval = setInterval(() => {
      setLocalRemaining((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localRemaining, status]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.waiting;

  return (
    <Link
      to={`/focus/${sessionId}`}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
    >
      <div className="flex flex-col items-start min-w-0">
        <span className="text-xs font-medium text-white/90 truncate max-w-[120px] sm:max-w-[150px]">
          {topic}
        </span>
        <div className="flex items-center gap-1.5">
          {localRemaining !== null && localRemaining > 0 ? (
            <span className="text-xs text-white/60 font-mono">
              {formatTime(localRemaining)}
            </span>
          ) : (
            <span className="text-xs text-white/60">
              {statusConfig.label}
            </span>
          )}
        </div>
      </div>
      <span className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
        statusConfig.className
      )}>
        {statusConfig.label}
      </span>
    </Link>
  );
}
