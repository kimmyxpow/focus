import { useCallback, useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/client/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { modelenceQuery } from "@modelence/react-query";
import { motion, AnimatePresence } from "motion/react";

type FloatingSessionWidgetProps = {
  className?: string;
};

type SessionStatus = "waiting" | "focusing" | "break" | "cooldown";

type StatusConfig = {
  label: string;
  dotColor: string;
  bgColor: string;
};

const STATUS_CONFIG: Record<SessionStatus, StatusConfig> = {
  waiting: { label: "Ready to start", dotColor: "bg-amber-400", bgColor: "bg-amber-500/10" },
  focusing: {
    label: "Focusing",
    dotColor: "bg-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  break: {
    label: "On break",
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-500/10",
  },
  cooldown: {
    label: "Wrapping up",
    dotColor: "bg-blue-400",
    bgColor: "bg-blue-500/10",
  },
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

export default function FloatingSessionWidget({
  className,
}: FloatingSessionWidgetProps) {
  const location = useLocation();
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const { data: activeSession, isLoading, error } = useQuery({
    ...modelenceQuery<{
      sessionId: string;
      topic: string;
      status: SessionStatus;
      isActiveParticipant: boolean;
      isCreator?: boolean;
      intent?: string;
      timer?: {
        remainingSeconds: number;
        serverTimestamp: number;
      };
      participants?: number;
    } | null>("focus.getActiveSession", {}),
    enabled: true,
    refetchInterval: 5000,
    staleTime: 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });


  useEffect(() => {
    if (activeSession?.timer && activeSession.status === "focusing") {
      const networkDelay = Date.now() - activeSession.timer.serverTimestamp;
      const adjustedRemaining = Math.max(
        0,
        activeSession.timer.remainingSeconds - Math.floor(networkDelay / 1000)
      );
      setLocalRemaining(adjustedRemaining);
    } else {
      setLocalRemaining(null);
    }
  }, [activeSession?.timer, activeSession?.status]);

  useEffect(() => {
    if (
      localRemaining === null ||
      localRemaining <= 0 ||
      activeSession?.status !== "focusing"
    )
      return;

    const interval = setInterval(() => {
      setLocalRemaining((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localRemaining, activeSession?.status]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const shouldShow = useMemo(() => {
    if (!activeSession) {
      return false;
    }
    if (!activeSession.isActiveParticipant) {
      return false;
    }

    const isViewingSameSession =
      location.pathname === `/focus/${activeSession.sessionId}`;
    if (isViewingSameSession) {
      return false;
    }

    return true;
  }, [activeSession, location.pathname]);

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow]);

  const statusConfig = useMemo(
    () =>
      STATUS_CONFIG[activeSession?.status || "waiting"] ||
      STATUS_CONFIG.waiting,
    [activeSession?.status]
  );

  const hasTimer = useMemo(
    () =>
      activeSession?.status === "focusing" &&
      localRemaining !== null &&
      localRemaining > 0,
    [activeSession?.status, localRemaining]
  );

  const timerDisplay = useMemo(
    () =>
      hasTimer && localRemaining !== null ? formatTime(localRemaining) : null,
    [hasTimer, localRemaining, formatTime]
  );

  const isWaiting = activeSession?.status === "waiting";
  const isCreator = activeSession?.isCreator ?? false;

  if (!isVisible || !activeSession) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="floating-widget"
        className={cn("fixed bottom-6 left-1/2 z-50", className)}
        style={{
          x: "-50%",
          willChange: "transform, opacity",
        }}
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: "tween", duration: 0.5, ease: EASE_OUT_EXPO }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <Link to={`/focus/${activeSession.sessionId}`} className="block">
          <motion.div
            className={cn(
              "relative overflow-hidden",
              "bg-stone-900/95 backdrop-blur-md",
              "border border-white/10",
              "rounded-2xl",
              "shadow-lg shadow-black/20"
            )}
            style={{ willChange: "transform, width" }}
            animate={{ width: isHovered ? 280 : isWaiting ? 180 : 140 }}
            whileTap={{ scale: 0.98 }}
            transition={{
              width: { type: "tween", duration: 0.35, ease: EASE_OUT_EXPO },
              scale: { type: "tween", duration: 0.2, ease: EASE_OUT_QUART },
            }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(52, 211, 153, 0.12) 0%, transparent 70%)",
              }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{
                type: "tween",
                duration: 0.3,
                ease: EASE_OUT_QUART,
              }}
            />

            <motion.div
              className="absolute inset-0 pointer-events-none rounded-2xl border border-emerald-500/30"
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{
                type: "tween",
                duration: 0.3,
                ease: EASE_OUT_QUART,
              }}
            />

            <div className="relative px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      statusConfig.dotColor
                    )}
                  />
                  <motion.div
                    className={cn(
                      "absolute inset-0 rounded-full",
                      statusConfig.dotColor
                    )}
                    animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                </div>

                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {timerDisplay ? (
                    <span className="font-mono tabular-nums font-semibold text-white text-lg">
                      {timerDisplay}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-white/80 truncate">
                      {isWaiting && isCreator
                        ? "Click to Start"
                        : statusConfig.label}
                    </span>
                  )}
                </div>

                {/* Arrow indicator */}
                <motion.div
                  className="flex-shrink-0"
                  animate={{ x: isHovered ? 3 : 0 }}
                  transition={{
                    type: "tween",
                    duration: 0.2,
                    ease: EASE_OUT_QUART,
                  }}
                >
                  <svg
                    className="w-4 h-4 text-white/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </motion.div>
              </div>
            </div>

            <motion.div
              className="overflow-hidden"
              initial={false}
              animate={{
                height: isHovered ? (isWaiting && isCreator ? 160 : 110) : 0,
                opacity: isHovered ? 1 : 0,
              }}
              transition={{
                height: {
                  type: "tween",
                  duration: 0.35,
                  ease: EASE_OUT_EXPO,
                },
                opacity: {
                  type: "tween",
                  duration: 0.25,
                  ease: EASE_OUT_QUART,
                  delay: isHovered ? 0.1 : 0,
                },
              }}
            >
              <div className="px-4 pb-3 pt-2 space-y-3 border-t border-white/5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                    Session
                  </p>
                  <p className="text-sm text-white/90 font-medium leading-snug">
                    {activeSession.topic}
                  </p>
                </div>

                {activeSession.intent && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                      Your intent
                    </p>
                    <p className="text-sm text-white/70 leading-snug line-clamp-2">
                      {activeSession.intent}
                    </p>
                  </div>
                )}

                {isWaiting && isCreator && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <svg
                      className="w-4 h-4 text-amber-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-xs text-amber-300 leading-tight">
                      Ready? Start your focus session
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      statusConfig.bgColor,
                      "text-white/80"
                    )}
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        statusConfig.dotColor
                      )}
                    />
                    {statusConfig.label}
                  </div>

                  {/* Participants count - always show */}
                  <div className="flex items-center gap-1.5 text-xs text-white/50">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                      />
                    </svg>
                    <span className="font-medium">
                      {activeSession.participants || 1}
                    </span>
                    <span className="text-white/40">in session</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <p className="text-[10px] text-white/30 text-center flex items-center justify-center gap-1.5">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                      />
                    </svg>
                    {isWaiting && isCreator
                      ? "Start your session"
                      : "Click to return to session"}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
