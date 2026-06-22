import Layout from '@/components/layout/Layout'

const link = 'font-body text-saffron hover:underline'

export default function Terms() {
  return (
    <Layout>
      <div className="max-w-[720px] mx-auto px-4 py-16 md:py-24">
        <div className="mb-10">
          <h1 className="font-display text-4xl text-cream">Terms of Use</h1>
          <p className="font-body text-sm text-muted mt-2">Last updated: June 22, 2026</p>
        </div>

        <div className="flex flex-col gap-10">

          <section>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              By using Sixer, you agree to these terms. If you don't agree, please don't use the service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">What Sixer is</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              Sixer is a free, independent fan-made cricket draft game. Players draft an IPL XI, an
              algorithm computes a Sixer Score and a 16-match record, and results can be shared and
              compared on public leaderboards. Sixer is provided for entertainment purposes only.
            </p>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              The Sixer score, record, and tier are produced by a deterministic algorithm based on
              historical IPL statistics from{' '}
              <a href="https://cricsheet.org" target="_blank" rel="noopener noreferrer" className={link}>
                cricsheet.org
              </a>
              . They are not predictions of actual cricket outcomes and have no real-world significance.
            </p>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              Sixer is <strong className="text-cream font-bold">not</strong> a gambling, betting,
              fantasy sports, or prediction service. No purchase or payment is necessary to play.
              Scores, records, and leaderboard placements have no monetary value and cannot be
              exchanged for money or anything of value. Sixer must not be used as the basis for any
              wagering decisions.
            </p>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              Sixer is not affiliated with, endorsed by, or sponsored by the BCCI, IPL, any franchise,
              or any player. Player names, franchise names, and historical statistics are used for
              informational and entertainment purposes only. All league and franchise trademarks remain
              the property of their respective owners.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Eligibility</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              You must be at least 13 years old to use Sixer. If you are under the age of majority in
              your country, you may only use Sixer with a parent or guardian's consent.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Your account</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              You can play Sixer as a guest or sign in with Google for a persistent profile. If you
              sign in, you're responsible for keeping your Google account secure. You can delete your
              Sixer account at any time from your profile page.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Acceptable use</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              You agree to use Sixer in good faith. Specifically, you will not:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 pl-5 list-disc">
              <li className="font-body text-base text-cream/80 leading-relaxed">Submit fake scores or attempt to manipulate the leaderboard</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Use automated scripts, bots, or scrapers to play or access the service</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Exploit bugs in the scoring engine to inflate your score</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Create multiple accounts to gain an unfair advantage or impersonate someone</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Use offensive, abusive, or misleading display names</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Disrupt the service, its servers, or attempt to gain unauthorized access to systems or data</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Reverse engineer the scoring algorithm or replicate Sixer as a competing service</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">Use Sixer for any unlawful purpose</li>
            </ul>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              We may remove accounts, reset scores, or revoke leaderboard entries that violate these
              rules, without notice.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Your content</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              You retain ownership of content you submit (display names, feedback). By submitting
              content, you grant us a worldwide, non-exclusive, royalty-free license to display it as
              needed to operate Sixer — including showing your display name and scores on public
              leaderboards. Feedback you send may be used to improve the service without compensation.
            </p>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              You're welcome to share screenshots, share grids, and posters from your Sixer drafts on
              any platform. You may not copy the game, rebrand it, or run it as a competing service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Service availability and changes</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              Sixer is provided as-is, free of charge, with no guarantees:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 pl-5 list-disc">
              <li className="font-body text-base text-cream/80 leading-relaxed">The service may go down, lose data, or change without notice</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">We may modify the scoring engine, bonus rules, penalty rules, and tier thresholds at any time without notice. Past scores may not be comparable to future scores after such changes.</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">We may reset leaderboards or records, especially after major scoring updates</li>
              <li className="font-body text-base text-cream/80 leading-relaxed">We are not responsible for any losses, missed opportunities, or distress caused by using Sixer</li>
            </ul>
            <p className="font-body text-base text-cream/80 leading-relaxed mt-3">
              If Sixer breaks or behaves unexpectedly, we'll do our best to fix it, but we make no promises.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Disclaimers</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              The service is provided "as is" and "as available," without warranties of any kind,
              express or implied, including implied warranties of merchantability, fitness for a
              particular purpose, and non-infringement. We do not warrant that the service will be
              uninterrupted, error-free, or secure, or that any data — including historical statistics
              or computed scores — will be accurate or complete.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Termination</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              You may stop using Sixer and delete your account at any time. We may suspend or
              terminate your access at any time, with or without notice, for any reason, including
              violation of these terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Changes to these terms</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              We may update these terms from time to time. If we make significant changes, we'll post
              a notice on the homepage and update the "Last updated" date. Continued use of Sixer
              after changes means you accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Governing law</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              These terms are governed by the laws of the Netherlands. Any disputes will be handled in
              Dutch courts. Nothing in this section limits any mandatory consumer protections you have
              under the laws of your country of residence.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream mb-3">Contact</h2>
            <p className="font-body text-base text-cream/80 leading-relaxed">
              For questions about these terms, email{' '}
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
