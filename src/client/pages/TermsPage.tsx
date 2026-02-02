import Page from '@/client/components/Page';

export default function TermsPage() {
  return (
    <Page variant="dark">
      <div className="container-sm fade-in">
        <div className="py-8">
          <h1 className="text-display-md text-white mb-6">Terms of Service</h1>

          <div className="space-y-6 text-white/70">
            <p className="text-white/60">
              Welcome! By using Focus, you're agreeing to these simple terms. We've tried to keep them straightforward and fair.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">1. Using Focus</h2>
              <p>
                Focus is designed to help you work better alongside others. Please use it for its intended purpose—productive focus sessions—and be respectful to fellow users.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">2. Your Privacy</h2>
              <p>
                We take privacy seriously. Your focus sessions are private and ephemeral—we don't store your session notes or detailed activity. We only keep anonymized summaries to help improve your experience and show you relevant stats.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">3. Your Data</h2>
              <p>
                You own your data. You can view, export, or delete your focus history at any time from your profile settings. We only retain data you've chosen to keep.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">4. Community Guidelines</h2>
              <p>
                Be kind, be focused, be respectful. Don't disrupt others' focus sessions or use the platform for anything harmful. We're all here to help each other do better work.
              </p>
            </section>

            <p className="text-sm text-white/40 pt-4 border-t border-white/10">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
