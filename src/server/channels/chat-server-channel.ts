import { ServerChannel } from "modelence/server";

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

  message?: ChatMessage;

  odonym?: string;
  isTyping?: boolean;
}

const chatServerChannel = new ServerChannel<ChatEvent>(
  "chat",
  async ({ user }) => {
    return !!user;
  }
);

export default chatServerChannel;
