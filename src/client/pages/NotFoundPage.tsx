import { Link } from 'react-router-dom';
import Page from '@/client/components/Page';

export default function NotFoundPage() {
  return (
    <Page variant="dark">
      <div className="container-xs flex items-center justify-center min-h-[70vh]">
        <div className="card-dark p-8 w-full text-center fade-in">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-bold text-white/40 display-number">404</span>
          </div>
          <h1 className="text-display-sm text-white mb-2">Page not found</h1>
          <p className="text-white/50 text-sm mb-8">
            We couldn't find the page you're looking for. It might have moved or doesn't exist.
          </p>
          <Link to="/" className="btn-light inline-block">
            Back to home
          </Link>
        </div>
      </div>
    </Page>
  );
}
