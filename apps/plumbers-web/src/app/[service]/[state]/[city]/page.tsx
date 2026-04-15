import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, AlertTriangle, ArrowRight, Phone, HelpCircle, Star, ShieldCheck } from "lucide-react";
import PlumberListWithSort from "@/components/PlumberListWithSort";
import CallToAction from "@/components/CallToAction";
import { getAllCityParams, getCityData } from "@/lib/cities-data";
import { getStateBySlug } from "@/lib/states-data";
import { getPlumbersNearCity, getAllPlumbers, type SynthesizedPlumber } from "@/lib/plumber-data";
import { calculateQualityScore } from "@/lib/scoring";
import { getDistanceWeight } from "@/lib/geo";
import {
  SERVICE_CONFIGS,
  getServiceConfig,
  getSpecialtyKeyFromConfig,
  getAllServiceSlugs,
  MIN_SPECIALTY_SCORE,
  MIN_PLUMBERS_FOR_PAGE,
  MAX_PLUMBERS_PER_PAGE,
  type PageConfig,
} from "@/lib/services-config";
import { CITY_COVERAGE } from "@/lib/city-coverage";
import type { Plumber } from "@/lib/types";
import { getExperimentNearbyCityCount } from "@/lib/experiments/getNearbyCityCount";
import { getExpandedNearbyCities } from "@/lib/experiments/expandNearbyCities";

