import type { Metadata } from "next";
import Link from "next/link";
import JobFinder from "@/components/curated/JobFinder";
import { getMarkets, getMarketPlumbers } from "@/lib/markets";
import { getAllPlumbers } from "@/lib/plumber-data";
import { shortlistData } from "@/lib/shortlist-data";
import { selectShortlist } from "@/lib/shortlist";
import { absoluteUrl } from "@/config/plumbing-routes";
import { organizationLd, webSiteLd, jsonLdString } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Who Should You Call? | Fast Plumber Near Me",
  description:
    "Find a plumber for your problem. Compare curated suggestions, review evidence, and pricing concerns, then call directly. Free, with no lead auction.",
  alternates: { canonical: absoluteUrl() },
  openGraph: {
    title: "A better way to choose your next plumber.",
    description: "A short list. Clear reasons. A more confident call.",
    url: absoluteUrl(),
    type: "website",
  },
};

export default function HomePage() {
  const markets = getMarkets();
  const businesses = getAllPlumbers();
  const exampleMarket =
    [...markets]
      .sort((a, b) => b.counts.rankableQuoted - a.counts.rankableQuoted)
      .find(
        (m) =>
          selectShortlist(getMarketPlumbers(m).map(shortlistData), "any", false)
            .length >= 2,
      ) ?? markets[0];
  const examples = exampleMarket
    ? selectShortlist(
        getMarketPlumbers(exampleMarket).map(shortlistData),
        "any",
        false,
      )
    : [];
  const featured = [...markets]
    .sort((a, b) => b.counts.rankableQuoted - a.counts.rankableQuoted)
    .slice(0, 8);
  const states = new Set(markets.map((m) => m.st)).size;
  const searchMarkets = markets.map((m) => ({
    name: m.name,
    st: m.st,
    slug: m.slug,
    lat: m.lat,
    lng: m.lng,
    plumbers: m.counts.plumbers,
    emergency: m.counts.emergency,
  }));
  return (
    <div className="fpn curated-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([organizationLd(), webSiteLd()]),
        }}
      />
      <section className="curated-hero">
        <div className="curated-container hero-layout">
          <div className="hero-story">
            <div className="hero-kicker">
              <span className="status-dot" /> INDEPENDENT PLUMBER
              RECOMMENDATIONS
            </div>
            <h1>
              Good plumbers.
              <br />
              Clear reasons.
              <br />
              <em>No sales pitch.</em>
            </h1>
            <p className="hero-description">
              Find the plumber who earns your trust. We look for fair dealing,
              reliable work, and clear pricing—and flag the review patterns you
              should ask about.
            </p>
            <div className="hero-assurances">
              <span>↗ Call businesses directly</span>
              <span>✓ Your details aren’t sold</span>
            </div>
          </div>
          <JobFinder markets={searchMarkets} />
        </div>
        <div className="curated-container hero-bottom">
          <span>LESS SEARCHING. BETTER QUESTIONS. MORE CONFIDENCE.</span>
          <span>
            Built from public reviews. Clear about what we don’t know.
          </span>
        </div>
      </section>
      <section className="curated-proof">
        <div className="curated-container proof-layout">
          <div>
            <b>{businesses.length.toLocaleString()}</b>
            <span>businesses in our directory</span>
          </div>
          <div>
            <b>{markets.length.toLocaleString()}</b>
            <span>local guides across {states} states</span>
          </div>
          <p>
            A big ad budget isn’t a recommendation.
            <br />
            <strong>We help you make sense of them.</strong>
          </p>
          <Link href="/methodology">
            How suggestions work <span>↗</span>
          </Link>
        </div>
      </section>
      <section className="curated-container editorial-section">
        <div className="editorial-heading">
          <div>
            <span className="eyebrow">THE SHORTLIST, EXPLAINED</span>
            <h2>
              Good advice has
              <br />
              <em>reasons behind it.</em>
            </h2>
          </div>
          <p>
            A star rating is a starting point. We bring together job-specific
            review evidence, concerns, and the limits of our analysis so you can
            decide what matters.
          </p>
        </div>
        <div className="explainer-layout">
          <div className="explain-steps">
            <div>
              <span>01</span>
              <section>
                <h3>Start with your problem.</h3>
                <p>
                  A blocked drain and a water heater installation need different
                  experience. Tell us what you need.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Understand your options.</h3>
                <p>
                  See up to three suggestions with the evidence behind each.
                  Small review samples are called out.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Make a better first call.</h3>
                <p>
                  Compare the options and take a question tailored to your job.
                  You call the plumber directly.
                </p>
              </section>
            </div>
            <Link className="text-arrow" href="#find">
              Find my next call ↗
            </Link>
          </div>
          <div className="shortlist-preview">
            <div className="preview-header">
              <span className="eyebrow">A REAL GUIDE. REAL BUSINESSES.</span>
              <span>↗</span>
            </div>
            <h3>
              {exampleMarket?.name}, {exampleMarket?.st.toUpperCase()}
            </h3>
            <p className="preview-sub">A look inside the shortlist</p>
            {examples.map((p, i) => (
              <Link
                className="preview-business"
                key={p.id}
                href={`/plumber/${p.slug}`}
              >
                <span className="preview-number">0{i + 1}</span>
                <div>
                  <b>{p.name}</b>
                  <small>
                    {p.analyzed} reviews analyzed ·{" "}
                    {p.analyzed < 10
                      ? "Limited evidence"
                      : "See strengths & concerns"}
                  </small>
                </div>
                <span>↗</span>
              </Link>
            ))}
            <div className="preview-foot">
              No paid position in these suggestions.
              <Link
                href={
                  exampleMarket
                    ? `/plumbers/${exampleMarket.st}/${exampleMarket.slug}#shortlist`
                    : "/plumbers"
                }
              >
                Explore this guide →
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="curated-principles">
        <div className="curated-container">
          <span className="eyebrow">
            A LITTLE MORE CLARITY. A LOT LESS NOISE.
          </span>
          <div className="principles-grid">
            <div>
              <span>↗</span>
              <h3>Fair dealing comes first.</h3>
              <p>
                We look for specific evidence of clear estimates, honest repair
                advice, and no-pressure service. Repeated, cited sales-pressure
                concerns hold a business back.
              </p>
            </div>
            <div>
              <span>◎</span>
              <h3>Evidence over badges.</h3>
              <p>
                Reviews are evidence of past experiences, not proof of
                licensing, availability, or future results.
              </p>
            </div>
            <div>
              <span>↔</span>
              <h3>You stay in control.</h3>
              <p>
                No contact form to unlock a phone number. No auctioning your
                details. Choose, compare, and call.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="curated-container editorial-section">
        <div className="editorial-heading">
          <div>
            <span className="eyebrow">NATIONAL REACH. LOCAL DECISIONS.</span>
            <h2>
              Your city.
              <br />
              <em>Your next good call.</em>
            </h2>
          </div>
          <div>
            <p>
              Explore the directory. Coverage and review depth vary by market;
              every shortlist explains its evidence.
            </p>
            <Link className="text-arrow" href="/plumbers">
              Browse all locations ↗
            </Link>
          </div>
        </div>
        <div className="curated-market-grid">
          {featured.map((m) => (
            <Link
              key={`${m.st}/${m.slug}`}
              href={`/plumbers/${m.st}/${m.slug}`}
            >
              <span className="market-state">{m.st.toUpperCase()}</span>
              <h3>{m.name}</h3>
              <span>{m.counts.plumbers} businesses in this guide</span>
              <b>↗</b>
            </Link>
          ))}
        </div>
      </section>
      <section className="curated-final">
        <div className="curated-container">
          <span className="eyebrow">ONE LESS THING TO FIGURE OUT.</span>
          <h2>
            You don’t need more tabs.
            <br />
            <em>You need a next step.</em>
          </h2>
          <Link href="#find">Build my shortlist ↗</Link>
          <p>Free to use. No sign-up. Call directly.</p>
        </div>
      </section>
    </div>
  );
}
