import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
