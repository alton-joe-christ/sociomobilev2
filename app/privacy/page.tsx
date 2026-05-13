import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="pwa-page pt-2 px-4 pb-8">
      <div className="max-w-3xl mx-auto">
        <div className="card overflow-hidden">
          <div className="bg-[var(--color-primary-dark)] text-white px-5 py-4">
            <h1 className="text-[20px] font-extrabold">Privacy Policy</h1>
            <p className="text-[12px] opacity-85 mt-1">Effective Date: 21st April 2026</p>
          </div>

          <div className="p-5 space-y-5 text-[13px] leading-6 text-[var(--color-text-muted)]">
            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">1. Information We Collect</h2>
              <p>
                We collect account and usage information required to provide SOCIO services,
                including name, email, register number/visitor ID, event registration details,
                and basic device/session metadata.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">2. How We Use Data</h2>
              <p>
                We use your data to authenticate users, manage event registrations,
                generate tickets/QRs, send essential notifications, and improve platform reliability.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">3. Data Sharing</h2>
              <p>
                We do not sell personal data. Data is shared only with trusted service providers
                and authorized event management workflows required for platform operations.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">4. Security & Retention</h2>
              <p>
                We apply reasonable technical and organizational safeguards.
                Data is retained only as long as needed for legal, security, and operational purposes.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">5. Your Rights</h2>
              <p>
                You may request access, correction, or deletion of your data,
                subject to applicable legal and compliance requirements.
              </p>
            </section>

            <section>
              <h2 className="text-[15px] font-bold text-[var(--color-text)] mb-2">6. Contact</h2>
              <p>
                For privacy requests or concerns, contact us at
                <a href="mailto:thesocio.blr@gmail.com" className="text-[var(--color-primary)] font-semibold"> thesocio.blr@gmail.com</a>.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
          <Link href="/terms" className="btn btn-ghost btn-sm">View Terms</Link>
          <Link href="/discover" className="btn btn-primary btn-sm">Back to Discover</Link>
        </div>
      </div>
    </div>
  );
}
