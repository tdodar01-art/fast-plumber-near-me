import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getPlumberBySlug,
  getAllPlumberSlugs,
  resolveLegacySlug,
  type SynthesizedPlumber,
} from "@/lib/plumber-data";
import { isIndexablePlumber } from "@/lib/indexable";
import { absoluteUrl, businessProfilePath } from "@/config/plumbing-routes";
import { breadcrumbLd, plumberFullEntity, jsonLdString } from "@/lib/schema";
import { fitDescription, ogImagePath } from "@/lib/meta";
import {
  ratingMix,
  reviewsReadCount,
  newestReviewLabel,
  formatPhone,
  telHref,
  emergencyHonesty,
} from "@/lib/report-card";
import {
  verdictInfo,
  dimensionBars,
  dossierClaims,
  evidenceLedger,
  platformPicture,
  marketRankContext,
  homeMarket,
  nearbyMarketLinks,
  serviceChips,
  hoursTable,
  analysisUpdatedLabel,
  scrapedLabel as scrapedDateLabel,
} from "@/lib/profile-dossier";
import VerdictBanner from "@/components/rebuild/profile/VerdictBanner";
import ClaimWithEvidence from "@/components/rebuild/profile/ClaimWithEvidence";
import RatingPicture from "@/components/rebuild/profile/RatingPicture";
import DecisionGrid from "@/components/rebuild/profile/DecisionGrid";
import FactsPanel from "@/components/rebuild/profile/FactsPanel";
import OwnerPanel from "@/components/rebuild/profile/OwnerPanel";
import CompareStrip from "@/components/rebuild/profile/CompareStrip";
import EvidenceLedgerSection from "@/components/rebuild/profile/EvidenceLedger";
import MethodologyFooter from "@/components/rebuild/profile/MethodologyFooter";
import ProfileCtas from "@/components/rebuild/profile/ProfileCtas";
import StickyCallBar from "@/components/rebuild/StickyCallBar";
import BounceTracker from "@/components/profile/BounceTracker";
import { StarIcon, ClockIcon, PinIcon } from "@/components/rebuild/icons";

// ---------------------------------------------------------------------------
// Static generation — every profile is statically generated from the
// committed JSON (zero runtime Firestore on the crawl path). Non-indexable
// records still render (users navigate to them from city pages) but carry
// noindex,follow via isIndexablePlumber.
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return getAllPlumberSlugs().map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Metadata (C9: profile owner's title formula, ≤60-char fallback)
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plumber = getPlumberBySlug(slug);
  if (!plumber) return {};

  const cityPart = `${plumber.city}, ${plumber.state}`;
  const full = `${plumber.name} Reviews — Our Take on ${plumber.googleReviewCount.toLocaleString()} Reviews | ${cityPart}`;
  const title = full.length <= 60 ? full : `${plumber.name} Reviews | ${cityPart}`;

  const description = fitDescription(
    plumber.synthesis?.summary
      ? `Our take: ${plumber.synthesis.summary}`
      : `${plumber.name} in ${cityPart}: business facts, hours, and contact info. Our review analysis for this plumber is in progress.`,
  );
  const canonical = absoluteUrl(businessProfilePath(slug));

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [
        {
          url: ogImagePath({
            type: "city",
            city: plumber.city,
            state: plumber.state,
            title: plumber.name,
          }),
          width: 1200,
          height: 630,
        },
      ],
    },
    ...(isIndexablePlumber(plumber) ? {} : { robots: { index: false, follow: true } }),
  };
}

// ---------------------------------------------------------------------------
// JSON-LD — BreadcrumbList + Plumber entity ONLY (C1: zero Review /
// AggregateRating / positiveNotes / negativeNotes markup anywhere).
// ---------------------------------------------------------------------------

