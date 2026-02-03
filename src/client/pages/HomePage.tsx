import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { useActiveSession } from '@/client/hooks/useActiveSession';
import { cn } from '@/client/lib/utils';

type FocusSession = {
  _id: string;
  intent: string;
  topic: string;
  minDuration: number;
  maxDuration: number;
  status: 'waiting' | 'warmup' | 'focusing';
  participantCount: number;
  createdAt: string;
  scheduledStartAt?: string;
  startedAt?: string;
  matchingTags: string[];
  isParticipant: boolean;
  isActiveParticipant: boolean;
  isCreator: boolean;
  chatEnabled: boolean;
  creatorName?: string;
  isPrivate: boolean;
};

function StatusIndicator({ status }: { status: string }) {
  const config = {
    waiting: { label: 'Waiting', className: 'text-white/50' },
    warmup: { label: 'Starting', className: 'text-amber-300/80' },
    focusing: { label: 'Live', className: 'text-emerald-300/80' },
  }[status] || { label: status, className: 'text-white/50' };

  return (
    <span className={cn("text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}

function SessionSkeleton() {
  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="skeleton bg-white/10 h-5 w-32" />
          <div className="skeleton bg-white/10 h-4 w-full max-w-xs" />
          <div className="flex gap-2">
            <div className="skeleton bg-white/10 h-5 w-16 rounded-full" />
            <div className="skeleton bg-white/10 h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="skeleton bg-white/10 h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 fade-in">
      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-display-sm text-white mb-2">No sessions yet</h3>
      <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto">
        Be the first to start a focus session.
      </p>
      <Link to="/create-session" className="btn-light">
        Start a Session
      </Link>
    </div>
  );
}

function SessionRow({ session, formatDuration, hasActiveSession }: { session: FocusSession; formatDuration: (min: number, max: number) => string; hasActiveSession: boolean }) {
  const canRejoin = session.isParticipant && !session.isActiveParticipant;

  const handleJoinAttempt = useCallback((e: React.MouseEvent) => {
    if (hasActiveSession) {
      e.preventDefault();
      toast.error('Please finish or leave your current session first');
    }
  }, [hasActiveSession]);

  return (
    <div className="py-4 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-white truncate">{session.topic}</span>
            <StatusIndicator status={session.status} />
            {session.isActiveParticipant && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70">Joined</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span>{formatDuration(session.minDuration, session.maxDuration)}</span>
            <span className="text-white/20">·</span>
            <span>{session.participantCount} {session.participantCount === 1 ? 'person' : 'people'}</span>
            {session.creatorName && !session.isCreator && (
              <>
                <span className="text-white/20">·</span>
                <span>@{session.creatorName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          {session.isActiveParticipant ? (
            <Link to={`/focus/${session._id}`} className="btn-light text-sm px-3 py-1.5">Continue</Link>
          ) : canRejoin ? (
            <Link to={`/focus/${session._id}`} className="btn-light text-sm px-3 py-1.5">Rejoin</Link>
          ) : session.status === 'focusing' ? (
            <span className="text-xs text-white/30">In Progress</span>
          ) : (
            <Link
              to={`/focus/${session._id}`}
              className={cn(
                "btn-outline-light text-sm px-3 py-1.5",
                hasActiveSession && "opacity-50 cursor-not-allowed"
              )}
              onClick={handleJoinAttempt}
            >
              Join
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { hasActiveSession } = useActiveSession();

  // Fetch active public sessions
  const { data: activeSessions, isLoading: sessionsLoading } = useQuery({
    ...modelenceQuery<FocusSession[]>('focus.getActiveSessions', {}),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const formatDuration = useCallback((min: number, max: number) => {
    if (min === max) return `${min} min`;
    return `${min}-${max} min`;
  }, []);

  // Filter to only show public sessions
  const publicSessions = activeSessions?.filter(s => !s.isPrivate) || [];

  return (
    <Page variant="dark">
      <div className="container-lg">
        {/* Live Sessions */}
        <section className="fade-in pt-6">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-display-sm text-white">Focus Together</h1>
            <span className="text-xs text-white/30">{publicSessions.length} active</span>
          </div>

          {sessionsLoading ? (
            <div className="divide-y divide-white/5">
              <SessionSkeleton />
              <SessionSkeleton />
            </div>
          ) : publicSessions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-white/5">
              {publicSessions.map((session) => (
                <SessionRow key={session._id} session={session} formatDuration={formatDuration} hasActiveSession={hasActiveSession} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
