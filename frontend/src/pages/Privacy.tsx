import Layout from '@/components/layout/Layout'

const link = 'font-body text-saffron hover:underline'

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-[720px] mx-auto px-4 py-16 md:py-24">
        <div className="mb-10">
          <h1 className="font-display text-4xl text-cream">Privacy Policy</h1>
          <p className="font-body text-sm text-muted mt-2">Last updated: June 22, 2026</p>
        </div>

        <div className="flex flex-col gap-10">

          <section>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              Sixer is an independent fan project — a cricket draft game built for IPL fans. This
              policy explains what data we collect, why, and what we do with it. Plain language, no
              dark patterns.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">The short version</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              You can play Sixer as a guest with just a display name, or sign in with Google to save
              your stats. Either way, your draft results may appear on the public leaderboard. We
              don't sell data, we don't run ad networks, and we don't track you across other sites.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">What we collect</h2>
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-body text-base text-cream/80 leading-relaxed">
                  <strong className="text-cream font-bold">If you play as a guest:</strong>
                </p>
                <ul className="mt-2 flex flex-col gap-1.5 pl-5 list-disc">
                  <li className="font-body text-base text-cream/80 leading-relaxed">Nothing is stored server-side. Scores, records, and XI are computed in your browser and shown locally only. Guest runs do not appear on leaderboards.</li>
                  <li className="font-body text-base text-cream/80 leading-relaxed">Your in-progress draft is saved in your browser's local storage so a page refresh doesn't wipe it.</li>
                  <li className="font-body text-base text-cream/80 leading-relaxed">Your browser's user-agent string may be used for debugging and abuse prevention.</li>
                </ul>
              </div>
              <div>
                <p className="font-body text-base text-cream/80 leading-relaxed">
                  <strong className="text-cream font-bold">If you sign in with Google:</strong>
                </p>
                <ul className="mt-2 flex flex-col gap-1.5 pl-5 list-disc">
                  <li className="font-body text-base text-cream/80 leading-relaxed">Your Google account email and unique user ID (handled by Supabase Auth, our authentication provider)</li>
                  <li className="font-body text-base text-cream/80 leading-relaxed">A display name you choose (separate from your Google name — you control it)</li>
                  <li className="font-body text-base text-cream/80 leading-relaxed">All of the above guest data, plus a persistent profile linking your runs together</li>
                </ul>
                <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
                  We do not receive your Google password. We do not access your Google contacts, calendar, or any other Google service.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">What's public</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              The leaderboard shows your display name, score, record, tier, mode, and the XI you
              drafted. That's it. Your email, IP, and user ID are never displayed publicly.
            </p>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              Only signed-in users' runs appear on the leaderboard. Playing as a guest is fully
              private — no run data is stored server-side.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Local storage</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              We use your browser's local storage and session storage for:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 pl-5 list-disc">
              <li className="font-body text-base text-cream/80 leading-relaxed">Preventing duplicate submissions of the same draft within a session</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Storing your in-progress draft so a refresh doesn't wipe it</li>
            </ul>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              You can clear this any time via your browser settings. We don't use tracking cookies
              and we don't run third-party analytics that identify you.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Cricket data</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              Player statistics are sourced from{' '}
              <a href="https://cricsheet.org" target="_blank" rel="noopener noreferrer" className={link}>
                cricsheet.org
              </a>
              , a public ball-by-ball IPL dataset. All player names, season stats, and franchise
              data are factual records of public matches.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Where your data lives</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              Authentication, profile data, and leaderboard runs are stored in{' '}
              <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className={link}>
                Supabase
              </a>
              , a hosted Postgres database. Supabase processes data on our behalf under their own
              privacy terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Your rights</h2>
            <ul className="flex flex-col gap-1.5 pl-5 list-disc">
              <li className="font-body text-base text-cream/80 leading-relaxed">
                Rename your display name any time from your profile (subject to a 30-day cooldown to
                prevent abuse). Renaming updates your name everywhere it appears, including past
                leaderboard entries.
              </li>
              <li className="font-body text-base text-cream/80 leading-relaxed">
                Delete your account and all associated data directly from your profile page using
                the "Delete account" button, or by emailing the address below. Self-serve deletions
                are immediate; emailed requests are handled within 30 days.
              </li>
              <li className="font-body text-base text-cream/80 leading-relaxed">
                Play as a guest if you'd rather not have a persistent profile at all.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Children</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              Sixer isn't directed at children under 13. If you're a parent and believe your child
              has signed in, contact us and we'll delete the account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Changes to this policy</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              If we change what we collect or how we use it, we'll update the "Last updated" date
              and post a notice on the homepage for material changes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Contact</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              Sixer is an independent fan project, not affiliated with the IPL, BCCI, or any
              franchise. For privacy questions, data deletion requests, or anything else, email{' '}
              <a href="mailto:sid.tapkhirwala@gmail.com" className={link}>
                sid.tapkhirwala@gmail.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </Layout>
  )
}
