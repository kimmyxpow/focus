import { cn } from '@/client/lib/utils';
import { useWebSocketStatus, type ConnectionStatus } from '@/client/hooks/useWebSocketStatus';
import Tooltip from '@/client/components/ui/Tooltip';

interface ConnectionStatusIndicatorProps {
  sessionId?: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; className: string; dotClass: string }> = {
  connecting: {
    label: 'Connecting...',
    className: 'text-amber-400/70',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  connected: {
    label: 'Real-time',
    className: 'text-emerald-400/70',
    dotClass: 'bg-emerald-400',
  },
  disconnected: {
    label: 'Reconnecting...',
    className: 'text-white/40',
    dotClass: 'bg-white/40 animate-pulse',
  },
};

export default function ConnectionStatusIndicator({
  sessionId,
  className,
  showLabel = false,
  size = 'sm',
}: ConnectionStatusIndicatorProps) {
  const { status } = useWebSocketStatus(sessionId);
  const config = STATUS_CONFIG[status];

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  const indicator = (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('rounded-full', dotSize, config.dotClass)} />
      {showLabel && (
        <span className={cn('font-medium', textSize, config.className)}>
          {config.label}
        </span>
      )}
    </div>
  );

  if (showLabel) {
    return indicator;
  }

  return (
    <Tooltip label={config.label}>
      {indicator}
    </Tooltip>
  );
}
