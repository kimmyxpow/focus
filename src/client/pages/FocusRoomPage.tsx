import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import ChatPanel from '@/client/components/ChatPanel';
import ConnectionStatusIndicator from '@/client/components/ConnectionStatusIndicator';
import { cn } from '@/client/lib/utils';
import { useSessionNotifications } from '@/client/hooks/useSessionNotifications';
import { useSessionChannel } from '@/client/hooks/useSessionChannel';
import type { SessionEvent } from '@/client/channels';

type Participant = {
  odonym: string;
  lastReaction?: 'focus' | 'energy' | 'break';
  isActive: boolean;
};

type TimerState = {
  remainingSeconds: number;
  elapsedSeconds: number;
  targetDurationMinutes: number;
  serverTimestamp: number;
};

type SessionData = {
  _id: string;
  intent: string;
  topic: string;
  minDuration: number;
  maxDuration: number;
  actualDuration?: number;
  status: 'waiting' | 'focusing' | 'break' | 'cooldown' | 'completed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  cooldownPrompt?: string;
  participantCount: number;
  repetitions: number;
  breakDuration: number;
  breakInterval: number;
  currentRepetition: number;
  timer: TimerState;
  participants: Participant[];
  userParticipation: {
    odonym: string;
    outcome?: string;
    isActive: boolean;
  } | null;
  isCreator: boolean;
  isPrivate: boolean;
  inviteCode?: string;
  chatEnabled: boolean;
  creatorName?: string;
};

const REACTIONS = [
  { key: 'focus' as const, label: 'Deep focus', color: 'text-purple-300/80' },
  { key: 'energy' as const, label: 'Energized', color: 'text-pink-300/80' },
  { key: 'break' as const, label: 'Need a break', color: 'text-blue-300/80' },
];

function CircularProgress({ progress, size = 280, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="timer-ring-bg"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="timer-ring transition-all duration-1000 ease-linear"
      />
    </svg>
  );
}

function ParticipantAvatar({ participant, isCurrentUser }: { participant: Participant; isCurrentUser: boolean }) {
  const reaction = REACTIONS.find(r => r.key === participant.lastReaction);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-medium transition-colors",
          isCurrentUser
            ? "bg-white/20 text-white"
            : "bg-white/10 text-white/70",
          !participant.isActive && "opacity-40"
        )}
      >
        {participant.odonym.charAt(0).toUpperCase()}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs text-white/50">
          {isCurrentUser ? 'You' : participant.odonym.slice(0, 8)}
        </span>
        {reaction && (
          <span className={cn("text-[10px] font-medium", reaction.color)}>
            {reaction.label}
          </span>
        )}
      </div>
    </div>
  );
}

