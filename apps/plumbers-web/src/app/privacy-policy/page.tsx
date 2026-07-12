import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/config/plumbing-routes";

/**
 * /privacy-policy — 04 §7 red-lines R1–R5 applied: every clause referencing
 * the nonexistent call-verification program is deleted and replaced with the
 * public-review-data framing. Corrections route through /contact (no new
 * mailboxes). Last-updated bumped on publish.
 */

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/privacy-policy") },
  title: "Privacy Policy",
  description: "Privacy policy for Fast Plumber Near Me.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="fpn">
      <div className="wrap trust">
        <h1>Privacy Policy</h1>
        <p className="stamp">Last updated: July 11, 2026</p>

        <h2>1. Information We Collect</h2>
        <p>
          <b>For Homeowners:</b> When you use our directory, we may collect basic usage data such
          as which city pages you visit and which plumber listings you interact with. We log
          click-to-call events to provide analytics to listed plumbers. We do not require you to
          create an account or provide personal information to use the directory.
        </p>
        <p>
          <b>For Plumbers:</b> When you submit your business for listing, we collect the
          information you provide including business name, phone number, email, website, service
          areas, and license number. We also collect publicly available information about your
          business, including customer reviews published on third-party platforms such as Google,
          Yelp, and the Better Business Bureau.
        </p>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To operate and improve the plumber directory</li>
          <li>
            To aggregate and synthesize publicly available customer reviews into the assessments
            displayed on our site
          </li>
          <li>To calculate and display editorial quality scores based on public review data</li>
          <li>To track leads and provide analytics to listed plumbers</li>
          <li>To communicate with listed plumbers about their listings</li>
          <li>To analyze site usage and improve user experience</li>
        </ul>

        <h2>3. Public Review Data</h2>
        <p>
          Our plumber assessments are based on customer reviews published on third-party
          platforms (Google, Yelp, BBB). We quote these reviews verbatim with the attribution
          (reviewer name, date, platform) under which they were published. Reviewers whose public
          reviews are quoted, or plumbers who believe a quoted review has been removed at its
          source, may reach us through our <Link href="/contact">contact form</Link>; see our{" "}
          <Link href="/methodology#corrections">Methodology page</Link> for the dispute process.
        </p>

        <h2>4. Information Sharing</h2>
        <p>We do not sell your personal information. We may share information with:</p>
        <ul>
          <li>Service providers who help us operate the site (hosting, analytics)</li>
          <li>Listed plumbers (aggregate lead data for their listings)</li>
          <li>Law enforcement when required by law</li>
        </ul>

        <h2>5. Cookies and Analytics</h2>
        <p>
          We use Google Analytics to understand how visitors use our site. This involves cookies
          and similar tracking technologies. You can opt out of Google Analytics by installing
          the Google Analytics opt-out browser add-on.
        </p>

        <h2>6. Data Security</h2>
        <p>
          We implement reasonable security measures to protect your information. However, no
          method of transmission over the Internet is 100% secure, and we cannot guarantee
          absolute security.
        </p>

        <h2>7. Contact Us</h2>
        <p>
          If you have questions about this privacy policy or want to request removal of your
          data, contact us at:
        </p>
        <p>
          <b>Email:</b>{" "}
          <a href="mailto:info@fastplumbernearme.com">info@fastplumbernearme.com</a>
          <br />
          <b>Address:</b> 135 Erick St Unit F, Crystal Lake, IL 60014
        </p>
      </div>
    </div>
  );
}
