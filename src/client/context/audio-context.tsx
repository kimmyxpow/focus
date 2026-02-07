import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { SoundId } from '@/client/lib/sounds';

interface AudioState {
  currentSound: SoundId | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
}

interface AudioContextType extends AudioState {
  playSound: (soundId: SoundId) => Promise<void>;
  pauseSound: () => void;
  stopSound: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const VOLUME_STORAGE_KEY = 'focus-audio-volume';
const DEFAULT_VOLUME = 0.7;

interface AudioProviderProps {
  children: ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioState>({
    currentSound: null,
    isPlaying: false,
    volume: DEFAULT_VOLUME,
    isMuted: false,
  });

  // Initialize audio element and load volume from localStorage
  useEffect(() => {
    const savedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
    const initialVolume = savedVolume ? parseFloat(savedVolume) : DEFAULT_VOLUME;

    const audio = new Audio();
    audio.loop = true;
    audio.volume = initialVolume;

    audioRef.current = audio;

    setState(prev => ({
      ...prev,
      volume: initialVolume,
    }));

    // Cleanup on unmount
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update audio element volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      const effectiveVolume = state.isMuted ? 0 : state.volume;
      audioRef.current.volume = effectiveVolume;
    }
  }, [state.volume, state.isMuted]);

  const playSound = useCallback(async (soundId: SoundId) => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      // If same sound is already playing, just pause
      if (state.currentSound === soundId && state.isPlaying) {
        audio.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
        return;
      }

      // Import the sound file
      const { getSoundById } = await import('@/client/lib/sounds');
      const sound = getSoundById(soundId);
      if (!sound) {
        toast.error('Sound not found');
        return;
      }

      // If different sound, stop current and start new
      if (state.currentSound !== soundId) {
        audio.src = sound.src;
      }

      // Attempt to play
      await audio.play();

      setState({
        ...state,
        currentSound: soundId,
        isPlaying: true,
      });
    } catch (error) {
      // Handle autoplay policy or other errors
      console.error('Failed to play audio:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Please interact with the page first to play audio');
        } else {
          toast.error('Failed to play audio');
        }
      }
    }
  }, [state.currentSound, state.isPlaying, state.volume, state.isMuted]);

  const pauseSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const stopSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setState({
      currentSound: null,
      isPlaying: false,
      volume: state.volume,
      isMuted: state.isMuted,
    });
  }, [state.volume, state.isMuted]);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem(VOLUME_STORAGE_KEY, clampedVolume.toString());
    setState(prev => ({
      ...prev,
      volume: clampedVolume,
      isMuted: clampedVolume === 0,
    }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => {
      const newMutedState = !prev.isMuted;
      return {
        ...prev,
        isMuted: newMutedState,
      };
    });
  }, []);

  const contextValue: AudioContextType = {
    ...state,
    playSound,
    pauseSound,
    stopSound,
    setVolume,
    toggleMute,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
