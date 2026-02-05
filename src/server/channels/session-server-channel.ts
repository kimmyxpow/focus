import { ServerChannel } from "modelence/server";

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

const sessionServerChannel = new ServerChannel<SessionEvent>(
  "session",
  async ({ user }) => {
    return !!user;
  }
);

export default sessionServerChannel;
