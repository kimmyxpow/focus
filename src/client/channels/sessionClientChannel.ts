import { ClientChannel } from "modelence/client";

export type SessionEventType =
  | 'status_changed'
  | 'participant_joined'
  | 'participant_left'
  | 'participant_reaction'
  | 'timer_sync'
  | 'chat_toggled';

export interface SessionParticipant {
  odonym: string;
  lastReaction?: 'focus' | 'energy' | 'break';
  isActive: boolean;
}

export interface SessionTimerData {
  remainingSeconds: number;
  elapsedSeconds: number;
  targetDurationMinutes: number;
  serverTimestamp: number;
}

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: number;
  status?: 'waiting' | 'focusing' | 'break' | 'cooldown' | 'completed' | 'cancelled';
  previousStatus?: string;
  participant?: SessionParticipant;
  odonym?: string;
  reaction?: 'focus' | 'energy' | 'break';
  timer?: SessionTimerData;
  chatEnabled?: boolean;
  participantCount?: number;
}

type SessionEventListener = (event: SessionEvent) => void;
const sessionEventListeners: Map<string, Set<SessionEventListener>> = new Map();

export function onSessionEvent(sessionId: string, listener: SessionEventListener): () => void {
  if (!sessionEventListeners.has(sessionId)) {
    sessionEventListeners.set(sessionId, new Set());
  }
  sessionEventListeners.get(sessionId)!.add(listener);

  return () => {
    const listeners = sessionEventListeners.get(sessionId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        sessionEventListeners.delete(sessionId);
      }
    }
  };
}

function dispatchSessionEvent(event: SessionEvent) {
  const listeners = sessionEventListeners.get(event.sessionId);
  if (listeners) {
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[SessionChannel] Error in event listener:', error);
      }
    });
  }
}

const sessionClientChannel = new ClientChannel<SessionEvent>(
  "session",
  async (event) => {
    dispatchSessionEvent(event);
  }
);

export default sessionClientChannel;
