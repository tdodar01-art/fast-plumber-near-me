import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/config/plumbing-routes";

/**
 * /methodology — the single trust page (C4). Copy is 04 §3, applied with two
 * spec-mandated adjustments: (1) no personal names (SHARED rule 5 — operator
 * voice is the editorial team), (2) corrections route through the existing
 * /contact form instead of a not-yet-provisioned corrections@ mailbox.
 *
 * This page contains the ONLY permitted occurrences of verification
 * vocabulary on the site — inside "What we do NOT do", saying we don't do it.
 *
 * Anchors are load-bearing: #what-we-do-not-do, #score, #sponsored,
 * #corrections are linked from sponsored labels, concerns headers, score
 * lines, and the footer. Do not rename them.
 */

export const metadata: Metadata = {
  title: "How We Rate Plumbers — Our Methodology",
  description:
    "We read public reviews from Google, Yelp, and the BBB, then publish each plumber's strengths and concerns with verbatim quotes — and our dispute process.",
  alternates: { canonical: absoluteUrl("/methodology") },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl() },
      { "@type": "ListItem", position: 2, name: "Methodology", item: absoluteUrl("/methodology") },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "How We Rate Plumbers — Our Methodology",
    url: absoluteUrl("/methodology"),
  },
];

export default function MethodologyPage() {
  return (
    <div className="fpn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="wrap trust">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <span>Methodology</span>
        </nav>

        <h1>How we rate plumbers</h1>
        <p className="lede">
          Fast Plumber Near Me is a review-synthesis directory. We read the public reviews of the
          plumbers we list, form an editorial opinion, and publish it — including the negative
          patterns other directories don&apos;t surface. This page explains exactly how that
          works, what we do not do, and how to reach us if we got something wrong.
        </p>
        <p className="stamp">
          <em>Last updated: July 11, 2026. This page changes when our process does.</em>
        </p>

        <h2>What we do</h2>

        <h3>1. We aggregate public reviews.</h3>
        <p>
          For each plumber, we collect published customer reviews from Google, Yelp, and the
          Better Business Bureau — for most companies, far more than the handful shown on a
          typical search result. As of July 2026 we track 6,000+ plumbing companies and have
          collected their public reviews on an ongoing basis. Reviews are stored as written; we
          never edit, paraphrase-as-quote, or fabricate them.
        </p>

        <h3>2. We synthesize them, with AI assistance under editorial standards.</h3>
        <p>
          Reading 400 reviews per company doesn&apos;t scale by hand, so we use AI tools to help
          find patterns — and we constrain them hard. Our standards for every published
          synthesis:
        </p>
        <ul>
          <li>
            Every strength and every concern must be supported by specific, identifiable reviews.
            Our system rejects any summary line that can&apos;t cite the reviews it came from.
          </li>
          <li>
            Quotes are verbatim excerpts of real published reviews, shown with the reviewer&apos;s
            name, review date, and source platform.
          </li>
          <li>
            Generic filler is banned. &ldquo;Reliable and professional&rdquo; tells you nothing;
            &ldquo;three reviewers since March describe invoices that grew after work
            started&rdquo; tells you what to ask before you sign.
          </li>
          <li>
            We look hardest for the signals that matter in an emergency: does anyone say they came
            at night? Do reviewers mention response time, or only workmanship?
          </li>
        </ul>

        <h3>3. We take a side.</h3>
        <p>
          Each plumber gets a quality score and a ranking on their city&apos;s page. The score is
          our opinion — a weighted read of their rating, review volume and recency, and the
          strength of the patterns (good and bad) in the review text. Two plumbers with identical
          star ratings can rank very differently if one has a pattern of pricing complaints and
          the other doesn&apos;t. We think that&apos;s the entire point of a directory.
        </p>

        <h3>4. We publish the negatives.</h3>
        <p>
          A written complaint usually represents more than one unhappy customer — most people
          never write the review. So when reviews show a repeated concern (no-shows, surprise
          fees, unreturned calls, failed inspections), it appears on the plumber&apos;s card,
          above the fold, with the quotes behind it. We also show each plumber&apos;s full rating
          distribution, not a cherry-picked average.
        </p>

        <h2 id="what-we-do-not-do" className="anchor-target">
          What we do NOT do
        </h2>
        <p>Honesty about our method includes its limits:</p>
        <ul>
          <li>
            <b>We do not call, visit, or inspect plumbers.</b> No phone verification, no test
            calls, no in-person checks. If a page on this site ever said otherwise, it was wrong
            and has been removed.
          </li>
          <li>
            <b>We do not check licenses or insurance.</b> Verify licensure with your state or
            municipality before hiring — we link to the checker where your state offers one.
          </li>
          <li>
            <b>We do not accept payment to alter an assessment.</b> Not to remove a concern,
            soften a summary, hide a quote, or bump a score. There is no price for that. See
            &ldquo;Sponsored placement&rdquo; below for what money <em>does</em> buy.
          </li>
          <li>
            <b>We do not launder reviews.</b> We don&apos;t solicit, host, or gate reviews
            ourselves, and we don&apos;t let plumbers submit testimonials into our synthesis.
            Only reviews published on independent platforms count.
          </li>
          <li>
            <b>We do not guarantee outcomes.</b> Our synthesis is an opinion based on what past
            customers wrote publicly. It is a decision aid, not an endorsement, warranty, or
            prediction of your experience.
          </li>
        </ul>

        <h2 id="score" className="anchor-target">
          What our score means
        </h2>
        <p>Every listed plumber gets a score from 0&ndash;100. It blends:</p>
        <ul>
          <li>
            <b>Customer rating and review volume</b> — a 4.8 across 900 reviews outweighs a 5.0
            across 6.
          </li>
          <li>
            <b>Recency</b> — what customers say lately counts more than what they said in 2019.
          </li>
          <li>
            <b>Pattern strength in review text</b> — repeated, specific praise (fast arrival,
            clean diagnosis, honest pricing) raises it; repeated, specific complaints lower it,
            more than the star average alone would suggest.
          </li>
        </ul>
        <p>
          The score is an editorial judgment, not a measurement. Where our data is thin — a
          plumber with only a few reviews — we say so on their card instead of pretending
          confidence.
        </p>

        <h2 id="sponsored" className="anchor-target">
          Sponsored placement — what money buys here, exactly
        </h2>
        <p>
          We sell one thing to plumbers: <b>position</b>. A plumber can pay to appear in the
          marked &ldquo;Sponsored&rdquo; slot at the top of their city&apos;s page.
        </p>
        <p>The rules, in full:</p>
        <ul>
          <li>
            Sponsored placement is <b>always labeled</b> — visibly on the card, and as paid
            placement in the page code (<code>rel=&quot;sponsored&quot;</code>).
          </li>
          <li>
            Sponsorship <b>never changes the written assessment</b>. The sponsored card shows the
            same score, the same strengths, the same concerns, and the same quotes as it would
            unsponsored. If a sponsor has a pattern of pricing complaints, the sponsored card
            says so.
          </li>
          <li>
            <b>Not every plumber can sponsor.</b> Plumbers scoring below our quality threshold
            cannot buy placement at any price. You can pay to be seen; you cannot pay to be
            trusted.
          </li>
          <li>Organic rankings below the sponsored slot are never affected by who pays us.</li>
        </ul>

        <h2 id="corrections" className="anchor-target">
          Corrections and disputes — for plumbers
        </h2>
        <p>
          If we&apos;ve listed your business and something is wrong, we want to fix it. Send us
          the listing URL and the issue through our{" "}
          <Link href="/contact">contact form</Link> — use your business email address, or expect
          us to ask for call attribution before acting:
        </p>
        <ul>
          <li>
            <b>Factual data</b> (phone, address, hours, closed business): we confirm and correct
            errors within 3 business days.
          </li>
          <li>
            <b>A quote you believe is fake or was removed by the platform</b>: send us the link;
            if the source platform has taken the review down, we remove the quote and re-run the
            synthesis.
          </li>
          <li>
            <b>You disagree with our assessment</b>: our synthesis is our opinion based on quoted
            public reviews, and we don&apos;t remove accurate quotes because they&apos;re
            unflattering. What we will do: re-run your synthesis against your current reviews on
            request (once per quarter), so improvement shows up here. The fastest way to change
            your concerns section is to resolve the pattern your customers are writing about.
          </li>
          <li>
            <b>Claim your listing</b>: any plumber can claim their listing free to update
            business details and respond to our summary. A response, if you provide one, appears
            labeled as &ldquo;Owner response.&rdquo;
          </li>
        </ul>
        <p>
          We log every correction. Materially wrong published assessments are corrected with a
          dated note, not silently.
        </p>

        <h2>Who runs this</h2>
        <p>
          Fast Plumber Near Me is run by its own editorial team, based in Crystal Lake, Illinois.
          It&apos;s an independent site: no plumbing company, franchise network, or lead-gen
          broker owns any part of it. Revenue comes from clearly labeled sponsored placement —
          nothing else.
        </p>
        <p>
          Questions about this methodology:{" "}
          <a href="mailto:info@fastplumbernearme.com">info@fastplumbernearme.com</a> or the{" "}
          <Link href="/contact">contact form</Link>.
        </p>
      </div>
    </div>
  );
}
