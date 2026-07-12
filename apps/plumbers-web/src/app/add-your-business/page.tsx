import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/config/plumbing-routes";
import SubmitForm from "./SubmitForm";

/**
 * /add-your-business — plumber-facing pitch (04 §6) + the existing submission
 * form. Dispute/claim affordance routes through /contact (C11 adjusted: no
 * separate dispute form route at launch — profile OwnerPanels link
 * /contact?about={slug} and this page points the same way).
 */

export const metadata: Metadata = {
  title: "Get Listed — Free Listings & Sponsored Placement for Plumbers",
  description:
    "We read your public reviews from Google, Yelp, and the BBB and publish an honest assessment. Free listings; one labeled sponsored slot per city.",
  alternates: { canonical: absoluteUrl("/add-your-business") },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl() },
      { "@type": "ListItem", position: 2, name: "For plumbers", item: absoluteUrl("/add-your-business") },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Get listed on Fast Plumber Near Me",
    url: absoluteUrl("/add-your-business"),
  },
];

export default function AddYourBusinessPage() {
  return (
    <div className="fpn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="wrap trust">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <span>For plumbers</span>
        </nav>

        <h1>Get listed. Get read. Get chosen.</h1>
        <p className="stamp">For plumbing companies</p>
        <p className="lede">
          Fast Plumber Near Me is a review-synthesis directory: we read your public reviews from
          Google, Yelp, and the BBB, and publish an honest assessment — strengths and complaints
          — for homeowners comparing plumbers in your area. 6,000+ companies are already listed.
          Yours may be too.
        </p>

        <h2>The free part</h2>
        <p>Every qualifying plumber is listed free. No charge, ever, for:</p>
        <ul>
          <li>Your listing with phone, hours, service area, and website</li>
          <li>Our synthesis of your reviews — the same honest treatment everyone gets</li>
          <li>
            Claiming your listing to correct business details and post an owner response —{" "}
            <Link href="/contact">start with our contact form</Link>
          </li>
          <li>A quarterly re-read of your reviews on request, so recent improvement shows up here</li>
        </ul>
        <div className="rulebox">
          <b>Straight talk before you submit:</b> we publish complaint patterns too. If your
          reviews show one, it will appear on your card, and payment can&apos;t remove it. Plenty
          of directories will hide your negatives for a fee; we&apos;re not one of them, and
          that&apos;s exactly why homeowners believe the positives we print about you.
        </div>

        <h2>Sponsored placement: own the top of your city</h2>
        <p>
          One plumber per city page can hold the labeled <b>Sponsored</b> slot — the first card
          homeowners see for that city.
        </p>
        <p>What you get:</p>
        <ul>
          <li>Top position on the city page(s) you choose, above the organic rankings</li>
          <li>
            The &ldquo;Sponsored&rdquo; label, plus your full assessment — the same one you&apos;d
            have anyway
          </li>
          <li>
            Placement in front of people actively comparing plumbers in your area — not cold leads
            you&apos;re bidding on against four competitors
          </li>
        </ul>
        <p>What you should know:</p>
        <ul>
          <li>
            <b>Sponsorship never changes your assessment.</b> Your score, strengths, and complaint
            patterns read identically, paid or not. Homeowners trust the slot because it
            can&apos;t lie — which is what makes it worth buying.
          </li>
          <li>
            <b>There&apos;s a quality bar.</b> Companies below our quality threshold can&apos;t
            purchase placement. If that&apos;s you today, it may not be after your next quarter of
            reviews — ask us for a re-read.
          </li>
          <li>
            Pricing is per city, month to month, no contract.{" "}
            <Link href="/contact">Contact us for your city&apos;s rate.</Link>
          </li>
        </ul>
        <p>
          <em>
            You can pay to be seen here. You can&apos;t pay to be trusted here. That&apos;s the
            deal — for you and for every competitor on your page.
          </em>
        </p>

        <h2 id="submit" className="anchor-target">
          Submit your business — free
        </h2>
        <SubmitForm />

        <p style={{ marginTop: 28 }}>
          Already listed and something&apos;s wrong?{" "}
          <Link href="/methodology#corrections">Read our corrections policy</Link> or{" "}
          <Link href="/contact">dispute a listing through the contact form</Link> — include your
          listing URL.
        </p>
      </div>
    </div>
  );
}