function CopyInviteButton({ sessionId, inviteCode, isPrivate }: { sessionId: string; inviteCode?: string; isPrivate: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const url = isPrivate && inviteCode
      ? `${window.location.origin}/invite/${inviteCode}`
      : `${window.location.origin}/focus/${sessionId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Session link copied!');
    setTimeout(() => setCopied(false), 2000);
  }, [sessionId, inviteCode, isPrivate]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="btn-outline-light text-sm flex items-center gap-2"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          Copy Invite Link
        </>
      )}
    </button>
  );
}

export default function FocusRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { notifySessionEnd, notifyBreakEnd, notifyBreakStart, notifyWarning } = useSessionNotifications();

  const [localRemainingSeconds, setLocalRemainingSeconds] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const timerSyncRef = useRef<number>(0);
  const previousStatusRef = useRef<string | null>(null);
  const hasNotifiedWarningRef = useRef<boolean>(false);

  const handleStatusChange = useCallback((event: SessionEvent) => {
    if (event.status && event.timer) {
      const networkDelay = Date.now() - event.timer.serverTimestamp;
      const adjustedRemaining = Math.max(0, event.timer.remainingSeconds - Math.floor(networkDelay / 1000));
      setLocalRemainingSeconds(adjustedRemaining);
      timerSyncRef.current = Date.now();
    }
  }, []);

  const handleTimerSync = useCallback((event: SessionEvent) => {
    if (event.timer) {
      const networkDelay = Date.now() - event.timer.serverTimestamp;
      const adjustedRemaining = Math.max(0, event.timer.remainingSeconds - Math.floor(networkDelay / 1000));
      setLocalRemainingSeconds(adjustedRemaining);
      timerSyncRef.current = Date.now();
    }
  }, []);

  useSessionChannel({
    sessionId,
    onStatusChange: handleStatusChange,
    onTimerSync: handleTimerSync,
    enableChat: true,
  });

  const { data: session, isLoading, error } = useQuery({
    ...modelenceQuery<SessionData>('focus.getSession', { sessionId }),
    enabled: !!sessionId,
    refetchInterval: 30000,
    staleTime: 5000,
  });

  const { mutate: joinSession, isPending: isJoining } = useMutation({
    ...modelenceMutation<{ odonym: string; rejoined: boolean }>('focus.joinSession'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) });
      toast.success(data.rejoined ? 'Welcome back!' : 'Joined session!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: startSession, isPending: isStarting } = useMutation({
    ...modelenceMutation('focus.startSession'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) }),
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: endSession, isPending: isEnding } = useMutation({
    ...modelenceMutation<{ success: boolean; cooldownPrompt?: string }>('focus.endSession'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) }),
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: completeSession, isPending: isCompleting } = useMutation({
    ...modelenceMutation('focus.completeSession'),
    onSuccess: () => navigate(`/focus/${sessionId}/summary`),
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: leaveSession, isPending: isLeaving } = useMutation({
    ...modelenceMutation('focus.leaveSession'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getActiveSession', {}) });
      navigate('/');
      toast.success('Left session');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: sendReaction } = useMutation({
    ...modelenceMutation('focus.sendReaction'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) }),
  });

  useEffect(() => {
    if (session?.timer && session.status === 'focusing') {
      const networkDelay = Date.now() - session.timer.serverTimestamp;
      const adjustedRemaining = Math.max(0, session.timer.remainingSeconds - Math.floor(networkDelay / 1000));
      setLocalRemainingSeconds(adjustedRemaining);
      timerSyncRef.current = Date.now();
    }
  }, [session?.timer, session?.status]);

  useEffect(() => {
    if (localRemainingSeconds === null || localRemainingSeconds <= 0) return;
    if (session?.status !== 'focusing') return;

    const interval = setInterval(() => {
      setLocalRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localRemainingSeconds, session?.status]);

  useEffect(() => {
    if (localRemainingSeconds === 0 && session?.status === 'focusing') {
      endSession({ sessionId });
    }
  }, [localRemainingSeconds, session?.status, sessionId, endSession]);

  const sessionStatus = session?.status;
  const sessionTopic = session?.topic;
  const sessionBreakDuration = session?.breakDuration;
  const isUserActive = session?.userParticipation?.isActive;

  useEffect(() => {
    if (!sessionStatus || !isUserActive) return;

    const prevStatus = previousStatusRef.current;
    const currentStatus = sessionStatus;

    if (prevStatus && prevStatus !== currentStatus) {
      if (prevStatus === 'focusing' && currentStatus === 'cooldown') {
        notifySessionEnd(sessionTopic || 'Focus Session');
      }
      if (prevStatus === 'break' && currentStatus === 'focusing') {
        notifyBreakEnd(sessionTopic || 'Focus Session');
      }
      if (prevStatus === 'focusing' && currentStatus === 'break') {
        notifyBreakStart(sessionBreakDuration || 5);
      }
    }

    previousStatusRef.current = currentStatus;
  }, [sessionStatus, sessionTopic, sessionBreakDuration, isUserActive, notifySessionEnd, notifyBreakEnd, notifyBreakStart]);

  useEffect(() => {
    if (localRemainingSeconds === 60 && !hasNotifiedWarningRef.current && session?.status === 'focusing') {
      notifyWarning('1 minute remaining');
      hasNotifiedWarningRef.current = true;
    }
    if (localRemainingSeconds && localRemainingSeconds > 60) {
      hasNotifiedWarningRef.current = false;
    }
  }, [localRemainingSeconds, session?.status, notifyWarning]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isCreator = session?.isCreator ?? false;
  const isParticipant = session?.userParticipation !== null;
  const isActiveParticipant = session?.userParticipation?.isActive ?? false;
  const canRejoin = isParticipant && !isActiveParticipant && session?.status !== 'completed' && session?.status !== 'cancelled';
  const currentOdonym = session?.userParticipation?.odonym;

  if (isLoading) {
    return (
      <Page variant="dark" hideNav>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center fade-in">
            <div className="spinner-lg mx-auto mb-4" />
            <span className="text-white/50 text-sm">Getting your session ready...</span>
          </div>
        </div>
      </Page>
    );
  }

  if (error || !session) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-12 fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Oops! We couldn't find this session</h2>
            <p className="text-white/50 text-sm mb-6">This session might have ended, or the link may be incorrect.</p>
            <Link to="/" className="btn-light inline-block">
              Browse Active Sessions
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  if (session.status === 'completed') {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-12 fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Session finished</h2>
            <p className="text-white/50 text-sm mb-6">Great work! This session has wrapped up.</p>
            <Link to={`/focus/${sessionId}/summary`} className="btn-light inline-block">
              See how it went
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  if (session.status === 'waiting') {
    return (
      <Page variant="dark">
        <div className="container-md">
          <div className="py-6 fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="chip bg-white/10 text-white/70">Getting ready to focus</span>
                {session.isPrivate && (
                  <span className="chip bg-white/5 text-white/50">Private</span>
                )}
                {isCreator && (
                  <span className="chip bg-white/20 text-white">Your Room</span>
                )}
              </div>
              <span className="text-sm text-white/50">
                {session.participantCount} participant{session.participantCount !== 1 ? 's' : ''}
              </span>
            </div>

            <h1 className="text-display-sm text-white mb-2">{session.topic}</h1>
            <p className="text-white/50 text-sm mb-6">{session.intent}</p>

            <div className="text-center py-8 bg-white/5 rounded-lg mb-6">
              <span className="text-5xl font-semibold display-number text-white">
                {session.actualDuration || session.maxDuration}
              </span>
              <span className="block text-sm text-white/40 mt-1">minutes</span>
              {session.repetitions > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="chip bg-white/10 text-white/70">{session.repetitions} sessions</span>
                  <span className="text-xs text-white/40">
                    {session.breakDuration}min breaks every {session.breakInterval} session{session.breakInterval > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-6">
              <p className="text-label text-white/40 mb-3">Participants</p>
              <div className="flex flex-wrap gap-2">
                {session.participants.map((p) => (
                  <span
                    key={p.odonym}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium",
                      p.odonym === currentOdonym
                        ? "bg-white text-stone-900"
                        : "bg-white/10 text-white/70"
                    )}
                  >
                    {p.odonym}{p.odonym === currentOdonym && ' (you)'}
                  </span>
                ))}
              </div>
            </div>

            {/* Invite Link */}
            {(session.inviteCode || isCreator || isActiveParticipant) && (
              <div className="mb-6 p-4 bg-white/5 rounded-lg flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Share session</p>
                  <p className="text-xs text-white/40 truncate">
                    {session.isPrivate 
                      ? 'Copy invite link to share with others'
                      : 'Copy link to share with others'}
                  </p>
                </div>
                <CopyInviteButton 
                  sessionId={sessionId!} 
                  inviteCode={session.inviteCode} 
                  isPrivate={session.isPrivate} 
                />
              </div>
            )}

            <div className="space-y-3">
              {canRejoin ? (
                <button
                  type="button"
                  className="btn-light w-full"
                  onClick={() => joinSession({ sessionId })}
                  disabled={isJoining}
                >
                  {isJoining ? 'Rejoining...' : 'Rejoin'}
                </button>
              ) : !isActiveParticipant && !isParticipant ? (
                <button
                  type="button"
                  className="btn-light w-full"
                  onClick={() => joinSession({ sessionId })}
                  disabled={isJoining || !user}
                >
                  {!user ? 'Sign in to Join' : isJoining ? 'Joining...' : 'Join Session'}
                </button>
              ) : isCreator ? (
                <button
                  type="button"
                  className="btn-light w-full"
                  onClick={() => startSession({ sessionId })}
                  disabled={isStarting}
                >
                  {isStarting ? 'Starting...' : 'Start Session'}
                </button>
              ) : (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-white/40">
                    <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                    <span>Sit tight, we're starting soon...</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn-ghost-light w-full"
                onClick={() => isActiveParticipant ? leaveSession({ sessionId }) : navigate('/')}
                disabled={isLeaving}
              >
                {isActiveParticipant ? 'Leave session' : 'Back'}
              </button>
            </div>
          </div>
        </div>

        {/* Chat Panel for waiting state */}
        {sessionId && (
          <ChatPanel
            sessionId={sessionId}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
            chatEnabled={session.chatEnabled}
            isCreator={isCreator}
            isActiveParticipant={isActiveParticipant}
            currentOdonym={currentOdonym}
          />
        )}
      </Page>
    );
  }

  if (session.status === 'focusing') {
    const totalSeconds = (session.actualDuration || session.maxDuration) * 60;
    const remaining = localRemainingSeconds ?? session.timer.remainingSeconds;
    const elapsed = totalSeconds - remaining;
    const progress = (elapsed / totalSeconds) * 100;

    return (
      <Page variant="dark" hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4">
          <div className="text-center space-y-8 fade-in">
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="status-dot status-live" />
                <span className="text-sm text-white/50">You're in the zone</span>
                <ConnectionStatusIndicator sessionId={sessionId} />
                {session.repetitions > 1 && (
                  <span className="text-sm text-white/30">
                    ({session.currentRepetition}/{session.repetitions})
                  </span>
                )}
              </div>
              <h1 className="text-xl font-semibold text-white">{session.topic}</h1>
            </div>

            <div className="relative inline-flex items-center justify-center">
              <CircularProgress progress={progress} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl sm:text-7xl font-semibold text-white display-number">
                  {formatTime(remaining)}
                </span>
                <span className="text-sm text-white/40 mt-2">
                  {Math.floor(elapsed / 60)} of {session.actualDuration || session.maxDuration} min
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-6">
              {session.participants.filter(p => p.isActive).map((p) => (
                <ParticipantAvatar
                  key={p.odonym}
                  participant={p}
                  isCurrentUser={p.odonym === currentOdonym}
                />
              ))}
            </div>

            {canRejoin ? (
              <div className="text-center">
                <p className="text-white/50 mb-4">You left this session. Rejoin to continue focusing.</p>
                <button
                  type="button"
                  className="btn-light"
                  onClick={() => joinSession({ sessionId })}
                  disabled={isJoining}
                >
                  {isJoining ? 'Rejoining...' : 'Rejoin'}
                </button>
              </div>
            ) : isActiveParticipant ? (
              <>
                <div className="flex justify-center gap-2">
                  {REACTIONS.map((reaction) => (
                    <button
                      type="button"
                      key={reaction.key}
                      onClick={() => sendReaction({ sessionId, reaction: reaction.key })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs font-medium border border-white/10 focus-ring",
                        reaction.color
                      )}
                    >
                      {reaction.label}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-3 pt-4">
                  {isCreator && (
                    <button
                      type="button"
                      className="btn-outline-light"
                      onClick={() => endSession({ sessionId })}
                      disabled={isEnding}
                    >
                      {isEnding ? 'Ending...' : 'End session early'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost-light"
                    onClick={() => navigate('/')}
                  >
                    Back home
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-light"
                    onClick={() => leaveSession({ sessionId })}
                    disabled={isLeaving}
                  >
                    {isLeaving ? 'Leaving...' : 'Leave session'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-white/50 mb-4">Session in progress</p>
                <button
                  type="button"
                  className="btn-ghost-light"
                  onClick={() => navigate('/')}
                >
                  Back to Sessions
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel for focusing state */}
        {sessionId && (
          <ChatPanel
            sessionId={sessionId}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
            chatEnabled={session.chatEnabled}
            isCreator={isCreator}
            isActiveParticipant={isActiveParticipant}
            currentOdonym={currentOdonym}
          />
        )}
      </Page>
    );
  }

  if (session.status === 'cooldown') {
    return (
      <Page variant="dark" hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="container-md text-center space-y-8 fade-in">
            <div>
              <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="chip bg-emerald-500/20 text-emerald-400 mb-3 inline-block">Session complete!</span>
              <h1 className="text-display-md text-white">{session.topic}</h1>
            </div>

            {session.cooldownPrompt && (
              <div className="p-6 bg-white/5 rounded-xl border border-white/5">
                <p className="text-lg text-white/90 leading-relaxed italic">
                  "{session.cooldownPrompt}"
                </p>
                <p className="text-xs text-white/40 mt-4">Take a moment to reflect on your session</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
              <div className="p-4 text-center bg-white/5 rounded-xl">
                <span className="text-3xl font-semibold display-number text-white">
                  {session.actualDuration || session.maxDuration}
                </span>
                <span className="block text-xs text-white/40 mt-1">minutes</span>
              </div>
              <div className="p-4 text-center bg-white/5 rounded-xl">
                <span className="text-3xl font-semibold display-number text-white">
                  {session.participantCount}
                </span>
                <span className="block text-xs text-white/40 mt-1">participants</span>
              </div>
            </div>

            {isCreator ? (
              <button
                type="button"
                className="btn-light"
                onClick={() => completeSession({ sessionId })}
                disabled={isCompleting}
              >
                {isCompleting ? 'Completing...' : 'View Summary'}
              </button>
            ) : (
              <Link to={`/focus/${sessionId}/summary`} className="btn-light inline-block">
                View Summary
              </Link>
            )}
          </div>
        </div>

        {/* Chat Panel for cooldown state */}
        {sessionId && (
          <ChatPanel
            sessionId={sessionId}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
            chatEnabled={session.chatEnabled}
            isCreator={isCreator}
            isActiveParticipant={isActiveParticipant}
            currentOdonym={currentOdonym}
          />
        )}
      </Page>
    );
  }

  return null;
}
