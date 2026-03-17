import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Drapnr",
  description: "Drapnr terms of service. Read the terms governing use of the Drapnr app.",
};

export default function TermsOfService() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 lg:py-32">
      <a
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[#6B7280] transition-colors hover:text-[#1A1A2E]"
      >
        &larr; Back to home
      </a>

      <h1 className="mt-8 font-display text-4xl font-bold tracking-tight text-[#1A1A2E]">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-[#6B7280]">Last updated: March 17, 2026</p>

      <div className="mt-12 space-y-10 text-sm leading-relaxed text-[#6B7280]">
        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            1. Service Description
          </h2>
          <p className="mt-3">
            Drapnr is a mobile application that allows users to capture 360&deg; videos of their
            outfits, digitize their wardrobe, and virtually mix and match clothing items on a
            personalized 3D avatar. These Terms of Service (&ldquo;Terms&rdquo;) govern your access
            to and use of the Drapnr application and related services (collectively, the
            &ldquo;Service&rdquo;).
          </p>
          <p className="mt-3">
            By creating an account or using the Service, you agree to be bound by these Terms. If
            you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            2. User Accounts and Responsibilities
          </h2>
          <p className="mt-3">To use Drapnr, you must:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>Be at least 13 years of age.</li>
            <li>Provide accurate and complete registration information.</li>
            <li>
              Maintain the security and confidentiality of your account credentials.
            </li>
            <li>
              Notify us immediately of any unauthorized access to your account.
            </li>
          </ul>
          <p className="mt-3">
            You are solely responsible for all activity that occurs under your account. We reserve
            the right to suspend or terminate accounts that violate these Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            3. Subscriptions, Billing, and Refunds
          </h2>
          <p className="mt-3">
            Drapnr offers free and paid subscription plans. Paid subscriptions are billed through the
            Apple App Store or Google Play Store and managed via RevenueCat.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>
              <strong className="text-[#1A1A2E]">Billing:</strong> Subscriptions are billed on a
              recurring basis (monthly or annually) according to the plan you select. Payment is
              charged to your App Store or Play Store account at confirmation of purchase.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Auto-Renewal:</strong> Subscriptions automatically
              renew unless cancelled at least 24 hours before the end of the current billing period.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Cancellation:</strong> You can cancel your
              subscription at any time through your App Store or Play Store settings. Cancellation
              takes effect at the end of the current billing period; you will retain access to paid
              features until then.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Refunds:</strong> Refund requests are handled in
              accordance with Apple App Store and Google Play Store refund policies. We do not
              process refunds directly. Please contact the respective app store for refund inquiries.
            </li>
            <li>
              <strong className="text-[#1A1A2E]">Price Changes:</strong> We reserve the right to
              change subscription pricing. Existing subscribers will be notified in advance, and
              changes will apply at the next renewal period.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            4. Intellectual Property
          </h2>
          <p className="mt-3">
            <strong className="text-[#1A1A2E]">Your Content:</strong> You retain full ownership of
            the photos, videos, and outfit data you upload to Drapnr. By using the Service, you
            grant Drapnr a limited, non-exclusive, royalty-free license to process, store, and
            display your content solely for the purpose of providing and improving the Service. This
            license terminates when you delete your content or close your account.
          </p>
          <p className="mt-3">
            <strong className="text-[#1A1A2E]">Our Content:</strong> The Drapnr application,
            including its design, features, code, trademarks, logos, and all related intellectual
            property, is owned by Drapnr and protected by applicable intellectual property laws. You
            may not copy, modify, distribute, or reverse-engineer any part of the Service without
            our prior written consent.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            5. Prohibited Use
          </h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>
              Use the Service for any unlawful purpose or in violation of any applicable laws.
            </li>
            <li>
              Upload content that infringes on the intellectual property rights of others.
            </li>
            <li>
              Upload obscene, defamatory, harassing, or otherwise objectionable content.
            </li>
            <li>
              Attempt to gain unauthorized access to the Service, other accounts, or related systems.
            </li>
            <li>
              Use automated tools (bots, scrapers) to access or extract data from the Service.
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the Service.
            </li>
            <li>
              Resell, sublicense, or commercially exploit the Service without authorization.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            6. Limitation of Liability
          </h2>
          <p className="mt-3">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DRAPNR AND ITS OFFICERS, DIRECTORS,
            EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA,
            USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF (OR
            INABILITY TO USE) THE SERVICE.
          </p>
          <p className="mt-3">
            IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNTS YOU HAVE PAID TO DRAPNR
            IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER
            IS GREATER.
          </p>
          <p className="mt-3">
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            7. Indemnification
          </h2>
          <p className="mt-3">
            You agree to indemnify, defend, and hold harmless Drapnr and its affiliates from and
            against any claims, damages, losses, liabilities, costs, and expenses (including
            reasonable attorney&apos;s fees) arising out of or related to your use of the Service,
            your violation of these Terms, or your violation of any rights of another party.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">8. Termination</h2>
          <p className="mt-3">
            We may suspend or terminate your access to the Service at any time, with or without
            cause, and with or without notice. Upon termination:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>Your right to use the Service will immediately cease.</li>
            <li>
              We may delete your account data within 30 days, unless retention is required by law.
            </li>
            <li>
              You may request a copy of your data before deletion by contacting us.
            </li>
          </ul>
          <p className="mt-3">
            You may terminate your account at any time by deleting it through the app settings or
            contacting support.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            9. Governing Law
          </h2>
          <p className="mt-3">
            These Terms shall be governed by and construed in accordance with the laws of the State
            of Delaware, United States, without regard to its conflict of law provisions. Any
            disputes arising under these Terms shall be resolved in the courts of Delaware.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">
            10. Changes to These Terms
          </h2>
          <p className="mt-3">
            We reserve the right to modify these Terms at any time. We will provide notice of
            material changes by posting the updated Terms within the app and updating the &ldquo;Last
            updated&rdquo; date. Your continued use of the Service after any changes constitutes
            your acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-[#1A1A2E]">11. Contact Us</h2>
          <p className="mt-3">
            If you have questions about these Terms, please contact us at:
          </p>
          <p className="mt-3">
            <a href="mailto:legal@drapnr.com" className="text-[#FF6B6B] underline">
              legal@drapnr.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
