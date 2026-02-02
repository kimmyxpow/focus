import { cn } from '@/client/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  message,
  className,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'spinner-sm',
    md: 'spinner',
    lg: 'spinner-lg',
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-4",
      fullScreen && "min-h-screen bg-[var(--color-ink)]",
      className
    )}>
      <div className={sizeClasses[size]} />
      {message && <p className="text-white/50 text-sm">{message}</p>}
    </div>
  );
}
