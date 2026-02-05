import { useCallback, useRef, useEffect } from 'react';

type NotificationType = 'sessionEnd' | 'breakEnd' | 'breakStart' | 'warning';

// Audio context singleton to avoid creating multiple contexts
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

// Sound configurations for different notification types
const SOUND_CONFIG: Record<NotificationType, { frequencies: number[]; durations: number[]; type: OscillatorType }> = {
  sessionEnd: {
    // Triumphant chime - ascending notes
    frequencies: [523.25, 659.25, 783.99, 1046.50], // C5, E5, G5, C6
    durations: [150, 150, 150, 300],
    type: 'sine',
  },
  breakEnd: {
    // Gentle wake-up tone - two ascending notes
    frequencies: [440, 554.37, 659.25], // A4, C#5, E5
    durations: [200, 200, 300],
    type: 'sine',
  },
  breakStart: {
    // Relaxing tone - descending soft notes
    frequencies: [659.25, 523.25, 440], // E5, C5, A4
    durations: [200, 200, 300],
    type: 'sine',
  },
  warning: {
    // Subtle warning - two quick beeps
    frequencies: [880, 880], // A5, A5
    durations: [100, 100],
    type: 'sine',
  },
};

/**
 * Play a sequence of tones
 */
function playToneSequence(
  frequencies: number[],
  durations: number[],
  type: OscillatorType = 'sine',
  volume: number = 0.3
): void {
  try {
    const ctx = getAudioContext();
    
    // Resume audio context if suspended (required for autoplay policies)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    let startTime = ctx.currentTime;

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, startTime);

      // Envelope for smooth sound
      const duration = durations[index] / 1000;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02); // Attack
      gainNode.gain.setValueAtTime(volume, startTime + duration - 0.05); // Sustain
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration); // Release

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);

      startTime += duration + 0.05; // Small gap between notes
    });
  } catch (error) {
    // Silently fail if audio is not supported
  }
}

/**
 * Request browser notification permission
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show a browser notification
 */
function showBrowserNotification(title: string, body: string, icon?: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'focus-session', // Replace previous notifications with same tag
      silent: true, // We handle sound ourselves
    });

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    // Focus window when notification is clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    // Silently fail if notifications are not supported
  }
}

/**
 * Hook for managing session notifications and sounds
 */
export function useSessionNotifications() {
  const hasRequestedPermission = useRef(false);

  // Request notification permission on first interaction
  const requestPermission = useCallback(async () => {
    if (hasRequestedPermission.current) return;
    hasRequestedPermission.current = true;
    await requestNotificationPermission();
  }, []);

  // Play sound for a specific notification type
  const playSound = useCallback((type: NotificationType, volume: number = 0.3) => {
    const config = SOUND_CONFIG[type];
    if (config) {
      playToneSequence(config.frequencies, config.durations, config.type, volume);
    }
  }, []);

  // Notify when focus session ends
  const notifySessionEnd = useCallback((topic: string) => {
    playSound('sessionEnd', 0.4);
    showBrowserNotification(
      'Focus session complete!',
      `Great work on "${topic}"! Time to wrap up.`
    );
  }, [playSound]);

  // Notify when break ends
  const notifyBreakEnd = useCallback((topic: string) => {
    playSound('breakEnd', 0.35);
    showBrowserNotification(
      'Break is over!',
      `Time to get back to "${topic}".`
    );
  }, [playSound]);

  // Notify when break starts
  const notifyBreakStart = useCallback((duration: number) => {
    playSound('breakStart', 0.3);
    showBrowserNotification(
      'Time for a break!',
      `Take ${duration} minutes to rest and recharge.`
    );
  }, [playSound]);

  // Warning notification (e.g., 1 minute remaining)
  const notifyWarning = useCallback((_message: string) => {
    playSound('warning', 0.2);
    // Don't show browser notification for warnings, just sound
  }, [playSound]);

  // Request permission when component mounts (after user interaction)
  useEffect(() => {
    const handleInteraction = () => {
      requestPermission();
      // Only need to request once
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [requestPermission]);

  return {
    playSound,
    notifySessionEnd,
    notifyBreakEnd,
    notifyBreakStart,
    notifyWarning,
    requestPermission,
  };
}
