import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery } from '@modelence/react-query';
import Page from '@/client/components/Page';

type InviteSession = {
  sessionId: string;
  topic: string;
  intent: string;
  status: string;
  participantCount: number;
  isPrivate: boolean;
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

  // Redirect to the session room once loaded
  useEffect(() => {
    if (session?.sessionId) {
      navigate(`/focus/${session.sessionId}`, { replace: true });
    }
  }, [session, navigate]);

  if (isLoading) {
    return (
      <Page variant="dark" hideNav>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center fade-in">
            <div className="spinner-lg mx-auto mb-4" />
            <span className="text-white/50 text-sm">Loading invite...</span>
          </div>
        </div>
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
            <h2 className="text-display-sm text-white mb-2">Invalid Invite Link</h2>
            <p className="text-white/50 text-sm mb-6">
              {(error as Error)?.message || 'This invite link may be invalid or the session has ended.'}
            </p>
            <Link to="/" className="btn-light inline-block">
              Browse Sessions
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  // Show preview while redirecting (user not logged in case)
  if (!user) {
    return (
      <Page variant="dark">
        <div className="container-sm flex items-center justify-center min-h-[70vh]">
          <div className="card-dark p-8 text-center fade-in w-full">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">You're Invited!</h2>
            <p className="text-white/60 mb-1">{session.topic}</p>
            <p className="text-white/40 text-sm mb-6">{session.participantCount} participant{session.participantCount !== 1 ? 's' : ''} waiting</p>
            <p className="text-white/50 text-sm mb-6">
              Sign in to join this focus session.
            </p>
            <Link
              to={`/login?_redirect=${encodeURIComponent(`/join/${inviteCode}`)}`}
              className="btn-light inline-block"
            >
              Sign In to Join
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
          <span className="text-white/50 text-sm">Joining session...</span>
        </div>
      </div>
    </Page>
  );
}
