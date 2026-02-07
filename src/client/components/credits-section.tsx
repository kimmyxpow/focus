import { getCredits } from '@/client/lib/sounds';

export default function CreditsSection() {
  const credits = getCredits();

  return (
    <section className="mt-8 py-6 border-t border-white/10">
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center justify-between">
          <h3 className="text-label text-white/40 uppercase tracking-wider">
            Sound Credits
          </h3>
          <svg
            className="w-4 h-4 text-white/40 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>

        <div className="mt-4 space-y-3">
          {credits.map((item) => (
            <div
              key={item.sound}
              className="text-xs text-white/40 leading-relaxed"
            >
              <span className="font-medium text-white/50">{item.sound}:</span>{' '}
              <span
                dangerouslySetInnerHTML={{ __html: item.credit }}
                className="text-white/40"
              />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
