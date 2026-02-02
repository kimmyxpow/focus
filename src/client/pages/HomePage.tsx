import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { useActiveSession } from '@/client/hooks/useActiveSession';
import Tooltip from '@/client/components/ui/Tooltip';
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

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.16V8.25c0 1.092-.807 2.032-1.907 2.16-.639.074-1.281.135-1.927.184m0-12.896c-.646.049-1.288.11-1.927.184-1.1.128-1.907 1.077-1.907 2.16V8.25c0 1.092.807 2.032 1.907 2.16.639.074 1.281.135 1.927.184m7.332 12.896A2.25 2.25 0 0113.5 18.25h-3c-1.03 0-1.9-.693-2.166-1.638m7.332 0c.055-.194.084-.4.084-.612v0a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75v0c0 .212.03.418.084.612m7.332 0c.646-.049 1.288-.11 1.927-.184 1.1-.128 1.907-1.077 1.907-2.16v-3.428c0-1.092-.807-2.032-1.907-2.16-.639-.074-1.281-.135-1.927-.184" />
    </svg>
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
        Be the first to start a focus session. Deep work is better together.
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

  const handleCopyLink = useCallback(() => {
    const sessionUrl = `${window.location.origin}/focus/${session._id}`;
    navigator.clipboard.writeText(sessionUrl);
    toast.success('Link copied to clipboard');
  }, [session._id]);

  return (
    <div className="py-5 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-semibold text-white truncate">{session.topic}</span>
            <StatusIndicator status={session.status} />
            {session.isCreator && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/20 text-white">Your Session</span>
            )}
            {session.isActiveParticipant && !session.isCreator && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70">Joined</span>
            )}
            {session.chatEnabled && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                Chat
              </span>
            )}
          </div>
          <p className="text-sm text-white/50 truncate-2 mb-3">{session.intent}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/40">
            {session.creatorName && !session.isCreator && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                @{session.creatorName}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(session.minDuration, session.maxDuration)}
            </span>
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              {session.participantCount} {session.participantCount === 1 ? 'person' : 'people'}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <Tooltip label="Copy session link">
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <CopyIcon />
            </button>
          </Tooltip>
          {session.isActiveParticipant ? (
            <Link to={`/focus/${session._id}`} className="btn-light">Continue</Link>
          ) : canRejoin ? (
            <Link to={`/focus/${session._id}`} className="btn-light">Rejoin</Link>
          ) : session.status === 'focusing' ? (
            <span className="btn-outline-light opacity-50 cursor-not-allowed">In Progress</span>
          ) : (
            <Link
              to={`/focus/${session._id}`}
              className={cn(
                "btn-outline-light",
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
  const { user } = useSession();
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
        {/* Hero Section */}
        <section className="text-center py-10 fade-in">
          <h1 className="text-display-lg text-white mb-3">
            Focus Together
          </h1>
          <p className="text-white/60 max-w-md mx-auto mb-6">
            Work alongside others in focused sessions. No endless chatting, no notifications. Just you, your goals, and a supportive community.
          </p>
          {!user ? (
            <Link to="/login" className="btn-light">
              Get Started
            </Link>
          ) : (
            <Link to="/create-session" className="btn-light">
              Start a Session
            </Link>
          )}
        </section>

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Live Sessions */}
        <section className="fade-in">
          <div className="flex items-center justify-between py-4">
            <h2 className="text-label text-white/40">Public Sessions</h2>
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

        {/* Features */}
        <section className="mt-12 pt-10 border-t border-white/10">
          <div className="grid gap-8 sm:grid-cols-3 text-center">
            {[
              {
                id: 'privacy',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
                title: "Privacy First",
                description: "Anonymous by default. You decide what to share."
              },
              {
                id: 'distraction-free',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ),
                title: "Distraction-Free",
                description: "Just a timer and the presence of others working."
              },
              {
                id: 'smart-matching',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                ),
                title: "Smart Matching",
                description: "AI connects you with similar focus partners."
              }
            ].map((feature, i) => (
              <div key={feature.id} className="fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-white/50">{feature.icon}</span>
                </div>
                <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-white/50">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
