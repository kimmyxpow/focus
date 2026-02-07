import { motion } from 'motion/react';
import { cn } from '@/client/lib/utils';
import type { Sound, SoundId } from '@/client/lib/sounds';

interface SoundCardProps {
  sound: Sound;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (soundId: SoundId) => void;
  onPause: () => void;
  className?: string;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export default function SoundCard({
  sound,
  isActive,
  isPlaying,
  onPlay,
  onPause,
  className,
}: SoundCardProps) {
  const handleClick = () => {
    if (isActive && isPlaying) {
      onPause();
    } else {
      onPlay(sound.id);
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        'relative w-full p-5 rounded-xl',
        'bg-white/5 hover:bg-white/10',
        'border border-white/10',
        'transition-all duration-200',
        'text-left',
        isActive && 'border-[#e8a89c] shadow-lg shadow-[#e8a89c]/10',
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'tween', duration: 0.2, ease: EASE_OUT_EXPO }}
    >
      {/* Active indicator glow */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-[#e8a89c]/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}

      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-12 h-12 rounded-lg',
            'flex items-center justify-center text-2xl',
            'bg-white/5',
            isActive && 'bg-[#e8a89c]/10'
          )}
        >
          {sound.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-display-sm text-white mb-1">
            {sound.name}
          </h3>
          <p className="text-body-sm-dark text-sm">
            {sound.description}
          </p>
        </div>

        {/* Play/Pause Button */}
        <div className="flex-shrink-0">
          <motion.div
            className={cn(
              'w-10 h-10 rounded-full',
              'flex items-center justify-center',
              'transition-colors',
              isActive
                ? 'bg-[#e8a89c] text-stone-900'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
            animate={isActive && isPlaying ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{
              duration: 2,
              repeat: isActive && isPlaying ? Infinity : 0,
              ease: 'easeInOut',
            }}
          >
            {isActive && isPlaying ? (
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Pause</title>
                <path
                  fillRule="evenodd"
                  d="M6 4h3v16H6V4zm9 0h3v16h-3V4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Play</title>
                <path
                  fillRule="evenodd"
                  d="M8 5v14l11-7z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </motion.div>
        </div>
      </div>

      {/* Playing indicator */}
      {isActive && isPlaying && (
        <motion.div
          className="absolute bottom-3 left-5 right-5 flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="flex-1 h-1 rounded-full bg-[#e8a89c]/60"
              animate={{
                scaleY: [1, 1.5, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
      )}
    </motion.button>
  );
}
