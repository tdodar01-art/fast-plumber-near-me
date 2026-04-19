import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Fast Plumber Near Me.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 30, 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
          <p>
            <strong>For Homeowners:</strong> When you use our directory, we may collect basic usage
            data such as which city pages you visit and which plumber listings you interact with. We
            log click-to-call events to provide analytics to listed plumbers. We do not require you
            to create an account or provide personal information to use the directory.
          </p>
          <p>
            <strong>For Plumbers:</strong> When you submit your business for listing, we collect the
            information you provide including business name, phone number, email, website, service
            areas, and license number. We also collect data from our verification calls including
            whether calls were answered and response times.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To operate and improve the plumber directory</li>
            <li>To verify plumber availability through our AI calling system</li>
            <li>To calculate and display reliability scores</li>
            <li>To track leads and provide analytics to listed plumbers</li>
            <li>To communicate with listed plumbers about their listings</li>
            <li>To analyze site usage and improve user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. AI Verification Calls</h2>
          <p>
            As part of our verification process, we make periodic phone calls to listed plumbers
            using AI voice technology. These calls may be recorded for quality assurance and
            scoring purposes. By submitting your business for listing, you consent to receiving
            these verification calls. Plumbers may opt out of verification calls by contacting us,
            which will result in an &ldquo;unverified&rdquo; status on their listing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. Information Sharing</h2>
          <p>
            We do not sell your personal information. We may share information with:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Service providers who help us operate the site (hosting, analytics)</li>
            <li>Listed plumbers (aggregate lead data for their listings)</li>
            <li>Law enforcement when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Cookies and Analytics</h2>
          <p>
            We use Google Analytics to understand how visitors use our site. This involves cookies
            and similar tracking technologies. You can opt out of Google Analytics by installing the
            Google Analytics opt-out browser add-on.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security</h2>
          <p>
            We implement reasonable security measures to protect your information. However, no
            method of transmission over the Internet is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or want to request removal of your
            data, contact us at:
          </p>
          <p>
            <strong>Email:</strong>{" "}
            <a href="mailto:info@fastplumbernearme.com" className="text-primary">
              info@fastplumbernearme.com
            </a>
            <br />
            <strong>Address:</strong> 135 Erick St Unit F, Crystal Lake, IL 60014
          </p>
        </section>
      </div>
    </div>
  );
}
