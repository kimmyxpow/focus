/**
 * Client WebSocket Channels
 * 
 * Channel Architecture:
 * - session:[id] - Session state changes, participant updates, timer sync
 * - chat:[id] - Real-time chat messages and typing indicators
 * 
 * Usage:
 * 1. Channels are registered in startWebsockets() in index.tsx
 * 2. Components join/leave channels using useSessionChannel hook
 * 3. Events are dispatched to registered listeners
 */

export { default as sessionClientChannel, onSessionEvent } from './sessionClientChannel';
export type { SessionEvent, SessionEventType, SessionParticipant, SessionTimerData } from './sessionClientChannel';

export { default as chatClientChannel, onChatEvent } from './chatClientChannel';
export type { ChatEvent, ChatEventType, ChatMessage } from './chatClientChannel';
