import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery } from '@modelence/react-query';
import Page from '@/client/components/Page';
import { cn } from '@/client/lib/utils';

type UserSession = {
  _id: string;
  intent: string;
  topic: string;
  duration: number;
  status: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  participantCount: number;
  isCreator: boolean;
  isActiveParticipant: boolean;
};

function SetSkeleton() {
  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="skeleton bg-white/10 h-5 w-48" />
          <div className="skeleton bg-white/10 h-4 w-full max-w-sm" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton bg-white/10 h-9 w-20 rounded-lg" />
        </div>
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
        Start your first focus session and track your productivity journey.
      </p>
      <Link to="/create-session" className="btn-light">
        Create Session
      </Link>
    </div>
  );
}

function SessionRow({ session }: { session: UserSession }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    waiting: { label: 'Waiting', className: 'bg-white/10 text-white/70' },
    warmup: { label: 'Starting', className: 'bg-white/10 text-white/70' },
    focusing: { label: 'Live', className: 'bg-green-500/20 text-green-300' },
    cooldown: { label: 'Ending', className: 'bg-white/10 text-white/70' },
    completed: { label: 'Completed', className: 'bg-white/5 text-white/50' },
    cancelled: { label: 'Cancelled', className: 'bg-white/5 text-white/40' },
  };

  const status = statusConfig[session.status] || { label: session.status, className: 'bg-white/10 text-white/70' };
  const isActive = ['waiting', 'warmup', 'focusing', 'cooldown'].includes(session.status);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="py-4 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-white truncate">{session.topic}</span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", status.className)}>
              {status.label}
            </span>
            {session.isCreator && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/60">
                Creator
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span>{session.duration} min</span>
            <span className="text-white/20">·</span>
            <span>{session.participantCount} participant{session.participantCount !== 1 ? 's' : ''}</span>
            <span className="text-white/20">·</span>
            <span>{formatDate(session.createdAt)}</span>
          </div>
        </div>
        
        <div className="flex-shrink-0 flex items-center gap-2">
          {isActive ? (
            <Link 
              to={`/focus/${session._id}`} 
              className="btn-light text-sm px-3 py-1.5"
            >
              {session.isActiveParticipant ? 'Continue' : 'Rejoin'}
            </Link>
          ) : session.status === 'completed' ? (
            <Link 
              to={`/focus/${session._id}/summary`} 
              className="btn-outline-light text-sm px-3 py-1.5"
            >
              Summary
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function FocusOverviewPage() {
  const { user } = useSession();

  const { data: sessions = [], isLoading } = useQuery({
    ...modelenceQuery<UserSession[]>('focus.getUserSessions', {}),
    enabled: !!user,
  });

  if (!user) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-12 fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Welcome back!</h2>
            <p className="text-white/50 text-sm mb-6">
              Sign in to see your personal focus journey and track your progress over time.
            </p>
            <Link to={`/login?_redirect=${encodeURIComponent('/my-sessions')}`} className="btn-light">
              Sign In
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page variant="dark">
      <div className="container-lg">
        <section className="fade-in pt-6">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-display-sm text-white">My Sessions</h1>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">{sessions.length} sessions</span>
              <Link to="/sessions" className="btn-outline-light text-sm px-3 py-1.5">
                Browse Public
              </Link>
              <Link to="/create-session" className="btn-light text-sm px-3 py-1.5">
                Create Session
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-white/5">
              <SetSkeleton />
              <SetSkeleton />
              <SetSkeleton />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-white/5">
              {sessions.map((session) => (
                <SessionRow key={session._id} session={session} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
