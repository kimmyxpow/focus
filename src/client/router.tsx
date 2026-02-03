import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouteObject, useLocation, useSearchParams } from 'react-router-dom';
import { useSession } from 'modelence/client';

// For guest-only routes (login, signup) - redirects to home if already logged in
function GuestRoute() {
  const { user } = useSession();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const encodedRedirect = searchParams.get('_redirect');
  const redirect = encodedRedirect ? decodeURIComponent(encodedRedirect) : '/';

  if (user) {
    return <Navigate to={redirect} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// For protected routes - redirects to login if not authenticated
function PrivateRoute() {
  const { user } = useSession();
  const location = useLocation();

  if (!user) {
    const fullPath = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?_redirect=${encodeURIComponent(fullPath)}`}
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
}

// Public routes (no auth required)
const publicRoutes: RouteObject[] = [
  {
    path: '/',
    Component: lazy(() => import('./pages/HomePage'))
  },
  {
    path: '/sessions',
    Component: lazy(() => import('./pages/SessionsPage'))
  },
  {
    path: '/focus/:sessionId',
    Component: lazy(() => import('./pages/FocusRoomPage'))
  },
  {
    path: '/join/:inviteCode',
    Component: lazy(() => import('./pages/JoinByInvitePage'))
  },
  {
    path: '/invite/:inviteCode',
    Component: lazy(() => import('./pages/AcceptInvitePage'))
  },
  {
    path: '/leaderboard',
    Component: lazy(() => import('./pages/LeaderboardPage'))
  },
  {
    path: '/flashcards',
    Component: lazy(() => import('./pages/PublicFlashcardsPage'))
  },
  {
    path: '/flashcards/:setId/study',
    Component: lazy(() => import('./pages/FlashcardStudyPage'))
  },
  {
    path: '/quiz',
    Component: lazy(() => import('./pages/QuizListPage'))
  },
  {
    path: '/quiz/:quizId',
    Component: lazy(() => import('./pages/TakeQuizPage'))
  },
  {
    path: '/terms',
    Component: lazy(() => import('./pages/TermsPage'))
  },
  {
    path: '/logout',
    Component: lazy(() => import('./pages/LogoutPage'))
  },
  {
    path: '*',
    Component: lazy(() => import('./pages/NotFoundPage'))
  }
];

// Guest routes (redirect to home if already logged in)
const guestRoutes: RouteObject[] = [
  {
    path: '/login',
    Component: lazy(() => import('./pages/LoginPage'))
  },
  {
    path: '/signup',
    Component: lazy(() => import('./pages/SignupPage'))
  }
];

// Private routes (redirect to login if not authenticated)
const privateRoutes: RouteObject[] = [
  {
    path: '/create-session',
    Component: lazy(() => import('./pages/CreateSessionPage'))
  },
  {
    path: '/focus/:sessionId/summary',
    Component: lazy(() => import('./pages/SessionSummaryPage'))
  },
  {
    path: '/my-sessions',
    Component: lazy(() => import('./pages/FocusOverviewPage'))
  },
  {
    path: '/profile',
    Component: lazy(() => import('./pages/ProfilePage'))
  },
  {
    path: '/my-flashcards',
    Component: lazy(() => import('./pages/FlashcardsPage'))
  },
  {
    path: '/create-flashcard',
    Component: lazy(() => import('./pages/CreateFlashcardPage'))
  },
  {
    path: '/my-quizzes',
    Component: lazy(() => import('./pages/MyQuizzesPage'))
  },
  {
    path: '/create-quiz',
    Component: lazy(() => import('./pages/CreateQuizPage'))
  }
];

export const router = createBrowserRouter([
  ...publicRoutes,
  {
    Component: GuestRoute,
    children: guestRoutes
  },
  {
    Component: PrivateRoute,
    children: privateRoutes
  }
]);
