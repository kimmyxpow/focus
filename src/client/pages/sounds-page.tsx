import Page from '@/client/components/Page';
import { useAudio } from '@/client/context/audio-context';
import { getSounds, getCredits } from '@/client/lib/sounds';

export default function SoundsPage() {
  const sounds = getSounds();
  const credits = getCredits();
  const { currentSound, isPlaying, volume, isMuted, playSound, pauseSound, setVolume, toggleMute } = useAudio();

  return (
    <Page variant="dark">
      <div className="container-lg">
        {/* Header */}
        <section className="fade-in pt-6">
          <div className="py-4 mb-4">
            <h1 className="text-display-sm text-white">Ambient Sounds</h1>
            <p className="text-white/50 text-sm mt-1">Choose a background sound to help you focus</p>
          </div>

          {/* Volume Control */}
          <div className="py-4 border-y border-white/10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={toggleMute}
                  className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-125"
                    aria-label="Volume"
                  />
                </div>
              </div>
              <span className="text-sm text-white/60 font-medium tabular-nums">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>

          {/* Sounds List */}
          <div className="divide-y divide-white/5">
            {sounds.map((sound) => {
              const isActive = currentSound === sound.id;
              const isCurrentlyPlaying = isActive && isPlaying;

              return (
                <div
                  key={sound.id}
                  className="w-full py-3 transition-colors text-left fade-in"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Icon */}
                      <span className="text-xl flex-shrink-0">
                        {sound.icon}
                      </span>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-white/80 block">
                          {sound.name}
                        </span>
                        <p className="text-xs text-white/50 truncate">
                          {sound.description}
                        </p>
                      </div>
                    </div>

                    {/* Play/Pause Button - monochromatic style */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrentlyPlaying) {
                          pauseSound();
                        } else {
                          playSound(sound.id);
                        }
                      }}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm font-semibold bg-white text-stone-900 rounded-lg transition-all hover:bg-white/90"
                    >
                      {isCurrentlyPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M6 4h3v16H6V4zm9 0h3v16h-3V4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M8 5v14l11-7z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Credits */}
          <details className="group mt-6 pt-4 border-t border-white/10">
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Sound Credits
              </h3>
              <svg
                className="w-4 h-4 text-white/40 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="mt-4 space-y-2 text-xs text-white/40">
              {credits.map((item) => (
                <div key={item.sound} className="leading-relaxed">
                  <span className="font-medium text-white/50">{item.sound}:</span>{' '}
                  <span dangerouslySetInnerHTML={{ __html: item.credit }} />
                </div>
              ))}
            </div>
          </details>
        </section>
      </div>
    </Page>
  );
}
