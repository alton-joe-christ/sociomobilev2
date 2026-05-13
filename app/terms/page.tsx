import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="pwa-page pt-2 px-4 pb-8">
      <div className="max-w-3xl mx-auto">
        <div className="card overflow-hidden">
          <div className="bg-[var(--color-primary-dark)] text-white px-5 py-4">
            <h1 className="text-[20px] font-extrabold">Terms of Service</h1>
            <p className="text-[12px] opacity-85 mt-1">Effective Date: 21st April 2026</p>
          </div>

          <div className="p-5 space-y-5 text-[13px] leading-6 text-[var(--color-text-muted)]">
            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">1. Acceptance of Terms</h2>
              <p>
                By using SOCIO, you agree to these Terms and all applicable policies.
                If you do not agree, please discontinue using the platform.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">2. Eligibility & Accounts</h2>
              <p>
                You are responsible for the accuracy of account details and for activities under your account.
                Keep credentials secure and report unauthorized access immediately.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">3. Acceptable Use</h2>
              <p>
                Do not misuse the platform, disrupt services, impersonate others,
                or publish harmful, fraudulent, or unlawful content.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">4. Event & Registration Disclaimer</h2>
              <p>
                SOCIO facilitates discovery and registrations.
                Event-specific rules, capacities, and organizer decisions may change;
                users should verify details before attending.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">5. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, SOCIO is not liable for indirect or consequential losses,
                including those arising from third-party services, event changes, or user conduct.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">6. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time.
                Continued use after updates means you accept the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">7. Contact</h2>
              <p>
                For questions regarding these Terms, contact
                <a href="mailto:thesocio.blr@gmail.com" className="text-[var(--color-primary)] font-semibold"> thesocio.blr@gmail.com</a>.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
          <Link href="/privacy" className="btn btn-ghost btn-sm">View Privacy</Link>
          <Link href="/discover" className="btn btn-primary btn-sm">Back to Discover</Link>
        </div>
      </div>
    </div>
  );
}
