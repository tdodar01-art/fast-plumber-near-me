import type { Metadata } from "next";
import Link from "next/link";
import MarketSearch, { type SearchMarket } from "@/components/rebuild/MarketSearch";
import UseMyLocation from "@/components/UseMyLocation";
import PlumberReportCard from "@/components/rebuild/PlumberReportCard";
import { getMarkets, getMarketPlumbers, type Market } from "@/lib/markets";
import { getAllPlumbers, type SynthesizedPlumber } from "@/lib/plumber-data";
import { cardTier, cardEvidence, quotePair } from "@/lib/report-card";
import { absoluteUrl } from "@/config/plumbing-routes";
import { organizationLd, webSiteLd, jsonLdString } from "@/lib/schema";
import { ogImagePath } from "@/lib/meta";

/**
 * Homepage — 04 §2 copy verbatim in 02 §2 layout (C7). Search-first hero,
 * computed proof strip, a REAL rendered example card (show, don't claim),
 * 04's "How it works" + "Why we're different", real-count city grid.
 * No verification claims, no urgency theatre, no badges (hard rule 1).
 */

const HOME_DESCRIPTION =
  "We read the public reviews of every plumber we list — Google, Yelp, BBB — and publish the strengths and complaints with the customer quotes to back it up.";

export const metadata: Metadata = {
  title: "Fast Plumber Near Me — We Read the Reviews, Including the Bad Ones",
  description: HOME_DESCRIPTION,
  alternates: { canonical: absoluteUrl() },
  openGraph: {
    title: "Fast Plumber Near Me — We Read the Reviews, Including the Bad Ones",
    description: HOME_DESCRIPTION,
    url: absoluteUrl(),
    type: "website",
    images: [
      {
        url: ogImagePath({ type: "city", title: "Plumbers ranked by real reviews" }),
        width: 1200,
        height: 630,
      },
    ],
  },
};

// Organization (@id: /#org) + WebSite with SearchAction targeting
// /plumbers?q={search_term_string} — the national index prefills its
// client-side market search from ?q= (spec §2 table; 01 §2.1).
const homeJsonLd = [organizationLd(), webSiteLd()];

/**
 * Deterministic example pick for the show-don't-tell section: the first
 * ranked plumber (walking markets by quote-backed depth) whose card shows
 * real contrast — a strong verdict AND a quotable critical review AND a
 * concern. No randomness: same record every build until the data changes.
 */
function pickExample(): { plumber: SynthesizedPlumber; market: Market } | null {
  const markets = [...getMarkets()].sort(
    (a, b) => b.counts.rankableQuoted - a.counts.rankableQuoted,
  );
  for (const market of markets.slice(0, 40)) {
    const ranked = getMarketPlumbers(market)
      .filter((p) => p.synthesis && (p.evidence_quotes?.length ?? 0) >= 1)
      .slice(0, 15);
    for (const p of ranked) {
      if (cardTier(p).tier !== "top") continue;
      if ((p.reviews?.length ?? 0) < 10) continue;
      if (p.googleReviewCount < 500) continue;
      const pair = quotePair(p);
      if (!pair.negative || !pair.positive) continue;
      if (cardEvidence(p).concerns.length === 0) continue;
      return { plumber: p, market };
    }
  }
  return null;
}

