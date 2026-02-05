import { ClientChannel } from "modelence/client";

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

type ChatEventListener = (event: ChatEvent) => void;
const chatEventListeners: Map<string, Set<ChatEventListener>> = new Map();

export function onChatEvent(sessionId: string, listener: ChatEventListener): () => void {
  if (!chatEventListeners.has(sessionId)) {
    chatEventListeners.set(sessionId, new Set());
  }
  chatEventListeners.get(sessionId)!.add(listener);

  return () => {
    const listeners = chatEventListeners.get(sessionId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        chatEventListeners.delete(sessionId);
      }
    }
  };
}

function dispatchChatEvent(event: ChatEvent) {
  const listeners = chatEventListeners.get(event.sessionId);
  if (listeners) {
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ChatChannel] Error in event listener:', error);
      }
    });
  }
}

const chatClientChannel = new ClientChannel<ChatEvent>(
  "chat",
  async (event) => {
    dispatchChatEvent(event);
  }
);

export default chatClientChannel;
