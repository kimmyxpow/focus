import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/client/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { motion, AnimatePresence } from 'motion/react';

type FloatingSessionWidgetProps = {
  className?: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string; bgClass: string; dotColor: string }> = {
  waiting: { label: 'Waiting', className: 'text-white/70', bgClass: 'bg-white/5', dotColor: 'bg-white/50' },
  warmup: { label: 'Starting', className: 'text-emerald-300/80', bgClass: 'bg-emerald-500/10', dotColor: 'bg-emerald-400' },
  focusing: { label: 'Focus', className: 'text-emerald-300/80', bgClass: 'bg-emerald-500/20', dotColor: 'bg-emerald-400' },
  break: { label: 'Break', className: 'text-amber-300/80', bgClass: 'bg-amber-500/20', dotColor: 'bg-amber-400' },
  cooldown: { label: 'Ending', className: 'text-blue-300/80', bgClass: 'bg-blue-500/20', dotColor: 'bg-blue-400' },
};

export default function FloatingSessionWidget({ className }: FloatingSessionWidgetProps) {
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

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
      participants?: number;
      startedAt?: string;
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
    <AnimatePresence>
      <motion.div
        className={cn(
          "fixed bottom-6 left-1/2 z-50",
          className
        )}
        style={{ x: '-50%' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <Link to={`/focus/${activeSession.sessionId}`}>
          <motion.div
            className={cn(
              "relative overflow-hidden cursor-pointer",
              "bg-stone-900/95 backdrop-blur-md",
              "border border-white/10 shadow-xl",
              "rounded-2xl"
            )}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            animate={{
              borderColor: isHovered ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            }}
            transition={{ duration: 0.2 }}
            layout
          >
            {/* Glow effect on hover */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{
                boxShadow: isHovered 
                  ? '0 0 40px rgba(52, 211, 153, 0.15), 0 20px 40px rgba(0, 0, 0, 0.3)' 
                  : '0 10px 30px rgba(0, 0, 0, 0.2)',
              }}
              transition={{ duration: 0.3 }}
              style={{ borderRadius: 'inherit' }}
            />

            <motion.div
              className="relative flex items-center"
              animate={{
                padding: isHovered ? '16px 20px' : '12px 16px',
                gap: isHovered ? '16px' : '12px',
              }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Status Indicator Dot with pulse animation */}
              <motion.div
                className={cn(
                  "flex-shrink-0 rounded-full",
                  statusConfig.dotColor
                )}
                animate={{
                  width: isHovered ? 10 : 8,
                  height: isHovered ? 10 : 8,
                }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className={cn("w-full h-full rounded-full", statusConfig.dotColor)}
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.5, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>

              {/* Timer - Always visible */}
              <motion.div 
                className="flex flex-col items-start"
                layout
              >
                <motion.p 
                  className="font-mono tabular-nums font-bold text-white"
                  animate={{
                    fontSize: isHovered ? '24px' : '16px',
                  }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  {localRemaining !== null && localRemaining > 0 
                    ? formatTime(localRemaining) 
                    : '--:--'}
                </motion.p>
                
                {/* Status label - only visible on hover */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.span
                      className={cn("text-xs font-medium", statusConfig.className)}
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {statusConfig.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Expanded Content - Session Details */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    className="flex flex-col gap-1 border-l border-white/10 pl-4"
                    initial={{ opacity: 0, width: 0, paddingLeft: 0 }}
                    animate={{ opacity: 1, width: 'auto', paddingLeft: 16 }}
                    exit={{ opacity: 0, width: 0, paddingLeft: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {/* Topic */}
                    <motion.p
                      className="text-sm font-medium text-white truncate max-w-[180px]"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2, delay: 0.05 }}
                    >
                      {activeSession.topic}
                    </motion.p>
                    
                    {/* Session Info Row */}
                    <motion.div
                      className="flex items-center gap-3 text-xs text-white/50"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                    >
                      {activeSession.participants && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <title>Participants</title>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                          {activeSession.participants}
                        </span>
                      )}
                      <span className="text-white/30">|</span>
                      <span>Click to open</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dismiss Button - Only on hover */}
              <AnimatePresence>
                {isHovered && (
                  <motion.button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsVisible(false);
                    }}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors ml-2"
                    aria-label="Hide session widget"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <title>Close</title>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