function jsonLd(p: SynthesizedPlumber, slug: string, crumb: { label: string; href: string }) {
  return [
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: crumb.label, path: crumb.href },
      { name: p.name, path: businessProfilePath(slug) },
    ]),
    // Full Plumber entity (@id: {url}#business): 01 §2.1 field map + opinion-
    // framed description from synthesis.summary. No aggregateRating, no
    // review (C1), even though the visible page shows both freely.
    plumberFullEntity(p),
  ];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PlumberProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const plumber = getPlumberBySlug(slug);
  if (!plumber) {
    // Pre-2026-06 name-only URLs are indexed by Google — 308-redirect them to
    // the new canonical slug rather than 404ing.
    const newSlug = resolveLegacySlug(slug);
    if (newSlug) permanentRedirect(businessProfilePath(newSlug));
    notFound();
  }

  const p = plumber;
  const syn = p.synthesis;

  // --- computed dossier (pipeline output only; no page-side re-derivation) ---
  const verdict = syn ? verdictInfo(p) : null;
  const dims = dimensionBars(p);
  const claims = syn ? dossierClaims(p) : null;
  const mix = ratingMix(p);
  const platforms = platformPicture(p);
  const rankCtx = marketRankContext(p);
  const market = homeMarket(p);
  const nearby = nearbyMarketLinks(p);
  const services = serviceChips(p);
  const hours = hoursTable(p);
  const read = reviewsReadCount(p);
  const newest = newestReviewLabel(p);
  const analysisLabel = analysisUpdatedLabel(p);
  const pulledLabel = scrapedDateLabel(p);
  const honesty = emergencyHonesty(p);

  // Breadcrumb parent: the market page that lists this plumber; else the
  // nearest covered market; else the national index.
  const crumb = market
    ? { label: `Plumbers in ${market.name}, ${market.st.toUpperCase()}`, href: `/plumbers/${market.st}/${market.slug}` }
    : nearby.length > 0
      ? { label: `Plumbers in ${nearby[0].name}, ${nearby[0].st.toUpperCase()}`, href: `/plumbers/${nearby[0].st}/${nearby[0].slug}` }
      : { label: "Plumbers", href: "/plumbers" };

  const contactHref = `/contact?about=${encodeURIComponent(slug)}`;
  const smallSample = mix != null && mix.smallSample;

  // Ledger renders only quotes not already shown inside claims.
  const shownTexts = claims
    ? [...claims.strengths, ...claims.concerns].flatMap((c) => c.quotes.map((q) => q.text))
    : [];
  const ledger = evidenceLedger(p, shownTexts);

  // Fairness counterweight numbers (03 §3.4.2) — computed, never invented.
  const concernCount = claims ? Math.min(claims.concernReviewIdCount, read) : 0;

  return (
    <div className="fpn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd(p, slug, crumb)) }}
      />
      <BounceTracker plumberId={slug} city={p.city} />

      <div className="wrap-wide">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href={crumb.href}>{crumb.label}</Link> ›{" "}
          <span>{p.name}</span>
        </nav>

        <div className="pf-cols">
          <main className="pf-main">
            {/* ============ HEADER (LCP: pure text) ============ */}
            <header className="pf-header">
              <h1 className="report-h1">{p.name}</h1>
              <p className="pf-sub">
                Plumber · {p.city}, {p.state}
                {p.is24Hour ? (
                  <>
                    {" "}
                    · <ClockIcon size={14} /> Open 24 hours{" "}
                    <span className="qualifier">per Google listing</span>
                  </>
                ) : null}
              </p>

              {/* Cross-platform rating strip — the honest hook */}
              {(p.googleRating != null || platforms) && (
                <div className="pf-ratingstrip num">
                  {p.googleRating != null && (
                    <span className="rs-item">
                      <StarIcon size={13} className="star-glyph" />
                      <b>{p.googleRating.toFixed(1)}</b>
                      <span className="rs-src">
                        Google · {p.googleReviewCount.toLocaleString()} reviews
                      </span>
                    </span>
                  )}
                  {typeof p.yelpRating === "number" && p.yelpRating > 0 && (
                    <span className="rs-item">
                      <StarIcon size={13} className="star-glyph" />
                      <b>{p.yelpRating.toFixed(1)}</b>
                      <span className="rs-src">
                        Yelp{p.yelpReviewCount ? ` · ${p.yelpReviewCount.toLocaleString()} reviews` : ""}
                      </span>
                    </span>
                  )}
                  {p.bbb?.rating && (
                    <span className="rs-item">
                      <b>{p.bbb.rating}</b>
                      <span className="rs-src">BBB{p.bbb.accredited ? " · Accredited" : ""}</span>
                    </span>
                  )}
                  {platforms?.gapChip && (
                    <a className="gap-chip" href="#rating-picture">
                      Platforms disagree — see why
                    </a>
                  )}
                </div>
              )}

              {p.phone && (
                <ProfileCtas
                  telHref={telHref(p.phone)}
                  phoneLabel={formatPhone(p.phone)}
                  website={p.website}
                  slug={slug}
                  name={p.name}
                  city={p.city}
                  state={p.state}
                  phone={p.phone}
                />
              )}
            </header>

            {/* ============ THE VERDICT ============ */}
            {syn && verdict ? (
              <VerdictBanner
                plumber={p}
                verdict={verdict}
                dims={dims}
                rankCtx={rankCtx}
                reviewsRead={read}
                updatedLabel={analysisLabel}
                anchorId="verdict"
              />
            ) : (
              <div className="pf-pending">
                <p>
                  <b>Analysis in progress.</b> We haven&apos;t read enough of this plumber&apos;s
                  reviews to publish an assessment yet — the business facts below come from their
                  Google listing. <Link href="/methodology">How our assessments work →</Link>
                </p>
              </div>
            )}

            {honesty && <p className="pf-honesty">{honesty}</p>}
            {smallSample && syn && (
              <p className="pf-honesty">
                Only {mix.analyzed} review{mix.analyzed === 1 ? "" : "s"} analyzed — treat this
                assessment as a first impression, not a track record.
              </p>
            )}

            {/* ============ PRAISE ============ */}
            {claims && claims.strengths.length > 0 && (
              <section aria-labelledby="praise-h" className="pf-section">
                <h2 id="praise-h">What reviewers praise</h2>
                {claims.strengths.map((c, i) => (
                  <ClaimWithEvidence key={i} claim={c} reviewsRead={read} />
                ))}
              </section>
            )}

            {/* ============ CONCERNS (equal-or-greater weight, never collapsed) ============ */}
            {claims && (
              <section aria-labelledby="concerns-h" className="pf-section">
                <h2 id="concerns-h">What reviewers report — the concerns</h2>
                {claims.concerns.length > 0 ? (
                  <>
                    <p className="pf-sectionnote">
                      Other directories bury these. We think you should read them before you
                      call. Every concern below comes from the reviews it cites.
                    </p>
                    {claims.concerns.map((c, i) => (
                      <ClaimWithEvidence key={i} claim={c} reviewsRead={read} />
                    ))}
                    {concernCount > 0 && (
                      <p className="fairness num">
                        <b>Keep it in proportion:</b> these concerns are cited in {concernCount} of
                        the {read} reviews we analyzed. Most reviewers report positive experiences
                        — see the full rating picture below.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="fairness">
                    We looked for patterns of complaints in the {read} reviews we analyzed and
                    didn&apos;t find any. That&apos;s rare — but it&apos;s a reading of published
                    reviews, not a guarantee.
                  </p>
                )}
              </section>
            )}

            {/* ============ EVIDENCE LEDGER ============ */}
            {syn && <EvidenceLedgerSection ledger={ledger} contactHref={contactHref} />}

            {/* ============ RATING PICTURE ============ */}
            <RatingPicture
              mix={mix}
              googleReviewCount={p.googleReviewCount}
              platforms={platforms}
              newestLabel={newest}
            />

            {/* ============ DECISION GRID ============ */}
            {p.decision && <DecisionGrid decision={p.decision} name={p.name} />}

            {/* Facts panel lands here in the mobile flow (03 §3): rendered in
                the rail on desktop via CSS order, single column on mobile. */}

            {/* ============ OWNER PANEL ============ */}
            <OwnerPanel name={p.name} slug={slug} />

            {/* ============ COMPARE & CONTINUE ============ */}
            <CompareStrip rankCtx={rankCtx} nearby={nearby} currentName={p.name} />

            {/* ============ METHODOLOGY FOOTER ============ */}
            <MethodologyFooter
              scrapedLabel={pulledLabel}
              analysisLabel={syn ? analysisLabel : null}
              contactHref={contactHref}
            />
          </main>

          {/* ============ FACTS RAIL ============ */}
          <aside className="pf-rail">
            <FactsPanel
              plumber={p}
              hours={hours}
              services={services}
              nearby={nearby}
              scrapedLabel={pulledLabel}
              analysisLabel={syn ? analysisLabel : null}
            />
            {market && (
              <p className="pf-railnote">
                <PinIcon size={13} />{" "}
                <Link href={`/plumbers/${market.st}/${market.slug}`}>
                  All plumbers we&apos;ve reviewed in {market.name}, {market.st.toUpperCase()} →
                </Link>
              </p>
            )}
          </aside>
        </div>
      </div>

      {p.phone && (
        <StickyCallBar
          name={p.name}
          telHref={telHref(p.phone)}
          targetId="verdict"
          is24Hour={p.is24Hour}
          capLabel={verdict ? verdict.short : "Call directly"}
        />
      )}
    </div>
  );
}
