import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery, modelenceMutation, createQueryKey } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import ChatPanel from '@/client/components/ChatPanel';
import { cn } from '@/client/lib/utils';

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
  status: 'waiting' | 'warmup' | 'focusing' | 'break' | 'cooldown' | 'completed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  warmupPrompt?: string;
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
  { key: 'focus' as const, label: 'Deep Focus', icon: '●' },
  { key: 'energy' as const, label: 'Energized', icon: '◆' },
  { key: 'break' as const, label: 'Need Break', icon: '○' },
];

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className="tooltip">{label}</span>
    </span>
  );
}

function CircularProgress({ progress, size = 280, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
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
        {reaction ? reaction.icon : participant.odonym.charAt(0).toUpperCase()}
      </div>
      <span className="text-xs text-white/50">
        {isCurrentUser ? 'You' : participant.odonym.slice(0, 8)}
      </span>
    </div>
  );
}

function CopyInviteButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const inviteUrl = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success('Invite link copied!');
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  return (
    <button
      onClick={handleCopy}
      className="btn-outline-light text-sm flex items-center gap-2"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

  const [localRemainingSeconds, setLocalRemainingSeconds] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const timerSyncRef = useRef<number>(0);

  const { data: session, isLoading, error } = useQuery({
    ...modelenceQuery<SessionData>('focus.getSession', { sessionId }),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'focusing') return 5000;
      if (data?.status === 'waiting' || data?.status === 'warmup') return 3000;
      return 10000;
    },
  });

  const { mutate: joinSession, isPending: isJoining } = useMutation({
    ...modelenceMutation<{ odonym: string; rejoined: boolean }>('focus.joinSession'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) });
      toast.success(data.rejoined ? 'Welcome back!' : 'Joined session!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: startWarmup, isPending: isStartingWarmup } = useMutation({
    ...modelenceMutation('focus.startWarmup'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) }),
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: skipWarmup, isPending: isSkippingWarmup } = useMutation({
    ...modelenceMutation('focus.skipWarmup'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: createQueryKey('focus.getSession', { sessionId }) }),
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
            <span className="text-white/50 text-sm">Loading session...</span>
          </div>
        </div>
      </Page>
    );
  }

  if (error || !session) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="card-dark p-8 text-center fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Session Not Found</h2>
            <p className="text-white/50 text-sm mb-6">This session may have ended or doesn't exist.</p>
            <Link to="/" className="btn-light inline-block">
              Back to Sessions
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
          <div className="card-dark p-8 text-center fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Session Complete</h2>
            <p className="text-white/50 text-sm mb-6">This focus session has been completed.</p>
            <Link to={`/focus/${sessionId}/summary`} className="btn-light inline-block">
              View Summary
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  // Waiting state - DARK THEME
  if (session.status === 'waiting') {
    return (
      <Page variant="dark">
        <div className="container-md">
          <div className="card-dark p-6 fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="chip bg-white/10 text-white/70">Waiting to Start</span>
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
            {session.inviteCode && (isCreator || isActiveParticipant) && (
              <div className="mb-6 p-4 bg-white/5 rounded-lg flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Invite others</p>
                  <p className="text-xs text-white/40 truncate">Share this link with friends</p>
                </div>
                <CopyInviteButton inviteCode={session.inviteCode} />
              </div>
            )}

            <div className="space-y-3">
              {canRejoin ? (
                <button
                  className="btn-light w-full"
                  onClick={() => joinSession({ sessionId })}
                  disabled={isJoining}
                >
                  {isJoining ? 'Rejoining...' : 'Rejoin Session'}
                </button>
              ) : !isActiveParticipant && !isParticipant ? (
                <button
                  className="btn-light w-full"
                  onClick={() => joinSession({ sessionId })}
                  disabled={isJoining || !user}
                >
                  {!user ? 'Sign in to Join' : isJoining ? 'Joining...' : 'Join Session'}
                </button>
              ) : isCreator ? (
                <>
                  <button
                    className="btn-light w-full"
                    onClick={() => startWarmup({ sessionId })}
                    disabled={isStartingWarmup || isSkippingWarmup}
                  >
                    {isStartingWarmup ? 'Starting...' : 'Begin Warmup'}
                  </button>
                  <button
                    className="btn-outline-light w-full"
                    onClick={() => skipWarmup({ sessionId })}
                    disabled={isSkippingWarmup || isStartingWarmup}
                  >
                    Skip Warmup & Start
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-white/40">
                    <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                    <span>Waiting for the session to start...</span>
                  </div>
                </div>
              )}

              <button
                className="btn-ghost-light w-full"
                onClick={() => isActiveParticipant ? leaveSession({ sessionId }) : navigate('/')}
                disabled={isLeaving}
              >
                {isActiveParticipant ? 'Leave Session' : 'Back'}
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
          />
        )}
      </Page>
    );
  }

  // Warmup state
  if (session.status === 'warmup') {
    return (
      <Page variant="dark" hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="container-md text-center space-y-8 fade-in">
            <div>
              <span className="chip bg-white/10 text-white/70 mb-3 inline-block">Warmup</span>
              <h1 className="text-display-md text-white mb-2">{session.topic}</h1>
              <p className="text-white/60">{session.intent}</p>
            </div>

            {session.warmupPrompt && (
              <div className="card-dark p-6 text-left">
                <p className="text-lg text-white/90 leading-relaxed italic">
                  "{session.warmupPrompt}"
                </p>
                <p className="text-xs text-white/40 mt-4">AI-generated warmup prompt</p>
              </div>
            )}

            <div className="flex justify-center gap-4">
              {session.participants.map((p) => (
                <ParticipantAvatar
                  key={p.odonym}
                  participant={p}
                  isCurrentUser={p.odonym === currentOdonym}
                />
              ))}
            </div>

            {isCreator ? (
              <button
                className="btn-light"
                onClick={() => startSession({ sessionId })}
                disabled={isStarting}
              >
                {isStarting ? 'Starting...' : 'Start Focus Session'}
              </button>
            ) : (
              <p className="text-white/40">Preparing to focus...</p>
            )}
          </div>
        </div>

        {/* Chat Panel for warmup state */}
        {sessionId && (
          <ChatPanel
            sessionId={sessionId}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
            chatEnabled={session.chatEnabled}
            isCreator={isCreator}
            isActiveParticipant={isActiveParticipant}
          />
        )}
      </Page>
    );
  }

  // Focusing state
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
                <span className="text-sm text-white/50">In Focus</span>
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
                  className="btn-light"
                  onClick={() => joinSession({ sessionId })}
                  disabled={isJoining}
                >
                  {isJoining ? 'Rejoining...' : 'Rejoin Session'}
                </button>
              </div>
            ) : isActiveParticipant ? (
              <>
                <div className="flex justify-center gap-2">
                  {REACTIONS.map((reaction) => (
                    <Tooltip key={reaction.key} label={reaction.label}>
                      <button
                        onClick={() => sendReaction({ sessionId, reaction: reaction.key })}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm border border-white/10 focus-ring"
                      >
                        {reaction.icon}
                      </button>
                    </Tooltip>
                  ))}
                </div>

                <div className="flex justify-center gap-3 pt-4">
                  {isCreator && (
                    <button
                      className="btn-outline-light"
                      onClick={() => endSession({ sessionId })}
                      disabled={isEnding}
                    >
                      {isEnding ? 'Ending...' : 'End Early'}
                    </button>
                  )}
                  <button
                    className="btn-ghost-light"
                    onClick={() => leaveSession({ sessionId })}
                    disabled={isLeaving}
                  >
                    {isLeaving ? 'Leaving...' : 'Leave'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-white/50 mb-4">Session in progress</p>
                <button
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
          />
        )}
      </Page>
    );
  }

  // Cooldown state
  if (session.status === 'cooldown') {
    return (
      <Page variant="dark" hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="container-md text-center space-y-8 fade-in">
            <div>
              <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="chip bg-emerald-500/20 text-emerald-400 mb-3 inline-block">Session Complete</span>
              <h1 className="text-display-md text-white">{session.topic}</h1>
            </div>

            {session.cooldownPrompt && (
              <div className="card-dark p-6">
                <p className="text-lg text-white/90 leading-relaxed italic">
                  "{session.cooldownPrompt}"
                </p>
                <p className="text-xs text-white/40 mt-4">Take a moment to reflect</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
              <div className="card-dark p-4 text-center">
                <span className="text-3xl font-semibold display-number text-white">
                  {session.actualDuration || session.maxDuration}
                </span>
                <span className="block text-xs text-white/40 mt-1">minutes</span>
              </div>
              <div className="card-dark p-4 text-center">
                <span className="text-3xl font-semibold display-number text-white">
                  {session.participantCount}
                </span>
                <span className="block text-xs text-white/40 mt-1">participants</span>
              </div>
            </div>

            {isCreator ? (
              <button
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
          />
        )}
      </Page>
    );
  }

  return null;
}
