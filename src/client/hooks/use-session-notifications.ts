import { useCallback, useRef, useEffect } from 'react';

type NotificationType = 'sessionEnd' | 'breakEnd' | 'breakStart' | 'warning';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

const SOUND_CONFIG: Record<NotificationType, { frequencies: number[]; durations: number[]; type: OscillatorType }> = {
  sessionEnd: {
    frequencies: [523.25, 659.25, 783.99, 1046.50],
    durations: [150, 150, 150, 300],
    type: 'sine',
  },
  breakEnd: {
    frequencies: [440, 554.37, 659.25],
    durations: [200, 200, 300],
    type: 'sine',
  },
  breakStart: {
    frequencies: [659.25, 523.25, 440],
    durations: [200, 200, 300],
    type: 'sine',
  },
  warning: {
    frequencies: [880, 880],
    durations: [100, 100],
    type: 'sine',
  },
};

function playToneSequence(
  frequencies: number[],
  durations: number[],
  type: OscillatorType = 'sine',
  volume: number = 0.3
): void {
  try {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    let startTime = ctx.currentTime;

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, startTime);

      const duration = durations[index] / 1000;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gainNode.gain.setValueAtTime(volume, startTime + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);

      startTime += duration + 0.05;
    });
  } catch (error) {
  }
}

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

function showBrowserNotification(title: string, body: string, icon?: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'focus-session',
      silent: true,
    });

    setTimeout(() => notification.close(), 5000);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
  }
}

export function useSessionNotifications() {
  const hasRequestedPermission = useRef(false);

  const requestPermission = useCallback(async () => {
    if (hasRequestedPermission.current) return;
    hasRequestedPermission.current = true;
    await requestNotificationPermission();
  }, []);

  const playSound = useCallback((type: NotificationType, volume: number = 0.3) => {
    const config = SOUND_CONFIG[type];
    if (config) {
      playToneSequence(config.frequencies, config.durations, config.type, volume);
    }
  }, []);

  const notifySessionEnd = useCallback((topic: string) => {
    playSound('sessionEnd', 0.4);
    showBrowserNotification(
      'Focus session complete!',
      `Great work on "${topic}"! Time to wrap up.`
    );
  }, [playSound]);

  const notifyBreakEnd = useCallback((topic: string) => {
    playSound('breakEnd', 0.35);
    showBrowserNotification(
      'Break is over!',
      `Time to get back to "${topic}".`
    );
  }, [playSound]);

  const notifyBreakStart = useCallback((duration: number) => {
    playSound('breakStart', 0.3);
    showBrowserNotification(
      'Time for a break!',
      `Take ${duration} minutes to rest and recharge.`
    );
  }, [playSound]);

  const notifyWarning = useCallback((_message: string) => {
    playSound('warning', 0.2);
  }, [playSound]);

  useEffect(() => {
    const handleInteraction = () => {
      requestPermission();
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
