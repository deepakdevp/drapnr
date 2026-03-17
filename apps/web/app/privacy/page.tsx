import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Drapnr",
  description: "Drapnr privacy policy. Learn how we collect, use, and protect your data.",
};

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 lg:py-32">
      <a
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[#6B7280] transition-colors hover:text-[#1A1A2E]"
      >
        &larr; Back to home
      </a>

      <h1 className="mt-8 font-display text-4xl font-bold tracking-tight text-[#1A1A2E]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#6B7280]">Last updated: March 17, 2026</p>

      <div className="mt-12 space-y-10 text-sm leading-relaxed text-[#6B7280]">
        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">1. Introduction</h2>
          <p className="mt-3">
            Drapnr (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the Drapnr
            mobile application (the &ldquo;Service&rdquo;). This Privacy Policy explains how we
            collect, use, disclose, and safeguard your information when you use our Service. Please
            read this policy carefully. By using Drapnr, you consent to the data practices described
            in this policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            2. Information We Collect
          </h2>
          <p className="mt-3">We collect the following types of information:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>
              <strong className="text-[#1A1A2E]">Account Information:</strong> Your name and email
              address when you create an account.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Photos and Videos:</strong> 360&deg; captures of
              your outfits that you voluntarily upload to the Service. These are used solely to
              provide the wardrobe digitization features.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Device Information:</strong> Device type, operating
              system, unique device identifiers, and mobile network information to ensure
              compatibility and optimize performance.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Usage Analytics:</strong> Anonymized data about how
              you interact with the app, including feature usage patterns, session duration, and
              crash reports.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Payment Information:</strong> Subscription and
              billing data is processed by RevenueCat and the respective app store (Apple App Store
              or Google Play Store). We do not directly store your credit card or payment method
              details.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            3. How We Use Your Information
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>To provide, maintain, and improve the Service.</li>
            <li>
              To process your 360&deg; outfit captures using cloud-based GPU servers for AI-powered
              garment extraction and 3D rendering.
            </li>
            <li>To manage your account and provide customer support.</li>
            <li>To process subscriptions and payments via RevenueCat.</li>
            <li>To send transactional communications (e.g., account verification, billing).</li>
            <li>To analyze usage trends and improve user experience.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            4. Data Storage and Security
          </h2>
          <p className="mt-3">
            Your data is stored securely on Supabase cloud infrastructure. We employ
            industry-standard security measures including encryption in transit (TLS/SSL) and at rest
            to protect your personal information. Video processing is performed on secure cloud GPU
            servers and processed data is transmitted back to our storage systems via encrypted
            channels.
          </p>
          <p className="mt-3">
            While we strive to protect your data, no method of electronic storage or transmission is
            100% secure. We cannot guarantee absolute security but are committed to implementing
            best-practice safeguards.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            5. Third-Party Services
          </h2>
          <p className="mt-3">We use the following third-party services:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>
              <strong className="text-[#1A1A2E]">Supabase:</strong> Cloud database and file storage.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">RevenueCat:</strong> Subscription management and
              payment processing.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Cloud GPU providers:</strong> Video processing and
              AI inference.
            </li>
          </ul>
          <p className="mt-3">
            Each third-party service operates under its own privacy policy. We encourage you to
            review their respective policies.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            6. Data Sharing
          </h2>
          <p className="mt-3">
            <strong className="text-[#1A1A2E]">
              We do not sell, trade, or rent your personal information to third parties.
            </strong>{" "}
            We may share information only in the following circumstances:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>With service providers who assist in operating the Service (as described above).</li>
            <li>When required by law or to respond to legal process.</li>
            <li>To protect the rights, property, or safety of Drapnr, our users, or the public.</li>
            <li>
              In connection with a merger, acquisition, or sale of assets, with prior notice to
              affected users.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            7. Your Rights (GDPR &amp; CCPA)
          </h2>
          <p className="mt-3">
            Depending on your location, you may have the following rights regarding your personal
            data:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>
              <strong className="text-[#1A1A2E]">Right of Access:</strong> Request a copy of your
              personal data.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Right to Rectification:</strong> Correct inaccurate
              or incomplete data.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Right to Erasure:</strong> Request deletion of your
              personal data.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Right to Data Portability:</strong> Receive your
              data in a structured, machine-readable format.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Right to Object:</strong> Opt out of certain
              processing activities.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Right to Non-Discrimination (CCPA):</strong> We
              will not discriminate against you for exercising your privacy rights.
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:privacy@drapnr.com" className="text-[#FF6B6B] underline">
              privacy@drapnr.com
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            8. Data Retention
          </h2>
          <p className="mt-3">
            We retain your personal data for as long as your account is active or as needed to
            provide the Service. If you delete your account, we will delete or anonymize your
            personal data within 30 days, except where retention is required by law. Processed outfit
            data (3D models and extracted garments) will be permanently deleted upon account
            deletion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            9. Children&apos;s Privacy
          </h2>
          <p className="mt-3">
            Drapnr is not intended for use by individuals under the age of 13. We do not knowingly
            collect personal information from children under 13. If we become aware that we have
            inadvertently collected such information, we will take steps to delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            10. Changes to This Policy
          </h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by posting the updated policy in the app and updating the &ldquo;Last
            updated&rdquo; date. Your continued use of the Service after such changes constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">11. Contact Us</h2>
          <p className="mt-3">
            If you have questions or concerns about this Privacy Policy, please contact us at:
          </p>
          <p className="mt-3">
            <a href="mailto:privacy@drapnr.com" className="text-[#FF6B6B] underline">
              privacy@drapnr.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
