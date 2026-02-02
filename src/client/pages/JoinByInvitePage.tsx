import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery } from '@modelence/react-query';
import Page from '@/client/components/Page';
import JoinSessionSkeleton from '@/client/components/skeletons/JoinSessionSkeleton';

type InviteSession = {
  sessionId: string;
  topic: string;
  intent: string;
  status: string;
  participantCount: number;
  isPrivate: boolean;
  hasAcceptedInvite: boolean;
  isCreator: boolean;
  creatorName?: string;
  minDuration: number;
  maxDuration: number;
};

export default function JoinByInvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useSession();

  const { data: session, isLoading, error } = useQuery({
    ...modelenceQuery<InviteSession>('focus.getSessionByInvite', { inviteCode }),
    enabled: !!inviteCode,
    retry: false,
  });

  // Redirect logic
  useEffect(() => {
    if (!session) return;

    // For private sessions that haven't been accepted, redirect to accept page
    if (session.isPrivate && !session.isCreator && !session.hasAcceptedInvite) {
      navigate(`/invite/${inviteCode}`, { replace: true });
      return;
    }

    // Otherwise, redirect directly to the session room
    navigate(`/focus/${session.sessionId}`, { replace: true });
  }, [session, navigate, inviteCode]);

  if (isLoading) {
    return (
      <Page variant="dark" hideNav>
        <JoinSessionSkeleton />
      </Page>
    );
  }

  if (error || !session) {
    return (
      <Page variant="dark">
        <div className="container-sm flex items-center justify-center min-h-[70vh]">
          <div className="card-dark p-8 text-center fade-in w-full">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Hmm, that link doesn't work</h2>
            <p className="text-white/50 text-sm mb-6">
              {(error as Error)?.message || 'This invite might have expired, or the session has already ended.'}
            </p>
            <Link to="/" className="btn-light inline-block">
              Browse active sessions
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  // Show preview while redirecting (user not logged in case)
  if (!user) {
    // For private sessions, redirect to accept page for sign in
    const redirectPath = session.isPrivate 
      ? `/invite/${inviteCode}` 
      : `/join/${inviteCode}`;

    return (
      <Page variant="dark">
        <div className="container-sm flex items-center justify-center min-h-[70vh]">
          <div className="card-dark p-8 text-center fade-in w-full">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            {session.isPrivate && (
              <span className="chip bg-white/10 text-white/70 mb-3 inline-block">Private Session</span>
            )}
            <h2 className="text-display-sm text-white mb-2">You're invited to focus!</h2>
            {session.creatorName && (
              <p className="text-white/60 text-sm mb-1">
                Invited by <span className="font-medium text-white/80">{session.creatorName}</span>
              </p>
            )}
            <p className="text-white/60 mb-1">{session.topic}</p>
            <p className="text-white/40 text-sm mb-6">{session.participantCount} {session.participantCount === 1 ? 'person' : 'people'} waiting to start</p>
            <p className="text-white/50 text-sm mb-6">
              {session.isPrivate 
                ? 'Sign in to accept the invitation and join this private session.'
                : 'Sign in to join the session and start focusing together.'}
            </p>
            <Link
              to={`/login?_redirect=${encodeURIComponent(redirectPath)}`}
              className="btn-light inline-block"
            >
              {session.isPrivate ? 'Sign in to accept' : 'Sign in to join'}
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  // Redirecting...
  return (
    <Page variant="dark" hideNav>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center fade-in">
          <div className="spinner-lg mx-auto mb-4" />
          <span className="text-white/50 text-sm">
            {session.isPrivate && !session.hasAcceptedInvite && !session.isCreator 
              ? 'Redirecting to accept invitation...' 
              : 'Joining your session...'}
          </span>
        </div>
      </div>
    </Page>
  );
}
