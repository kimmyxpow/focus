import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import { cn } from '@/client/lib/utils';

type ChatMessage = {
  id: string;
  odonym: string;
  message: string;
  sentAt: string;
  isOwn: boolean;
};

interface ChatPanelProps {
  sessionId: string;
  isOpen: boolean;
  onToggle: () => void;
  chatEnabled: boolean;
  isCreator: boolean;
  isActiveParticipant: boolean;
}

export default function ChatPanel({
  sessionId,
  isOpen,
  onToggle,
  chatEnabled,
  isCreator,
  isActiveParticipant,
}: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    ...modelenceQuery<ChatMessage[]>('focus.getSessionMessages', { sessionId, limit: 50 }),
    enabled: chatEnabled && isOpen && isActiveParticipant,
    refetchInterval: isOpen ? 3000 : false, // Poll every 3s when open
  });

  const { mutate: sendMessage, isPending: isSending } = useMutation({
    ...modelenceMutation<{ success: boolean; message: ChatMessage }>('focus.sendMessage'),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSessionMessages', { sessionId, limit: 50 }) });
    },
  });

  const { mutate: toggleChat, isPending: isTogglingChat } = useMutation({
    ...modelenceMutation<{ success: boolean; chatEnabled: boolean }>('focus.toggleChat'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && chatEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, chatEnabled]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;
    sendMessage({ sessionId, message: trimmedMessage });
  }, [message, sessionId, sendMessage, isSending]);

  const handleToggleChat = useCallback(() => {
    toggleChat({ sessionId, enabled: !chatEnabled });
  }, [sessionId, chatEnabled, toggleChat]);

  // Chat toggle button (always visible)
  const toggleButton = (
    <button
      onClick={onToggle}
      className={cn(
        "fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg",
        isOpen
          ? "bg-white text-stone-900"
          : chatEnabled
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-white/10 text-white/50 hover:bg-white/15"
      )}
      title={chatEnabled ? (isOpen ? "Close chat" : "Open chat") : "Chat disabled"}
    >
      {isOpen ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      )}
      {!isOpen && messages.length > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-stone-900 rounded-full text-xs font-semibold flex items-center justify-center">
          {messages.length > 9 ? '9+' : messages.length}
        </span>
      )}
    </button>
  );

  if (!isOpen) {
    return toggleButton;
  }

  return (
    <>
      {toggleButton}

      {/* Chat Panel - Bottom drawer on mobile, side panel on desktop */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:right-4 sm:bottom-20 sm:w-80 z-30 fade-in">
        <div className="bg-stone-900/95 backdrop-blur-sm border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[60vh] sm:max-h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Chat</span>
              {chatEnabled ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="text-xs text-white/40">Disabled</span>
              )}
            </div>
            {isCreator && (
              <button
                onClick={handleToggleChat}
                disabled={isTogglingChat}
                className={cn(
                  "text-xs px-2 py-1 rounded transition-colors",
                  chatEnabled
                    ? "bg-white/10 text-white/70 hover:bg-white/20"
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                )}
              >
                {isTogglingChat ? '...' : chatEnabled ? 'Disable' : 'Enable'}
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
            {!chatEnabled ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <svg className="w-8 h-8 text-white/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-white/40 text-sm">Chat is disabled for this session</p>
                {isCreator && (
                  <p className="text-white/30 text-xs mt-1">You can enable it above</p>
                )}
              </div>
            ) : !isActiveParticipant ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <p className="text-white/40 text-sm">Join the session to chat</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="spinner" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <svg className="w-8 h-8 text-white/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-white/40 text-sm">No messages yet</p>
                <p className="text-white/30 text-xs mt-1">Start the conversation</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.isOwn ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2",
                        msg.isOwn
                          ? "bg-white text-stone-900 rounded-br-sm"
                          : "bg-white/10 text-white rounded-bl-sm"
                      )}
                    >
                      {!msg.isOwn && (
                        <span className="text-[10px] font-medium text-white/50 block mb-0.5">
                          {msg.odonym}
                        </span>
                      )}
                      <p className="text-sm break-words">{msg.message}</p>
                    </div>
                    <span className="text-[10px] text-white/30 mt-1 px-1">
                      {formatTime(msg.sentAt)}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {chatEnabled && isActiveParticipant && (
            <form onSubmit={handleSubmit} className="p-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={500}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || isSending}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    message.trim()
                      ? "bg-white text-stone-900 hover:bg-white/90"
                      : "bg-white/10 text-white/30"
                  )}
                >
                  {isSending ? (
                    <div className="spinner-sm" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
