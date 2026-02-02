import { useEffect } from 'react';
import { logout } from 'modelence/client';
import Page from '@/client/components/Page';

export default function LogoutPage() {
  useEffect(() => {
    logout().then(() => {
      window.location.href = '/';
    });
  }, []);

  return (
    <Page variant="dark" hideNav>
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">Signing out...</p>
        </div>
      </div>
    </Page>
  );
}
