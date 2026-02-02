import Page from '@/client/components/Page';

export default function TermsPage() {
  return (
    <Page variant="dark">
      <div className="container-sm fade-in">
        <div className="card-dark p-8">
          <h1 className="text-display-md text-white mb-6">Terms and Conditions</h1>

          <div className="space-y-6 text-white/70">
            <p>
              By using this service, you agree to the following terms and conditions.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing and using this application, you accept and agree to be bound by the terms and conditions outlined here.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">2. Use of Service</h2>
              <p>
                You agree to use the service only for lawful purposes and in accordance with these terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">3. Privacy</h2>
              <p>
                Focus sessions are ephemeral. Only aggregated focus data is stored. Your session details and intents are not permanently stored after completion.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-white">4. User Conduct</h2>
              <p>
                You agree to use this service respectfully and not engage in any behavior that disrupts the focus experience of other users.
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
