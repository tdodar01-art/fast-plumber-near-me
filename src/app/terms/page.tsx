import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for Fast Plumber Near Me.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 30, 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Fast Plumber Near Me (&ldquo;the Site&rdquo;), you accept and
            agree to be bound by these Terms of Service. If you do not agree, do not use the Site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
          <p>
            Fast Plumber Near Me is an online directory that connects homeowners with emergency
            plumbing service providers. We provide listings, reliability scores, and contact
            information for plumbers in various service areas. We are a directory service — we do
            not employ plumbers and are not a plumbing company.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. No Guarantee of Service</h2>
          <p>
            While we make reasonable efforts to verify plumber availability through our AI calling
            system, we cannot guarantee that any listed plumber will be available, responsive, or
            provide satisfactory service. Reliability scores are based on historical data and may
            not reflect current availability. Users should exercise their own judgment when selecting
            a plumber.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. For Listed Plumbers</h2>
          <p>By submitting your business for listing, you agree that:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>All information provided is accurate and current</li>
            <li>You are authorized to represent the listed business</li>
            <li>You consent to periodic verification calls from our AI system</li>
            <li>Your reliability score will be publicly displayed based on verification results</li>
            <li>We may remove or modify your listing at our discretion</li>
            <li>You maintain all required licenses and insurance for your service area</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Limitation of Liability</h2>
          <p>
            Fast Plumber Near Me and its operators shall not be liable for any damages arising from
            the use of this directory, including but not limited to damages resulting from:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Plumber performance, quality of work, or conduct</li>
            <li>Inaccurate or outdated listing information</li>
            <li>Service interruptions or technical issues</li>
            <li>Reliance on reliability scores or verification data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. Intellectual Property</h2>
          <p>
            All content on this site, including text, graphics, logos, and software, is the property
            of Fast Plumber Near Me and is protected by copyright laws. You may not reproduce,
            distribute, or create derivative works without written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Changes will be effective
            immediately upon posting. Continued use of the Site constitutes acceptance of modified
            terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact</h2>
          <p>
            Questions about these terms? Contact us at{" "}
            <a href="mailto:fastplumbernearme@gmail.com" className="text-primary">
              fastplumbernearme@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
