import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceQuery, modelenceMutation } from '@modelence/react-query';
import toast from 'react-hot-toast';
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

export default function AcceptInvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useSession();

  const { data: session, isLoading, error } = useQuery({
    ...modelenceQuery<InviteSession>('focus.getSessionByInvite', { inviteCode }),
    enabled: !!inviteCode,
    retry: false,
  });

  const { mutate: acceptInvite, isPending: isAccepting } = useMutation({
    ...modelenceMutation<{ success: boolean; sessionId: string; alreadyAccepted: boolean }>('focus.acceptPrivateInvite'),
    onSuccess: (data) => {
      if (data.alreadyAccepted) {
        navigate(`/focus/${data.sessionId}`, { replace: true });
      } else {
        toast.success('Invitation accepted!');
        navigate(`/focus/${data.sessionId}`, { replace: true });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // If user is creator or already accepted, redirect directly to session
  useEffect(() => {
    if (session && user) {
      if (session.isCreator || session.hasAcceptedInvite) {
        navigate(`/focus/${session.sessionId}`, { replace: true });
      }
      // For public sessions, redirect directly
      if (!session.isPrivate) {
        navigate(`/focus/${session.sessionId}`, { replace: true });
      }
    }
  }, [session, user, navigate]);

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

  // User is not logged in - show sign-in prompt
  if (!user) {
    return (
      <Page variant="dark">
        <div className="container-sm flex items-center justify-center min-h-[70vh]">
          <div className="card-dark p-8 text-center fade-in w-full">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="chip bg-white/10 text-white/70 mb-3 inline-block">Private Session</span>
            <h2 className="text-display-sm text-white mb-2">You're invited to focus!</h2>
            {session.creatorName && (
              <p className="text-white/60 text-sm mb-1">
                Invited by <span className="font-medium text-white/80">{session.creatorName}</span>
              </p>
            )}
            <p className="text-white/60 mb-1">{session.topic}</p>
            <p className="text-white/40 text-sm mb-2">{session.intent}</p>
            <div className="flex items-center justify-center gap-3 text-white/40 text-sm mb-6">
              <span>{session.minDuration === session.maxDuration ? session.minDuration : `${session.minDuration}-${session.maxDuration}`} min</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>{session.participantCount} {session.participantCount === 1 ? 'person' : 'people'} waiting</span>
            </div>
            <p className="text-white/50 text-sm mb-6">
              Sign in to accept the invitation and join this private session.
            </p>
            <Link
              to={`/login?_redirect=${encodeURIComponent(`/invite/${inviteCode}`)}`}
              className="btn-light inline-block"
            >
              Sign in to accept
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  // User is logged in - show acceptance page
  return (
    <Page variant="dark">
      <div className="container-sm flex items-center justify-center min-h-[70vh]">
        <div className="card-dark p-8 text-center fade-in w-full">
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <span className="chip bg-white/10 text-white/70 mb-3 inline-block">Private Session</span>
          <h2 className="text-display-sm text-white mb-2">You're invited to focus!</h2>
          {session.creatorName && (
            <p className="text-white/60 text-sm mb-1">
              Invited by <span className="font-medium text-white/80">{session.creatorName}</span>
            </p>
          )}
          <p className="text-white/60 mb-1 text-lg font-medium">{session.topic}</p>
          <p className="text-white/40 text-sm mb-2">{session.intent}</p>
          
          <div className="flex items-center justify-center gap-3 text-white/40 text-sm mb-6">
            <span>{session.minDuration === session.maxDuration ? session.minDuration : `${session.minDuration}-${session.maxDuration}`} min</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>{session.participantCount} {session.participantCount === 1 ? 'person' : 'people'} waiting</span>
          </div>

          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <p className="text-white/50 text-sm">
              By accepting this invitation, you'll be able to join this private focus session. 
              Only people with the invite link can see and join this session.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => acceptInvite({ inviteCode })}
              disabled={isAccepting}
              className="btn-light w-full"
            >
              {isAccepting ? (
                <>
                  <span className="spinner-sm mr-2" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </button>
            <Link to="/" className="btn-ghost-light w-full block">
              Maybe later
            </Link>
          </div>
        </div>
      </div>
    </Page>
  );
}
