import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import {
  getPlumberBySlug,
  getAllPlumberSlugs,
} from "@/lib/plumber-data";
import TrustScoreRing from "@/components/profile/TrustScoreRing";
import PriceSignal from "@/components/profile/PriceSignal";
import StarRating from "@/components/profile/StarRating";
import WarningBox from "@/components/profile/WarningBox";
import { QuoteCard, GoogleReviewCard } from "@/components/profile/ReviewCard";
import StickyBottomBar from "@/components/profile/StickyBottomBar";
import { CallButton, WebsiteButton, ProfileReportButton } from "@/components/profile/ProfileActions";
import BounceTracker from "@/components/profile/BounceTracker";

// ---------------------------------------------------------------------------
// Static generation
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return getAllPlumberSlugs().map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plumber = getPlumberBySlug(slug);
  if (!plumber) return {};

  const title = `${plumber.name} Reviews & Trust Score`;
  const description =
    plumber.synthesis?.summary ??
    `See honest reviews and trust score for ${plumber.name} in ${plumber.city}, IL.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
  return name
    .split(/[\s&]+/)
    .filter((w) => w.length > 0 && w[0] === w[0].toUpperCase())
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function getInitialsBg(name: string) {
  const colors = [
    "#1a365d", "#0F6E56", "#854F0B", "#6B21A8",
    "#0C447C", "#A32D2D", "#065F46", "#7C3AED",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getTrustPill(level: string) {
  switch (level) {
    case "high":
      return { color: "#0F6E56", bg: "#E1F5EE", label: "High trust" };
    case "moderate":
      return { color: "#854F0B", bg: "#FAEEDA", label: "Moderate trust" };
    case "low":
      return { color: "#A32D2D", bg: "#FCEBEB", label: "Low trust" };
    default:
      return { color: "#6B7280", bg: "#F3F4F6", label: "Unrated" };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  if (!plumber) notFound();

  const s = plumber.synthesis;
  const hasWarnings =
    (s?.weaknesses?.length ?? 0) > 0 ||
    (s?.redFlags?.length ?? 0) > 0 ||
    s?.priceSignal === "premium";

  const trustPill = getTrustPill(s?.trustLevel ?? "");
  const topReviews = plumber.reviews.slice(0, 3);

  // JSON-LD schemas
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://fastplumbernearme.com" },
      { "@type": "ListItem", position: 2, name: "Plumbers", item: "https://fastplumbernearme.com/plumbers" },
      { "@type": "ListItem", position: 3, name: plumber.name, item: `https://fastplumbernearme.com/plumber/${slug}` },
    ],
  };

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "Plumber",
    name: plumber.name,
    telephone: plumber.phone,
    address: { "@type": "PostalAddress", addressLocality: plumber.city, addressRegion: plumber.state },
    ...(plumber.website && { url: plumber.website }),
    ...(plumber.googleRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: plumber.googleRating,
        reviewCount: plumber.googleReviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
      <BounceTracker plumberId={slug} city={plumber.city} />

      <div className="max-w-[480px] mx-auto px-4 pt-4 pb-28 sm:pb-12 font-[family-name:var(--font-dm-sans)]">
        {/* Back link */}
        <a
          href="/plumbers"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All plumbers
        </a>

        {/* ============================================================= */}
        {/* HEADER */}
        {/* ============================================================= */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
            style={{ backgroundColor: getInitialsBg(plumber.name) }}
          >
            {getInitials(plumber.name)}
          </div>
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-gray-900 leading-tight">
              {plumber.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{plumber.city}, {plumber.state}</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#0F6E56" }} />
              <span className="text-xs font-medium" style={{ color: "#0F6E56" }}>
                Google verified
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* SCORE ROW — 3 cards */}
        {/* ============================================================= */}
        {s && (
          <div
            className="grid grid-cols-3 gap-2 mb-5"
          >
            <div className="rounded-xl py-3 flex flex-col items-center" style={{ border: "0.5px solid #E5E7EB" }}>
              <span className="text-[10px] text-gray-400 font-medium mb-1">Trust Score</span>
              <TrustScoreRing score={s.score} size="md" />
            </div>
            <div className="rounded-xl py-3 flex flex-col items-center" style={{ border: "0.5px solid #E5E7EB" }}>
              <span className="text-[10px] text-gray-400 font-medium mb-1">Google</span>
              <StarRating
                rating={plumber.googleRating ?? 0}
                count={plumber.googleReviewCount}
              />
            </div>
            <div className="rounded-xl py-3 flex flex-col items-center justify-between" style={{ border: "0.5px solid #E5E7EB" }}>
              <span className="text-[10px] text-gray-400 font-medium mb-1">Pricing</span>
              <PriceSignal signal={s.priceSignal} />
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* CTA BUTTONS */}
        {/* ============================================================= */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <CallButton phone={plumber.phone} plumberId={slug} city={plumber.city} />
          {plumber.website ? (
            <WebsiteButton url={plumber.website} plumberId={slug} city={plumber.city} />
          ) : (
            <div
              className="flex items-center justify-center py-3.5 rounded-xl text-sm text-gray-400 bg-gray-50"
              style={{ border: "0.5px solid #E5E7EB" }}
            >
              No website
            </div>
          )}
        </div>

        {/* ============================================================= */}
        {/* OUR ANALYSIS */}
        {/* ============================================================= */}
        {s && (
          <section className="mb-6">
            <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-2">
              Our analysis
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">{s.summary}</p>

            {/* Best For tags */}
            {s.bestFor.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {s.bestFor.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ color: "#0C447C", backgroundColor: "#E6F1FB" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ============================================================= */}
        {/* WATCH OUT FOR — bad news first */}
        {/* ============================================================= */}
        {s && hasWarnings && (
          <section className="mb-5">
            <WarningBox
              weaknesses={s.weaknesses}
              redFlags={s.redFlags}
              priceSignal={s.priceSignal}
            />
          </section>
        )}

        {/* ============================================================= */}
        {/* STRENGTHS */}
        {/* ============================================================= */}
        {s && s.strengths.length > 0 && (
          <section className="mb-6">
            <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-2">
              Strengths
            </h2>
            <ul className="space-y-2">
              {s.strengths.map((str) => (
                <li key={str} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle2
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: "#0F6E56" }}
                  />
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ============================================================= */}
        {/* CUSTOMER REVIEWS */}
        {/* ============================================================= */}
        <section className="mb-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-3">
            Customer reviews
          </h2>

          <div className="space-y-3">
            {s?.topQuote && (
              <QuoteCard
                quote={s.topQuote}
                variant="positive"
                label="Most helpful review"
              />
            )}

            {s?.worstQuote && (
              <QuoteCard
                quote={s.worstQuote}
                variant="negative"
                label="Customers report this"
              />
            )}
          </div>

          {/* Raw Google reviews */}
          {topReviews.length > 0 && (
            <div className="space-y-3 mt-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Recent Google reviews
              </p>
              {topReviews.map((review, i) => (
                <GoogleReviewCard
                  key={i}
                  author={review.author}
                  rating={review.rating}
                  text={review.text}
                  relativeTime={review.relativeTime}
                />
              ))}
            </div>
          )}
        </section>

        {/* ============================================================= */}
        {/* BUSINESS DETAILS */}
        {/* ============================================================= */}
        <section className="mb-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-3">
            Business details
          </h2>
          <div
            className="rounded-xl divide-y divide-gray-100"
            style={{ border: "0.5px solid #E5E7EB" }}
          >
            <DetailRow label="Phone" value={plumber.phone} />
            <DetailRow label="Address" value={plumber.address} />
            <DetailRow
              label="Hours"
              value={
                plumber.is24Hour ? (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" style={{ color: "#0F6E56" }} />
                    <span className="font-medium" style={{ color: "#0F6E56" }}>
                      Open 24 hours
                    </span>
                  </span>
                ) : plumber.workingHours ? (
                  <span className="text-gray-600 text-sm">Varies — check website</span>
                ) : (
                  "Not listed"
                )
              }
            />
            {s && (
              <>
                <DetailRow
                  label="Trust level"
                  value={
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        color: trustPill.color,
                        backgroundColor: trustPill.bg,
                      }}
                    >
                      {trustPill.label}
                    </span>
                  }
                />
              </>
            )}
          </div>
        </section>

        {/* Report button */}
        <ProfileReportButton plumberId={slug} city={plumber.city} />

        {/* ============================================================= */}
        {/* FOOTER */}
        {/* ============================================================= */}
        <footer className="text-center text-xs text-gray-400 pt-2 pb-4">
          Last updated {formatDate(plumber.scrapedAt)} &middot; Data from Google
          Reviews + AI analysis
        </footer>
      </div>

      {/* Sticky bottom bar (mobile only) */}
      {s && (
        <StickyBottomBar
          name={plumber.name}
          score={s.score}
          rating={plumber.googleRating}
          priceSignal={s.priceSignal}
          phone={plumber.phone}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-xs text-gray-400 font-medium shrink-0 pt-0.5">
        {label}
      </span>
      <div className="text-sm text-gray-700 text-right">{value}</div>
    </div>
  );
}
