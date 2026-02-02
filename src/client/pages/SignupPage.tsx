import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// With passwordless OAuth, signup and login are the same flow
// Redirect to login page
export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('_redirect');

  useEffect(() => {
    const loginUrl = redirect ? `/login?_redirect=${encodeURIComponent(redirect)}` : '/login';
    navigate(loginUrl, { replace: true });
  }, [navigate, redirect]);

  return null;
}
