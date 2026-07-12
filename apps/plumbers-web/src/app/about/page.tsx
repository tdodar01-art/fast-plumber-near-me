import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/config/plumbing-routes";

/**
 * /about — 04 §6 copy, adjusted per SHARED rule 5: no personal names
 * (operator voice = "the Fast Plumber Near Me editorial team").
 */

export const metadata: Metadata = {
  title: "About Us — The Directory That Shows You the Bad Reviews",
  description:
    "We read the public reviews of 6,000+ plumbers — Google, Yelp, and the BBB — and publish what customers praise and what they complain about, word-for-word.",
  alternates: { canonical: absoluteUrl("/about") },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl() },
      { "@type": "ListItem", position: 2, name: "About", item: absoluteUrl("/about") },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "About Fast Plumber Near Me",
    url: absoluteUrl("/about"),
  },
];

export default function AboutPage() {
  return (
    <div className="fpn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="wrap trust">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <span>About</span>
        </nav>

        <h1>About Fast Plumber Near Me</h1>
        <p className="lede">
          <b>We&apos;re the directory that shows you the bad reviews.</b>
        </p>

        <p>
          Every plumber directory promises &ldquo;trusted pros.&rdquo; Here&apos;s the problem:
          the directories get paid by the pros. The result is an industry where the
          bury-the-negative business model is standard — star averages up front, complaints
          unfindable, and rankings quietly sold.
        </p>
        <p>
          We built the opposite. Fast Plumber Near Me reads the public reviews of every plumber
          we list — 6,000+ companies, from Google, Yelp, and the Better Business Bureau — and
          publishes an honest synthesis of each one: what customers praise, what they complain
          about, quoted word-for-word with names and dates. When three reviewers say the invoice
          grew after the quote, that goes at the top of the card, because the next customer
          deserves to know before they call, not after.
        </p>

        <p>
          <b>What we are:</b> an opinionated reading service for plumber reviews. Our rankings
          are our editorial judgment, grounded in quotes you can check yourself.
        </p>
        <p>
          <b>What we&apos;re not:</b> a lead-gen operation. We don&apos;t take your contact info
          and auction it to four plumbers. We don&apos;t charge plumbers for leads. We sell
          exactly one thing — clearly labeled sponsored placement — and it never changes a word
          of what we write about anyone. The full rules are in{" "}
          <Link href="/methodology">our methodology</Link>.
        </p>
        <p>
          <b>Who&apos;s behind it:</b> Fast Plumber Near Me is run by its own editorial team,
          based in Crystal Lake, Illinois — an independent site with no plumbing company,
          franchise network, or lead-gen broker behind it. It started with a simple observation:
          when your basement is flooding, you don&apos;t have time to read 200 reviews — but
          somebody should have. Now somebody has.
        </p>

        <p>
          Found a mistake? <Link href="/methodology#corrections">We correct fast.</Link> Want
          your business listed or want to sponsor a city?{" "}
          <Link href="/add-your-business">Start here.</Link>
        </p>
      </div>
    </div>
  );
}