export default function HomePage() {
  const markets = getMarkets();
  const allPlumbers = getAllPlumbers();

  // Proof strip — every number computed from the dataset at build time.
  const totalTracked = allPlumbers.length;
  const totalGuides = markets.length;

  const searchMarkets: SearchMarket[] = markets.map((m) => ({
    name: m.name,
    st: m.st,
    slug: m.slug,
    lat: m.lat,
    lng: m.lng,
    plumbers: m.counts.plumbers,
    emergency: m.counts.emergency,
  }));

  const locationMarkets = markets.map((m) => ({
    name: m.name,
    st: m.st,
    slug: m.slug,
    lat: m.lat,
    lng: m.lng,
  }));

  const featured = [...markets]
    .sort((a, b) => b.counts.rankableQuoted - a.counts.rankableQuoted)
    .slice(0, 12);

  const example = pickExample();

  return (
    <div className="fpn">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd) }} />

      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="wrap-wide">
          <h1>A burst pipe doesn&apos;t leave time to read 200 reviews. We already did.</h1>
          <p className="sub">
            We summarize the public reviews of 6,000+ plumbers — Google, Yelp, and BBB — and show
            you the strengths <b>and</b> the complaints, quoted word-for-word. The negative
            reviews other directories bury are the first thing we look for.
          </p>

          <MarketSearch markets={searchMarkets} />
          <UseMyLocation markets={locationMarkets} />

          <div className="proof num">
            <span>
              <b>{totalTracked.toLocaleString()}</b> plumbers tracked
            </span>
            <span>
              <b>{totalGuides.toLocaleString()}</b> city guides
            </span>
            <span>
              Reviews read from <b>Google, Yelp &amp; BBB</b>
            </span>
          </div>
        </div>
      </section>

      {/* ============ SHOW, DON'T TELL — a real rendered card ============ */}
      {example && (
        <section className="show-dont-tell">
          <div className="wrap-wide">
            <div className="sec-head">
              <h2>
                Every plumber looks great at 4.9 stars.
                <br />
                Here&apos;s what we show you instead.
              </h2>
              <p>
                A real listing from our{" "}
                <Link href={`/plumbers/${example.market.st}/${example.market.slug}`}>
                  {example.market.name}, {example.market.st.toUpperCase()} guide
                </Link>{" "}
                — nothing edited.
              </p>
            </div>

            <div className="sample-grid">
              <PlumberReportCard
                plumber={example.plumber}
                rank={1}
                center={{
                  lat: example.market.lat,
                  lng: example.market.lng,
                  label: `downtown ${example.market.name}`,
                }}
              />

              <div className="annos">
                <div className="anno b">
                  <h4>The concerns other directories hide</h4>
                  <p>
                    Negative patterns get equal billing with the praise — even for our top picks.
                    A single written complaint usually speaks for several customers who never
                    wrote one.
                  </p>
                </div>
                <div className="anno g">
                  <h4>Verbatim quotes, always attributed</h4>
                  <p>
                    Every quote is copied word-for-word from a public review with its author, star
                    rating, platform and date. We never paraphrase and call it a quote.
                  </p>
                </div>
                <div className="anno a">
                  <h4>The rating mix, not just the average</h4>
                  <p>
                    A 4.8 average can hide a pile of one-star reviews. We show the distribution of
                    every review we analyzed — on every single listing.
                  </p>
                </div>
                <div className="anno">
                  <h4>A judgment you can argue with</h4>
                  <p>
                    &ldquo;Our take&rdquo; is an opinion, formed from the evidence shown right
                    below it. Check the quotes and disagree with us — that&apos;s the point of
                    showing our work.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ HOW IT WORKS (04 §2) ============ */}
      <section className="steps">
        <div className="wrap-wide narrow">
          <div className="sec-head">
            <h2>How it works</h2>
          </div>
          <div className="steps-grid">
            <div className="step">
              <h3>
                <span className="step-n">1.</span>We collect the reviews.
              </h3>
              <p>
                For every plumber we list, we pull their public reviews from Google, Yelp, and the
                Better Business Bureau — hundreds per company, not the five happiest.
              </p>
            </div>
            <div className="step">
              <h3>
                <span className="step-n">2.</span>We read them and take a side.
              </h3>
              <p>
                Our editors, with AI assistance, distill each plumber&apos;s reviews into
                plain-English strengths and concerns. If three customers mention surprise fees,
                you&apos;ll see it — with their exact words, names, and dates.
              </p>
            </div>
            <div className="step">
              <h3>
                <span className="step-n">3.</span>You call with your eyes open.
              </h3>
              <p>
                No account, no forms, no lead auction. Pick a plumber knowing what past customers
                loved and what they complained about, and tap to call them directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHY WE'RE DIFFERENT (04 §2) ============ */}
      <section className="commit">
        <div className="wrap-wide narrow">
          <div className="sec-head">
            <h2>Why we&apos;re different</h2>
          </div>
          <div className="commit-grid">
            <div className="c-item">
              <h3>
                <span className="dot" style={{ background: "var(--bad)" }} />
                We publish the complaints.
              </h3>
              <p>
                Every directory shows you star ratings. We quote the one-star reviews — verbatim
                and attributed — because a single written complaint usually speaks for several
                customers who never wrote one. If a plumber has a pattern of no-shows or growing
                invoices, it&apos;s on their card, not hidden in page four of their Google
                reviews.
              </p>
            </div>
            <div className="c-item">
              <h3>
                <span className="dot" style={{ background: "var(--action)" }} />
                Plumbers can&apos;t pay to change what we write.
              </h3>
              <p>
                We sell advertising placement, and we label it. What we never sell is the
                assessment. A sponsored plumber&apos;s concerns section reads exactly as it would
                if they&apos;d never paid us — and plumbers below our quality bar can&apos;t buy
                placement at all. <Link href="/methodology">How our ranking works →</Link>
              </p>
            </div>
            <div className="c-item">
              <h3>
                <span className="dot" style={{ background: "var(--good)" }} />
                Our opinion, their words.
              </h3>
              <p>
                Everything we say about a plumber is grounded in quoted customer reviews you can
                read yourself. We show the full rating picture, link every claim to its source
                quotes, and correct mistakes fast when a plumber disputes something.{" "}
                <Link href="/methodology#corrections">Our correction policy →</Link>
              </p>
            </div>
            <div className="c-item">
              <h3>
                <span className="dot" style={{ background: "var(--ink)" }} />
                One job: help you pick.
              </h3>
              <p>
                We don&apos;t sell your info to four plumbers who&apos;ll all call you back
                (that&apos;s the other guys&apos; business model). You browse free and anonymous,
                and you call the plumber yourself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FIND YOUR CITY ============ */}
      <section className="cities">
        <div className="wrap-wide">
          <div className="sec-head">
            <h2>Find your city guide</h2>
            <p>Each guide ranks every plumber serving that city, with our full review analysis.</p>
          </div>
          <div className="city-grid">
            {featured.map((m) => (
              <Link key={`${m.st}-${m.slug}`} href={`/plumbers/${m.st}/${m.slug}`}>
                {m.name}, {m.st.toUpperCase()}
                <span className="num">
                  {m.counts.plumbers} plumbers
                  {m.counts.emergency > 0 ? ` · ${m.counts.emergency} list 24/7` : ""}
                </span>
              </Link>
            ))}
          </div>
          <p className="all-states">
            <Link href="/plumbers">Browse all states A–Z →</Link>
          </p>
        </div>
      </section>

      {/* ============ FOR PLUMBERS ============ */}
      <section className="pro-band">
        <div className="wrap-wide">
          <h2>Run a plumbing company?</h2>
          <p className="serif">
            You can pay to be <b>seen</b> — a clearly labeled sponsored slot at the top of your
            city&apos;s guide. You can&apos;t pay to be <b>trusted</b>; that part only comes from
            your reviews.
          </p>
          <Link className="cta" href="/add-your-business">
            See how sponsorship works →
          </Link>
        </div>
      </section>
    </div>
  );
}
