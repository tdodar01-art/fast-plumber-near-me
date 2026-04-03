import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Zap,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  MapPin,
  Clock,
  ArrowLeft,
  Star,
  MessageCircle,
  Home,
  CheckCircle2,
} from "lucide-react";
import {
  getPlumberBySlug,
  getAllPlumberSlugs,
} from "@/lib/plumber-data";
import { QuoteCard, GoogleReviewCard } from "@/components/profile/ReviewCard";
import StickyBottomBar from "@/components/profile/StickyBottomBar";
import { CallButton, WebsiteButton, ProfileReportButton } from "@/components/profile/ProfileActions";
import BounceTracker from "@/components/profile/BounceTracker";
import { calculateDistance } from "@/lib/geo";
import { getCityCoords } from "@/lib/city-coords";

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

  const title = `${plumber.name} — Reviews & Emergency Response | ${plumber.city}, ${plumber.state}`;
  const description =
    plumber.synthesis?.summary ??
    `See honest reviews, response times, and red flags for ${plumber.name} in ${plumber.city}, ${plumber.state}. Real data from ${plumber.googleReviewCount} Google reviews.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
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
  const colors = ["#1a365d", "#0F6E56", "#854F0B", "#6B21A8", "#0C447C", "#A32D2D", "#065F46", "#7C3AED"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Derive KPI data from synthesis
function getResponseKPI(s: { strengths: string[]; emergencySignals?: string[]; redFlags?: string[] } | null, badges: string[]) {
  if (!s) return { label: "Unknown", color: "gray", subtitle: "No response data yet" };
  if (badges.includes("Fast Responder")) {
    const mention = s.strengths.find((st) => st.includes("reviewers mention fast"));
    return { label: "Fast Response", color: "green", subtitle: mention || "Reviewers confirm quick response" };
  }
  if (s.emergencySignals && s.emergencySignals.some((e) => e.includes("same day"))) {
    return { label: "Same Day", color: "green", subtitle: "Same-day service mentioned in reviews" };
  }
  if (s.emergencySignals && s.emergencySignals.length > 0) {
    return { label: "Available", color: "amber", subtitle: s.emergencySignals[0] };
  }
  return { label: "Unknown", color: "gray", subtitle: "No response data yet" };
}

function getEmergencyKPI(s: { emergencySignals?: string[] } | null, badges: string[], is24Hour: boolean) {
  if (badges.includes("24/7 Verified by Reviews")) {
    const mention = s?.emergencySignals?.find((e) => e.includes("reviews mention"));
    return { label: "24/7 Verified", color: "green", subtitle: mention || "Confirmed by reviews" };
  }
  if (is24Hour && s?.emergencySignals && s.emergencySignals.length > 0) {
    return { label: "After-Hours", color: "green", subtitle: "Emergency availability mentioned" };
  }
  if (is24Hour) {
    return { label: "Claims 24/7", color: "amber", subtitle: "Self-reported — not confirmed by reviews" };
  }
  return { label: "Not Verified", color: "gray", subtitle: "No emergency data in reviews" };
}

const colorClasses = {
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  gray: { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" },
};

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
  const badges = s?.strengths ? [] as string[] : [];
  // Extract badges from the plumber-data synthesis format
  const allBadges: string[] = [];
  if (s) {
    // The plumber-data format doesn't have explicit badges — derive from strengths
    if (s.strengths.some((st: string) => st.toLowerCase().includes("fast") || st.toLowerCase().includes("quick") || st.toLowerCase().includes("prompt"))) allBadges.push("Fast Responder");
    if (s.strengths.some((st: string) => st.toLowerCase().includes("fair") || st.toLowerCase().includes("reasonable") || st.toLowerCase().includes("affordable"))) allBadges.push("Fair Pricing");
    if (s.strengths.some((st: string) => st.toLowerCase().includes("professional") || st.toLowerCase().includes("courteous"))) allBadges.push("Clean & Professional");
    if (s.strengths.some((st: string) => st.toLowerCase().includes("communicat") || st.toLowerCase().includes("explain"))) allBadges.push("Good Communicator");
    if (s.bestFor?.some((b: string) => b.toLowerCase().includes("emergency") || b.toLowerCase().includes("24/"))) allBadges.push("24/7 Verified by Reviews");
    if (s.strengths.some((st: string) => st.toLowerCase().includes("clean up") || st.toLowerCase().includes("tidy"))) allBadges.push("Respects Your Home");
  }

  // --- SIGNAL DETECTION: scan review text for signals the old synthesis missed ---
  const UPSELL_KEYWORDS = ["member", "membership", "diamond member", "prestige", "club", "annual plan", "service agreement", "maintenance plan", "subscription", "upsell", "upselling", "tried to sell", "pushed us to", "package deal"];
  const reviewTexts = plumber.reviews.map((r) => r.text.toLowerCase());
  const upsellMentions = reviewTexts.filter((t) => UPSELL_KEYWORDS.some((k) => t.includes(k))).length;

  // Build effective red flags: synthesis + detected signals + sample size
  const effectiveRedFlags: string[] = [...(s?.redFlags || [])];
  const effectiveWeaknesses: string[] = [...(s?.weaknesses || [])];

  if (upsellMentions > 0) {
    if (!effectiveRedFlags.includes("upselling-concerns")) effectiveRedFlags.push("upselling-concerns");
    effectiveWeaknesses.push(`${upsellMentions} review${upsellMentions > 1 ? "s" : ""} mention${upsellMentions === 1 ? "s" : ""} membership programs or upselling`);
  }

  // Sample size warning: if we have <1% of reviews, flag it
  const samplePct = plumber.googleReviewCount > 0 ? plumber.reviews.length / plumber.googleReviewCount : 1;
  let sampleSizeWarning: string | null = null;
  if (plumber.googleReviewCount > 100 && plumber.reviews.length <= 5) {
    sampleSizeWarning = `Analysis based on ${plumber.reviews.length} of ${plumber.googleReviewCount.toLocaleString()} total reviews`;
    if (!effectiveRedFlags.includes("limited-data")) effectiveRedFlags.push("limited-data");
    if (plumber.reviews.every((r) => r.rating === 5)) {
      effectiveWeaknesses.push(`All ${plumber.reviews.length} sampled reviews are 5-star — not representative of ${plumber.googleReviewCount.toLocaleString()} total reviews`);
    } else {
      effectiveWeaknesses.push(`Only ${plumber.reviews.length} of ${plumber.googleReviewCount.toLocaleString()} reviews analyzed — limited data`);
    }
  }

  // Remove "Fair Pricing" badge if upsell signals detected
  if (upsellMentions > 0) {
    const idx = allBadges.indexOf("Fair Pricing");
    if (idx >= 0) allBadges.splice(idx, 1);
  }

  const responseKPI = getResponseKPI(s, allBadges);
  const emergencyKPI = getEmergencyKPI(s, allBadges, plumber.is24Hour);
  const topReviews = plumber.reviews.slice(0, 5);

  // JSON-LD
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

      <div className="max-w-[520px] mx-auto px-4 pt-4 pb-28 sm:pb-12 font-[family-name:var(--font-dm-sans)]">
        {/* Back link */}
        <a href="/plumbers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> All plumbers
        </a>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-4">
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
          </div>
        </div>

        {/* GOOGLE RATING BAR */}
        {plumber.googleRating && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-white rounded-lg" style={{ border: "0.5px solid #E5E7EB" }}>
            <Star className="w-5 h-5 text-yellow-500 fill-current" />
            <span className="text-lg font-bold text-gray-900">{plumber.googleRating}</span>
            <span className="text-sm text-gray-500">({plumber.googleReviewCount} reviews)</span>
          </div>
        )}

        {/* KPI CARDS — 2x2 grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {/* Response */}
          <KPICard icon={<Zap className="w-4 h-4" />} title="RESPONSE" label={responseKPI.label} subtitle={responseKPI.subtitle} color={responseKPI.color as keyof typeof colorClasses} />
          {/* Emergency Verified */}
          <KPICard icon={<ShieldCheck className="w-4 h-4" />} title="EMERGENCY" label={emergencyKPI.label} subtitle={emergencyKPI.subtitle} color={emergencyKPI.color as keyof typeof colorClasses} />
          {/* Pricing */}
          <KPICard
            icon={<DollarSign className="w-4 h-4" />}
            title="PRICING"
            label={upsellMentions > 0 ? "Premium / Upsells" : s?.priceSignal === "budget" ? "Budget-Friendly" : s?.priceSignal === "premium" ? "Premium" : s?.priceSignal === "mid-range" ? "Mid-Range" : "Unknown"}
            subtitle={upsellMentions > 0 ? "Membership programs detected in reviews" : allBadges.includes("Fair Pricing") ? "Fair Pricing ✓" : effectiveRedFlags.includes("pricing-complaints") ? "Pricing concerns in reviews" : "Based on review analysis"}
            color={upsellMentions > 0 ? "amber" : allBadges.includes("Fair Pricing") ? "green" : effectiveRedFlags.includes("pricing-complaints") ? "amber" : "gray"}
          />
          {/* Red Flags */}
          <KPICard
            icon={<AlertTriangle className="w-4 h-4" />}
            title="RED FLAGS"
            label={effectiveRedFlags.length === 0 ? "None Found ✓" : `${effectiveRedFlags.length} concern${effectiveRedFlags.length > 1 ? "s" : ""}`}
            subtitle={effectiveRedFlags.length === 0 ? "No significant concerns in reviews" : effectiveRedFlags.map((f) => f.replace(/-/g, " ")).join(", ")}
            color={effectiveRedFlags.length === 0 ? "green" : "red"}
          />
        </div>

        {/* Trust score + sample warning */}
        <div className="text-center mb-5">
          {s && (
            <p className="text-xs text-gray-400">
              Trust Score: {s.score}/100 · Based on {plumber.googleReviewCount} reviews
            </p>
          )}
          {sampleSizeWarning && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠ {sampleSizeWarning}
            </p>
          )}
        </div>

        {/* CTA BUTTONS */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <CallButton phone={plumber.phone} plumberId={slug} city={plumber.city} />
          {plumber.website ? (
            <WebsiteButton url={plumber.website} plumberId={slug} city={plumber.city} />
          ) : (
            <div className="flex items-center justify-center py-3.5 rounded-xl text-sm text-gray-400 bg-gray-50" style={{ border: "0.5px solid #E5E7EB" }}>
              No website
            </div>
          )}
        </div>

        {/* ============================================================= */}
        {/* REVIEW SYNTHESIS — priority ordered */}
        {/* ============================================================= */}
        <section className="mb-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-4">
            What {plumber.googleReviewCount} Reviews Tell Us
          </h2>

          {/* Priority 1: Emergency & Response */}
          <SynthesisSection
            icon={<Zap className="w-4 h-4" />}
            title="Emergency Response"
            positives={s ? [
              ...filterByKeywords(s.strengths, ["fast", "quick", "response", "arrived", "prompt", "same day"]),
              ...(s.bestFor?.filter((b: string) => b.toLowerCase().includes("emergency") || b.toLowerCase().includes("after")) || []),
            ] : []}
            negatives={s ? filterByKeywords(s.weaknesses, ["slow", "delay", "wait", "emergency", "after-hours"]) : []}
            fallback="No reviewers specifically mention emergency response times"
          />

          {/* Priority 2: Red Flags — uses effective (merged) data */}
          <SynthesisSection
            icon={<AlertTriangle className="w-4 h-4" />}
            title="What To Watch Out For"
            positives={[]}
            negatives={[...effectiveWeaknesses, ...effectiveRedFlags.map((f) => f.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()))]}
            fallback="No significant concerns found in reviews ✓"
            fallbackColor="green"
          />

          {/* Priority 3: Quality & Professionalism */}
          <SynthesisSection
            icon={<Star className="w-4 h-4" />}
            title="Quality & Professionalism"
            positives={s ? filterByKeywords(s.strengths, ["professional", "quality", "knowledgeable", "expert", "thorough", "clean", "courteous", "excellent"]) : []}
            negatives={s ? filterByKeywords(s.weaknesses, ["quality", "botched", "worse", "broken", "shoddy", "incompetent"]) : []}
          />

          {/* Priority 4: Communication */}
          <SynthesisSection
            icon={<MessageCircle className="w-4 h-4" />}
            title="Communication"
            positives={s ? filterByKeywords(s.strengths, ["communicat", "explain", "responsive", "call back", "reach", "text", "update"]) : []}
            negatives={s ? filterByKeywords(s.weaknesses, ["reach", "call", "communicat", "ghost", "rude", "answer"]) : []}
          />

          {/* Priority 5: Home Respect — only show if data exists */}
          {s && (filterByKeywords(s.strengths, ["clean up", "tidy", "protected", "careful", "respectful"]).length > 0 ||
                 filterByKeywords(s.weaknesses, ["mess", "damage", "dirty"]).length > 0) && (
            <SynthesisSection
              icon={<Home className="w-4 h-4" />}
              title="Respect for Your Home"
              positives={filterByKeywords(s.strengths, ["clean up", "tidy", "protected", "careful", "respectful"])}
              negatives={filterByKeywords(s.weaknesses, ["mess", "damage", "dirty"])}
            />
          )}

          {/* Priority 6: Pricing */}
          <SynthesisSection
            icon={<DollarSign className="w-4 h-4" />}
            title="Pricing"
            positives={s ? filterByKeywords(s.strengths, ["price", "pric", "value", "afford", "fair", "reasonable"]) : []}
            negatives={s ? filterByKeywords(s.weaknesses, ["price", "pric", "expens", "overcharge", "fee", "cost"]) : []}
          />

          {/* Badges row */}
          {allBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-100">
              {allBadges.map((badge) => (
                <span key={badge} className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-800">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* CUSTOMER REVIEWS */}
        <section className="mb-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-3">
            Customer reviews
          </h2>

          <div className="space-y-3">
            {s?.topQuote && <QuoteCard quote={s.topQuote} variant="positive" label="Most helpful review" />}
            {s?.worstQuote && <QuoteCard quote={s.worstQuote} variant="negative" label="Customers report this" />}
          </div>

          {topReviews.length > 0 && (
            <div className="space-y-3 mt-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Recent Google reviews</p>
              {topReviews.map((review, i) => (
                <GoogleReviewCard key={i} author={review.author} rating={review.rating} text={review.text} relativeTime={review.relativeTime} />
              ))}
            </div>
          )}
        </section>

        {/* BUSINESS DETAILS */}
        <section className="mb-6">
          <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-3">Business details</h2>
          <div className="rounded-xl divide-y divide-gray-100" style={{ border: "0.5px solid #E5E7EB" }}>
            <DetailRow label="Phone" value={plumber.phone} />
            <DetailRow label="Address" value={plumber.address} />
            <DetailRow
              label="Hours"
              value={
                plumber.is24Hour ? (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" style={{ color: "#0F6E56" }} />
                    <span className="font-medium" style={{ color: "#0F6E56" }}>Open 24 hours</span>
                  </span>
                ) : plumber.workingHours ? "Varies — check website" : "Not listed"
              }
            />
          </div>
        </section>

        {/* SERVICE AREA */}
        <ServiceArea plumberLocation={plumber.location} plumberCity={plumber.city} />

        <ProfileReportButton plumberId={slug} city={plumber.city} />

        <footer className="text-center text-xs text-gray-400 pt-2 pb-4">
          Last updated {formatDate(plumber.scrapedAt)} · Data from Google Reviews
        </footer>
      </div>

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
// KPI Card component
// ---------------------------------------------------------------------------

function KPICard({ icon, title, label, subtitle, color }: {
  icon: React.ReactNode;
  title: string;
  label: string;
  subtitle: string;
  color: keyof typeof colorClasses;
}) {
  const c = colorClasses[color];
  return (
    <div className={`rounded-xl p-3 ${c.bg} border ${c.border}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={c.text}>{icon}</span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
      </div>
      <p className={`text-sm font-bold ${c.text}`}>{label}</p>
      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Synthesis Section component
