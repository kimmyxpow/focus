import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouteObject, useLocation, useSearchParams } from 'react-router-dom';
import { useSession } from 'modelence/client';

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

const publicRoutes: RouteObject[] = [
  {
    path: '/',
    Component: lazy(() => import('./pages/home-page'))
  },
  {
    path: '/sessions',
    Component: lazy(() => import('./pages/sessions-page'))
  },
  {
    path: '/focus/:sessionId',
    Component: lazy(() => import('./pages/focus-room-page'))
  },
  {
    path: '/join/:inviteCode',
    Component: lazy(() => import('./pages/join-by-invite-page'))
  },
  {
    path: '/invite/:inviteCode',
    Component: lazy(() => import('./pages/accept-invite-page'))
  },
  {
    path: '/leaderboard',
    Component: lazy(() => import('./pages/leaderboard-page'))
  },
  {
    path: '/flashcards',
    Component: lazy(() => import('./pages/public-flashcards-page'))
  },
  {
    path: '/flashcards/:setId/study',
    Component: lazy(() => import('./pages/flashcard-study-page'))
  },
  {
    path: '/quiz',
    Component: lazy(() => import('./pages/quiz-list-page'))
  },
  {
    path: '/quiz/:quizId',
    Component: lazy(() => import('./pages/take-quiz-page'))
  },
  {
    path: '/terms',
    Component: lazy(() => import('./pages/terms-page'))
  },
  {
    path: '/logout',
    Component: lazy(() => import('./pages/logout-page'))
  },
  {
    path: '*',
    Component: lazy(() => import('./pages/not-found-page'))
  }
];

const guestRoutes: RouteObject[] = [
  {
    path: '/login',
    Component: lazy(() => import('./pages/login-page'))
  },
  {
    path: '/signup',
    Component: lazy(() => import('./pages/signup-page'))
  }
];

const privateRoutes: RouteObject[] = [
  {
    path: '/create-session',
    Component: lazy(() => import('./pages/create-session-page'))
  },
  {
    path: '/focus/:sessionId/summary',
    Component: lazy(() => import('./pages/session-summary-page'))
  },
  {
    path: '/my-sessions',
    Component: lazy(() => import('./pages/focus-overview-page'))
  },
  {
    path: '/profile',
    Component: lazy(() => import('./pages/profile-page'))
  },
  {
    path: '/my-flashcards',
    Component: lazy(() => import('./pages/flashcards-page'))
  },
  {
    path: '/create-flashcard',
    Component: lazy(() => import('./pages/create-flashcard-page'))
  },
  {
    path: '/my-quizzes',
    Component: lazy(() => import('./pages/my-quizzes-page'))
  },
  {
    path: '/create-quiz',
    Component: lazy(() => import('./pages/create-quiz-page'))
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
