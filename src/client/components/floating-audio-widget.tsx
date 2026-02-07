import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/client/lib/utils';
import { useAudio } from '@/client/context/audio-context';
import { getSoundById, getSounds } from '@/client/lib/sounds';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

export default function FloatingAudioWidget() {
  const { currentSound, isPlaying, volume, isMuted, playSound, pauseSound, setVolume, toggleMute } = useAudio();
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const location = useLocation();
  const isInteractingWithControls = useRef(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Check if we're on the focus page
  const isFocusPage = location.pathname.startsWith('/focus/');

  // Get all available sounds
  const availableSounds = useMemo(() => getSounds(), []);

  // Sync local volume with context volume
  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  // Show widget only when audio is active
  useEffect(() => {
    if (currentSound) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [currentSound]);

  const currentSoundData = useMemo(() => {
    if (!currentSound) return null;
    return getSoundById(currentSound);
  }, [currentSound]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    setVolume(newVolume);
  }, [setVolume]);

  const handlePlayPause = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isInteractingWithControls.current = true;
    setTimeout(() => {
      isInteractingWithControls.current = false;
    }, 100);

    if (isPlaying) {
      pauseSound();
    } else if (currentSound) {
      playSound(currentSound);
    }
  }, [isPlaying, currentSound, playSound, pauseSound]);

  const handleMuteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isInteractingWithControls.current = true;
    setTimeout(() => {
      isInteractingWithControls.current = false;
    }, 100);
    toggleMute();
  }, [toggleMute]);

  const handleWidgetClick = useCallback((e: React.MouseEvent) => {
    // Widget click is disabled since sounds can be changed directly
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleSliderPointerDown = useCallback(() => {
    isInteractingWithControls.current = true;
  }, []);

  const handleSliderPointerUp = useCallback(() => {
    setTimeout(() => {
      isInteractingWithControls.current = false;
    }, 100);
  }, []);

  const handleSoundSelect = useCallback((soundId: string) => {
    isInteractingWithControls.current = true;
    playSound(soundId as any);
    setTimeout(() => {
      isInteractingWithControls.current = false;
    }, 100);
  }, [playSound]);

  if (!isVisible || !currentSoundData) {
    return null;
  }

  const effectiveVolume = isMuted ? 0 : localVolume;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="floating-audio-widget"
        className={cn(
          "fixed bottom-6 z-50",
          isFocusPage ? "left-1/2" : "right-6"
        )}
        style={isFocusPage ? { x: "-50%", willChange: "transform, opacity" } : undefined}
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'tween', duration: 0.5, ease: EASE_OUT_EXPO }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <div ref={widgetRef}>
          <motion.div
            className={cn(
              'relative overflow-hidden',
              'bg-stone-900/95 backdrop-blur-md',
              'border border-white/10',
              'rounded-2xl',
              'shadow-lg shadow-black/20'
            )}
            style={{ willChange: 'transform, width' }}
            animate={{ width: isHovered ? 320 : 200 }}
            whileTap={{ scale: 0.98 }}
            transition={{
              width: { type: 'tween', duration: 0.35, ease: EASE_OUT_EXPO },
              scale: { type: 'tween', duration: 0.2, ease: EASE_OUT_QUART },
            }}
          >
            {/* Ambient glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(232, 168, 156, 0.12) 0%, transparent 70%)',
              }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{
                type: 'tween',
                duration: 0.3,
                ease: EASE_OUT_QUART,
              }}
            />

            {/* Border glow on hover */}
            <motion.div
              className="absolute inset-0 pointer-events-none rounded-2xl border border-[#e8a89c]/30"
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{
                type: 'tween',
                duration: 0.3,
                ease: EASE_OUT_QUART,
              }}
            />

            {/* Content */}
            <div className="relative px-3 py-2">
              {/* Sound info with icon and playing indicator - always visible */}
              <div className="flex items-center gap-2">
                {/* Icon with playing indicator */}
                <div className="relative flex-shrink-0">
                  <span className="text-lg">
                    {currentSoundData.icon}
                  </span>
                  {/* Playing indicator */}
                  {isPlaying && (
                    <motion.div
                      className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#e8a89c]"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                    />
                  )}
                </div>

                {/* Sound name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {currentSoundData.name}
                  </p>
                </div>
              </div>

              {/* Controls - Only visible on hover */}
              <motion.div
                className="overflow-hidden"
                initial={false}
                animate={{
                  height: isHovered ? 'auto' : 0,
                  opacity: isHovered ? 1 : 0,
                }}
                transition={{
                  height: {
                    type: 'tween',
                    duration: 0.35,
                    ease: EASE_OUT_EXPO,
                  },
                  opacity: {
                    type: 'tween',
                    duration: 0.25,
                    ease: EASE_OUT_QUART,
                    delay: isHovered ? 0.1 : 0,
                  },
                }}
              >
                <div
                  className="pt-2 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Play/Pause button */}
                  <button
                    onClick={handlePlayPause}
                    className={cn(
                      'w-full px-3 py-1 rounded-lg',
                      'flex items-center justify-center gap-2',
                      'text-sm font-semibold transition-all',
                      'bg-white/10 hover:bg-white/15',
                      'text-white'
                    )}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      {isPlaying ? (
                        <path
                          fillRule="evenodd"
                          d="M6 4h3v16H6V4zm9 0h3v16h-3V4z"
                          clipRule="evenodd"
                        />
                      ) : (
                        <path
                          fillRule="evenodd"
                          d="M8 5v14l11-7z"
                          clipRule="evenodd"
                        />
                      )}
                    </svg>
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  {/* Volume control - single row */}
                  <div className="flex items-center gap-2">
                    {/* Mute button */}
                    <button
                      onClick={handleMuteClick}
                      className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white/80"
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted || effectiveVolume === 0 ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      )}
                    </button>

                    {/* Volume slider */}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={effectiveVolume}
                      onChange={handleVolumeChange}
                      onPointerDown={handleSliderPointerDown}
                      onPointerUp={handleSliderPointerUp}
                      onPointerLeave={handleSliderPointerUp}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-125"
                      aria-label="Volume"
                    />

                    {/* Volume percentage */}
                    <span className="text-[10px] text-white/40 font-medium tabular-nums flex-shrink-0 w-8 text-right">
                      {Math.round(effectiveVolume * 100)}%
                    </span>
                  </div>

                  {/* Sound list */}
                  <div className="pt-2">
                    <p className="text-[10px] text-white/40 font-medium mb-2 px-1">Change Sound</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {availableSounds.map((sound) => {
                        const isActive = currentSound === sound.id;
                        return (
                          <motion.button
                            key={sound.id}
                            onClick={() => handleSoundSelect(sound.id)}
                            className={cn(
                              'relative p-2 rounded-lg',
                              'flex flex-col items-center gap-1',
                              'transition-all',
                              isActive
                                ? 'bg-[#e8a89c]/20 border border-[#e8a89c]/30'
                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                            )}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {/* Active indicator */}
                            {isActive && (
                              <motion.div
                                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#e8a89c]"
                                layoutId="active-sound-indicator"
                                transition={{
                                  type: 'spring',
                                  stiffness: 300,
                                  damping: 30,
                                }}
                              />
                            )}

                            {/* Sound icon */}
                            <span className="text-lg leading-none">{sound.icon}</span>

                            {/* Sound name */}
                            <span className={cn(
                              'text-[9px] font-medium leading-tight truncate w-full text-center',
                              isActive ? 'text-[#e8a89c]' : 'text-white/60'
                            )}>
                              {sound.name}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