// ---------------------------------------------------------------------------

function filterByKeywords(items: string[], keywords: string[]): string[] {
  return items.filter((item) =>
    keywords.some((k) => item.toLowerCase().includes(k))
  );
}

function SynthesisSection({ icon, title, positives, negatives, fallback, fallbackColor }: {
  icon: React.ReactNode;
  title: string;
  positives: string[];
  negatives: string[];
  fallback?: string;
  fallbackColor?: "green" | "gray";
}) {
  const hasContent = positives.length > 0 || negatives.length > 0;
  if (!hasContent && !fallback) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      {hasContent ? (
        <div className="space-y-1.5 pl-6">
          {/* Deduplicate */}
          {[...new Set(positives)].map((item, i) => (
            <p key={`p-${i}`} className="text-sm text-green-700 flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{item}</span>
            </p>
          ))}
          {[...new Set(negatives)].map((item, i) => (
            <p key={`n-${i}`} className="text-sm text-amber-700 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{item}</span>
            </p>
          ))}
        </div>
      ) : fallback ? (
        <p className={`text-sm pl-6 ${fallbackColor === "green" ? "text-green-600" : "text-gray-400"}`}>
          {fallback}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-xs text-gray-400 font-medium shrink-0 pt-0.5">{label}</span>
      <div className="text-sm text-gray-700 text-right">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service Area — cities within 20 miles of plumber
// ---------------------------------------------------------------------------

function ServiceArea({ plumberLocation, plumberCity }: {
  plumberLocation: { lat: number; lng: number } | null;
  plumberCity: string;
}) {
  if (!plumberLocation || (!plumberLocation.lat && !plumberLocation.lng)) return null;

  const allCityCoords = getCityCoords();
  const nearbyCities = allCityCoords
    .map((c) => ({
      name: c.name,
      state: c.state,
      stateSlug: c.stateSlug,
      citySlug: c.citySlug,
      distance: calculateDistance(plumberLocation.lat, plumberLocation.lng, c.lat, c.lng),
    }))
    .filter((c) => c.distance <= 20)
    .sort((a, b) => a.distance - b.distance);

  if (nearbyCities.length === 0) return null;

  const shown = nearbyCities.slice(0, 6);
  const remaining = nearbyCities.length - shown.length;

  return (
    <section className="mb-6">
      <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-3">Service area</h2>
      <p className="text-sm text-gray-600 mb-2">
        Based in {plumberCity}. Serves {nearbyCities.length} nearby cities within 20 miles:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((c) => (
          <a
            key={`${c.stateSlug}-${c.citySlug}`}
            href={`/emergency-plumbers/${c.stateSlug}/${c.citySlug}`}
            className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-primary text-gray-700 px-2.5 py-1 rounded-full transition-colors"
          >
            {c.name} ({Math.round(c.distance)} mi)
          </a>
        ))}
        {remaining > 0 && (
          <span className="text-xs text-gray-400 px-2.5 py-1">+{remaining} more</span>
        )}
      </div>
    </section>
  );
}
