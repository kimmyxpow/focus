import { ServerChannel } from "modelence/server";

/**
 * Chat Channel - Handles real-time chat messages within sessions
 * 
 * Channel pattern: chat:[sessionId]
 * 
 * Events broadcast:
 * - message: New chat message
 * - typing: User is typing (ephemeral, not persisted)
 */

export type ChatEventType = 'message' | 'typing';

export interface ChatMessage {
  id: string;
  odonym: string;
  message: string;
  sentAt: string;
}

export interface ChatEvent {
  type: ChatEventType;
  sessionId: string;
  timestamp: number;
  
  // Message data
  message?: ChatMessage;
  
  // Typing indicator data
  odonym?: string;
  isTyping?: boolean;
}

const chatServerChannel = new ServerChannel<ChatEvent>(
  "chat",
  async ({ user }) => {
    // Only authenticated users can join chat channels
    return !!user;
  }
);

export default chatServerChannel;
