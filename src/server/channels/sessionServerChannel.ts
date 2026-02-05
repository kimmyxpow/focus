import { ServerChannel } from "modelence/server";

/**
 * Session Channel - Handles real-time session state updates
 * 
 * Channel pattern: session:[sessionId]
 * 
 * Events broadcast:
 * - status_changed: Session status transitions (waiting -> focusing, etc.)
 * - participant_joined: New participant joined the session
 * - participant_left: Participant left the session
 * - participant_reaction: Participant sent a reaction
 * - timer_sync: Server-authoritative timer update
 * - chat_toggled: Chat enabled/disabled by creator
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
  
  // Status change data
  status?: 'waiting' | 'focusing' | 'break' | 'cooldown' | 'completed' | 'cancelled';
  previousStatus?: string;
  
  // Participant data
  participant?: SessionParticipant;
  odonym?: string;
  reaction?: 'focus' | 'energy' | 'break';
  
  // Timer data
  timer?: SessionTimerData;
  
  // Chat data
  chatEnabled?: boolean;
  
  // Participant count
  participantCount?: number;
}

const sessionServerChannel = new ServerChannel<SessionEvent>(
  "session",
  async ({ user }) => {
    // Allow any authenticated user to join session channels
    // Session-level access control is handled by the application logic
    // when determining which sessions a user can see/join
    return !!user;
  }
);

export default sessionServerChannel;