// ---------------------------------------------------------------------------
// Static params: [service] × [state] × [city]
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  const cityParams = getAllCityParams();
  const serviceSlugs = getAllServiceSlugs();
  const params: { service: string; state: string; city: string }[] = [];

  for (const svc of serviceSlugs) {
    for (const { state, city } of cityParams) {
      // Only generate service pages for cities with plumber data
      const stateInfo = getStateBySlug(state);
      if (!stateInfo) continue;
      const key = `${stateInfo.abbreviation}:${city}`;
      if (!CITY_COVERAGE[key]) continue;
      params.push({ service: svc, state, city });
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string; state: string; city: string }>;
}): Promise<Metadata> {
  const { service: serviceSlug, state: stateSlug, city: citySlug } = await params;
  const config = getServiceConfig(serviceSlug);
  const city = getCityData(stateSlug, citySlug);
  if (!config || !city) return {};

  const year = new Date().getFullYear();
  const { totalCount } = getTieredPlumbers(city.state, citySlug, config);

  const title = `${config.displayName} in ${city.name}, ${city.state} — Top Rated (${year})`;
  const description = `Compare ${totalCount} ${config.displayName.toLowerCase()} pros in ${city.name}, ${city.state} rated on quality, pricing, and responsiveness from real Google reviews. See who to call.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

// ---------------------------------------------------------------------------
// Tiered plumber resolution
// ---------------------------------------------------------------------------

type PlumberWithDist = Plumber & { distanceMiles?: number; latestReviewAt?: string };

interface TieredPlumber {
  plumber: PlumberWithDist;
  tier: 1 | 2 | 3;
  /** Tier 1: specialty score. Tier 2: servicesMentioned avgRating. Tier 3: undefined. */
  specialtyScore?: number;
  /** Tier 2: review count for this service. */
  serviceMentionCount?: number;
  synthesized?: SynthesizedPlumber;
}

interface TieredResult {
  tier1: TieredPlumber[];
  tier2: TieredPlumber[];
  tier3: TieredPlumber[];
  /** Combined list ordered Tier 1 → Tier 2 → Tier 3 */
  all: TieredPlumber[];
  /** Tier 1 + Tier 2 (eligible for Top 3 cards) */
  topPickEligible: TieredPlumber[];
  totalCount: number;
}

function getTieredPlumbers(
  stateAbbr: string,
  citySlug: string,
  config: PageConfig,
): TieredResult {
  const allSynthesized: SynthesizedPlumber[] = getAllPlumbers();
  const nearbyPlumbers = getPlumbersNearCity(stateAbbr, citySlug);
  const specialtyKey = getSpecialtyKeyFromConfig(config);

  const tier1: TieredPlumber[] = [];
  const tier2: TieredPlumber[] = [];
  const tier3: TieredPlumber[] = [];
  const assignedIds = new Set<string>();

  // --- Tier 1: scored plumbers with specialty_strength >= MIN_SPECIALTY_SCORE ---
  if (specialtyKey) {
    for (const plumber of nearbyPlumbers) {
      const synth = allSynthesized.find((s) => s.placeId === plumber.id);
      if (!synth?.scores?.specialty_strength) continue;
      const score = (synth.scores.specialty_strength as Record<string, number>)[specialtyKey];
      if (score == null || score < MIN_SPECIALTY_SCORE) continue;
      tier1.push({ plumber, tier: 1, specialtyScore: score, synthesized: synth });
      assignedIds.add(plumber.id);
    }
    tier1.sort((a, b) => (b.specialtyScore ?? 0) - (a.specialtyScore ?? 0));
  }

  // --- Tier 2: bridge-scored from servicesMentioned ---
  const smKeys = config.serviceMentionedKeys;
  if (smKeys.length > 0) {
    for (const plumber of nearbyPlumbers) {
      if (assignedIds.has(plumber.id)) continue;
      const synth = allSynthesized.find((s) => s.placeId === plumber.id);
      if (!synth?.synthesis?.servicesMentioned) continue;
      const sm = synth.synthesis.servicesMentioned as Record<string, { count: number; avgRating: number; topQuote: string }>;
      let bestCount = 0;
      let bestRating = 0;
      for (const key of smKeys) {
        const mention = sm[key];
        if (mention && mention.count >= 1) {
          bestCount = Math.max(bestCount, mention.count);
          bestRating = Math.max(bestRating, mention.avgRating);
        }
      }
      if (bestCount >= 1) {
        tier2.push({ plumber, tier: 2, specialtyScore: bestRating * 20, serviceMentionCount: bestCount, synthesized: synth });
        assignedIds.add(plumber.id);
      }
    }
    tier2.sort((a, b) => {
      const ratingDiff = (b.specialtyScore ?? 0) - (a.specialtyScore ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.serviceMentionCount ?? 0) - (a.serviceMentionCount ?? 0);
    });
  }

  // --- Tier 3: all remaining radius-matched plumbers, sorted by quality × distance ---
  const maxReviewCount = Math.max(1, ...nearbyPlumbers.map((p) => p.googleReviewCount || 0));
  for (const plumber of nearbyPlumbers) {
    if (assignedIds.has(plumber.id)) continue;
    tier3.push({ plumber, tier: 3 });
    assignedIds.add(plumber.id);
  }
  tier3.sort((a, b) => {
    const aQ = calculateQualityScore(a.plumber, maxReviewCount) * getDistanceWeight(a.plumber.distanceMiles ?? 0);
    const bQ = calculateQualityScore(b.plumber, maxReviewCount) * getDistanceWeight(b.plumber.distanceMiles ?? 0);
    return bQ - aQ;
  });

  const allUncapped = [...tier1, ...tier2, ...tier3];
  const all = allUncapped.slice(0, MAX_PLUMBERS_PER_PAGE);
  const topPickEligible = [...tier1, ...tier2];

  return { tier1, tier2, tier3, all, topPickEligible, totalCount: all.length };
}

function plumberSlug(name: string) {
  return name.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ServiceCityPage({
  params,
}: {
  params: Promise<{ service: string; state: string; city: string }>;
}) {
  const { service: serviceSlug, state: stateSlug, city: citySlug } = await params;
  const config = getServiceConfig(serviceSlug);
  const city = getCityData(stateSlug, citySlug);
  const stateInfo = getStateBySlug(stateSlug);
  if (!config || !city || !stateInfo) notFound();

  const tiered = getTieredPlumbers(city.state, citySlug, config);
  const year = new Date().getFullYear();

  const hasAnyPlumbers = tiered.totalCount > 0;
  const hasEnoughPlumbers = tiered.totalCount >= MIN_PLUMBERS_FOR_PAGE;
  const hasTopPicks = tiered.topPickEligible.length >= MIN_PLUMBERS_FOR_PAGE;

  // Prepare FAQs with city substitution
  const faqs = config.faqTemplates.map((f) => ({
    question: f.question
      .replace(/\{city\}/g, city.name)
      .replace(/\{state\}/g, city.state)
      .replace(/\{county\}/g, city.county),
    answer: f.answer
      .replace(/\{city\}/g, city.name)
      .replace(/\{state\}/g, city.state)
      .replace(/\{county\}/g, city.county),
  }));

  // JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://fastplumbernearme.com" },
      { "@type": "ListItem", position: 2, name: stateInfo.name, item: `https://fastplumbernearme.com/emergency-plumbers/${stateSlug}` },
      { "@type": "ListItem", position: 3, name: city.name, item: `https://fastplumbernearme.com/emergency-plumbers/${stateSlug}/${citySlug}` },
      { "@type": "ListItem", position: 4, name: config.displayName, item: `https://fastplumbernearme.com/${serviceSlug}/${stateSlug}/${citySlug}` },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  const plumberListJsonLd = hasEnoughPlumbers ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${config.displayName} in ${city.name}, ${city.state}`,
    itemListElement: tiered.all.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Plumber",
        name: t.plumber.businessName,
        telephone: t.plumber.phone,
        url: `https://fastplumbernearme.com/plumber/${plumberSlug(t.plumber.businessName)}`,
        ...(t.plumber.address?.lat && t.plumber.address?.lng && {
          geo: { "@type": "GeoCoordinates", latitude: t.plumber.address.lat, longitude: t.plumber.address.lng },
        }),
        ...(t.plumber.googleRating && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: t.plumber.googleRating,
            reviewCount: t.plumber.googleReviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }),
      },
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {plumberListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(plumberListJsonLd) }} />
      )}
      {/* noindex if fewer than MIN_PLUMBERS_FOR_PAGE plumbers across all tiers */}
      {!hasEnoughPlumbers && (
        <meta name="robots" content="noindex" />
      )}

      {/* Hero */}
      <section className="bg-primary text-white py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 text-blue-300 text-sm mb-2">
            <Link href={`/emergency-plumbers/${stateSlug}`} className="hover:text-white transition-colors">{stateInfo.name}</Link>
            <span>/</span>
            <Link href={`/emergency-plumbers/${stateSlug}/${citySlug}`} className="hover:text-white transition-colors">{city.name}</Link>
            <span>/</span>
            <span>{config.displayName}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
            {config.displayName} in {city.name}, {city.state}
          </h1>
          <p className="text-lg text-blue-200">{config.heroHook}</p>
          <div className="flex items-center gap-4 mt-4 text-sm text-blue-300">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {city.county} County
            </span>
            {hasAnyPlumbers && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                {tiered.totalCount} plumber{tiered.totalCount !== 1 ? "s" : ""} available
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">

        {/* Top 3 picks — only from Tier 1 + Tier 2 (scored or bridge-scored) */}
        {hasTopPicks && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Best {config.displayName} Pros in {city.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {tiered.topPickEligible.slice(0, 3).map((t, i) => {
                const verdict = t.synthesized?.decision?.verdict;
                const verdictLabel = verdict === "strong_hire" ? "Strong Hire" : verdict === "conditional_hire" ? "Conditional Hire" : verdict === "caution" ? "Caution" : null;
                const verdictColor = verdict === "strong_hire" ? "bg-green-100 text-green-800" : verdict === "conditional_hire" ? "bg-yellow-100 text-yellow-800" : verdict === "caution" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600";
                const evidenceQuote = t.synthesized?.evidence_quotes?.find(
                  (eq) => eq.dimension === "workmanship" || eq.dimension === "reliability"
                );

                // Badge: Tier 1 shows specialty score, Tier 2 shows "Reviewed for {service}"
                const badge = t.tier === 1
                  ? { text: `${config.displayName}: ${t.specialtyScore}/100`, className: "bg-blue-50 text-blue-700" }
                  : { text: `Reviewed for ${config.displayName.toLowerCase()}`, className: "bg-green-50 text-green-700" };

                return (
                  <div key={t.plumber.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-primary">#{i + 1}</span>
                      {verdictLabel && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${verdictColor}`}>
                          {verdictLabel}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{t.plumber.businessName}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      {t.plumber.googleRating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          {t.plumber.googleRating}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                    {evidenceQuote && (
                      <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">
                        &ldquo;{evidenceQuote.quote}&rdquo;
                      </p>
                    )}
                    <div className="mt-auto">
                      <a
                        href={`tel:${t.plumber.phone}`}
                        className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors w-full justify-center"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call Now
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Full plumber list — all tiers combined */}
        {hasAnyPlumbers ? (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              All {config.displayName} Pros in {city.name}
            </h2>
            <PlumberListWithSort
              plumbers={JSON.parse(JSON.stringify(tiered.all.map((t) => t.plumber)))}
              citySlug={citySlug}
              cityName={city.name}
            />
          </section>
        ) : (
          <section className="mb-12">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {config.displayName} Coverage Coming Soon
              </h2>
              <p className="text-gray-600 mb-4">
                We&apos;re building {config.displayName.toLowerCase()} ratings for {city.name}.
                In the meantime, check our general plumber directory for this area.
              </p>
              <Link
                href={`/emergency-plumbers/${stateSlug}/${citySlug}`}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                View All Plumbers in {city.name}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        )}

        {/* Emergency types / service scenarios */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Common {config.displayName} Scenarios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.emergencyTypes.map((e) => (
              <div key={e.title} className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-accent" />
                  {e.title}
                </h3>
                <p className="text-sm text-gray-600">{e.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="bg-white border border-gray-200 rounded-xl group">
                <summary className="flex items-center justify-between cursor-pointer p-5 font-semibold text-gray-900">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    {faq.question}
                  </span>
                </summary>
                <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed -mt-1">{faq.answer}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Cross-links */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Other Services in {city.name}</h2>
          <div className="flex flex-wrap gap-2">
            {SERVICE_CONFIGS.filter((s) => s.slug !== serviceSlug).map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}/${stateSlug}/${citySlug}`}
                className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
              >
                {s.displayName} <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
            <Link
              href={`/emergency-plumbers/${stateSlug}/${citySlug}`}
              className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
            >
              All Emergency Plumbers <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>

        {/* Nearby cities (experiment-aware) */}
        {(() => {
          const expCount = getExperimentNearbyCityCount(stateSlug, citySlug);
          const nearbyCities = expCount != null
            ? getExpandedNearbyCities(stateSlug, citySlug, city.nearbyCities, expCount)
            : city.nearbyCities;
          if (nearbyCities.length === 0) return null;
          return (
            <section className="mb-12">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {config.displayName} in Nearby Cities
              </h2>
              <div className="flex flex-wrap gap-2">
                {nearbyCities.map((nearby) => (
                  <Link
                    key={`${nearby.stateSlug}-${nearby.citySlug}`}
                    href={`/${serviceSlug}/${nearby.stateSlug}/${nearby.citySlug}`}
                    className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
                  >
                    {nearby.name} <ArrowRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Emergency CTA */}
        {hasAnyPlumbers && (
          <div className="bg-accent/5 border-2 border-accent/20 rounded-2xl p-6 sm:p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Need {config.displayName} Right Now?
            </h2>
            <p className="text-gray-600 mb-4">
              Call a top-rated {config.displayName.toLowerCase()} pro in {city.name}.
            </p>
            <a
              href={`tel:${tiered.all[0].plumber.phone}`}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-4 px-8 rounded-xl text-lg transition-colors shadow-lg shadow-accent/25"
            >
              <Phone className="w-5 h-5" />
              Call Top-Rated Pro Now
            </a>
          </div>
        )}
      </div>

      <CallToAction />
    </>
  );
}
