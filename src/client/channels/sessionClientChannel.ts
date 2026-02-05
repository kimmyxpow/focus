import { ClientChannel } from "modelence/client";

/**
 * Session Event Types matching server-side definitions
 */
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

// Event listeners that can be registered dynamically
type SessionEventListener = (event: SessionEvent) => void;
const sessionEventListeners: Map<string, Set<SessionEventListener>> = new Map();

/**
 * Register a listener for session events
 * Returns an unsubscribe function
 */
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

/**
 * Dispatch event to all registered listeners for a session
 */
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

/**
 * Session Client Channel
 * Handles real-time session state updates
 */
const sessionClientChannel = new ClientChannel<SessionEvent>(
  "session",
  async (event) => {
    console.log('[SessionChannel] Received event:', event.type, event);
    dispatchSessionEvent(event);
  }
);

export default sessionClientChannel;
