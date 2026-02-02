/**
 * Server WebSocket Channels
 * 
 * Channel Architecture:
 * - session:[id] - Session state changes, participant updates, timer sync
 * - chat:[id] - Real-time chat messages and typing indicators
 * 
 * Following Modelence patterns for:
 * - Room-based broadcasting (each session is a room)
 * - Authentication integration (automatic via session token)
 * - Horizontal scaling (MongoDB adapter for multi-instance)
 */

export { default as sessionServerChannel } from './sessionServerChannel';
export type { SessionEvent, SessionEventType, SessionParticipant, SessionTimerData } from './sessionServerChannel';

export { default as chatServerChannel } from './chatServerChannel';
export type { ChatEvent, ChatEventType, ChatMessage } from './chatServerChannel';
