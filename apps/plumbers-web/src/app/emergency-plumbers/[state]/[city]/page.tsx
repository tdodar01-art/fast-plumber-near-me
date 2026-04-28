import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { MapPin, Clock, AlertTriangle, ArrowRight, Phone, HelpCircle, Star } from "lucide-react";

// Podium icon set — gold/silver/bronze trophies with #1/#2/#3 baked in.
// Used only in the Top 3 Plumbers section on city pages.
const PODIUM_ICONS = [
  "/icons/signals/podium-gold.png",   // index 0 = #1
  "/icons/signals/podium-silver.png", // index 1 = #2
  "/icons/signals/podium-bronze.png", // index 2 = #3
];
import PlumberCard from "@/components/PlumberCard";
import PlumberListWithSort from "@/components/PlumberListWithSort";
import CallToAction from "@/components/CallToAction";
import { getCoveredCityParams, getCityData } from "@/lib/cities-data";
import { getStateBySlug } from "@/lib/states-data";
import { getPlumbersByCity, getActivePlumbersByState } from "@/lib/firestore";
import { getPlumbersNearCity, getAllPlumbers, type SynthesizedPlumber } from "@/lib/plumber-data";
import { calculateQualityScore } from "@/lib/scoring";
import { MAX_PLUMBERS_PER_PAGE, SERVICE_CONFIGS } from "@/lib/services-config";
import { CITY_COVERAGE } from "@/lib/city-coverage";
import { getCityCoordBySlug } from "@/lib/city-coords";
import { calculateDistance, getDistanceWeight } from "@/lib/geo";
import type { Plumber } from "@/lib/types";
import { getExperimentNearbyCityCount } from "@/lib/experiments/getNearbyCityCount";
import { getExpandedNearbyCities } from "@/lib/experiments/expandNearbyCities";
import { getExperimentMetaTitle } from "@/lib/experiments/getExperimentMetaTitle";

// Only prerender cities that have plumber data. Long-tail cities render
// on-demand via dynamicParams (still SEO-indexable because they 200 on
// first hit and get cached thereafter). This keeps the static output under
// Vercel Hobby plan limits.
export function generateStaticParams() {
  return getCoveredCityParams();
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state: stateSlug, city: citySlug } = await params;
  const city = getCityData(stateSlug, citySlug);
  if (!city) return {};

  const plumbers = getPlumbersNearCity(city.state, citySlug);
  const count = Math.min(plumbers.length, MAX_PLUMBERS_PER_PAGE);
  const year = new Date().getFullYear();

  const ogUrl = new URL("https://fastplumbernearme.com/api/og");
  ogUrl.searchParams.set("city", city.name);
  ogUrl.searchParams.set("state", city.state);
  ogUrl.searchParams.set("county", city.county);

  const defaultTitle = `${count} Emergency Plumbers in ${city.name}, ${city.state} — Rated & Reviewed (${year})`;
  const experimentTitle = getExperimentMetaTitle(stateSlug, citySlug);
  const title = experimentTitle ?? defaultTitle;
  const description = `Compare ${count} emergency plumbers in ${city.name}, ${city.state} with real Google reviews, honest strengths & weaknesses, and 24-hour availability. Find who actually picks up.`;

  return {
    title,
    description,
    openGraph: {
      title: defaultTitle,
      description,
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
    },
  };
}

const emergencyTypes = [
  { title: "Burst or Frozen Pipes", description: "A burst pipe can flood your home in minutes. Shut off your main water valve and call an emergency plumber immediately." },
  { title: "Water Heater Failure", description: "No hot water, leaking tank, or strange noises from your water heater? Emergency plumbers can diagnose and repair or replace your unit fast." },
  { title: "Sewer Line Backup", description: "Sewage backing up into your home is a health hazard. Emergency plumbers have the equipment to clear blockages and repair damaged sewer lines." },
  { title: "Clogged Drains", description: "When plunging doesn't work and water won't drain, professional emergency drain cleaning can resolve even the toughest blockages." },
  { title: "Gas Line Issues", description: "If you smell gas, evacuate immediately and call 911 first. Then call a licensed plumber for gas line repair." },
];

function getCityFaqs(cityName: string, stateName: string, county: string) {
  return [
    { question: `How much does an emergency plumber cost in ${cityName}, ${stateName}?`, answer: `Emergency plumber rates in ${cityName} typically range from $150-$300 for the service call, plus parts and labor. After-hours and weekend calls in ${county} County may cost more. Always ask for a written estimate before work begins.` },
    { question: `What should I do during a plumbing emergency in ${cityName}?`, answer: `Shut off the main water valve to stop water flow. If there's standing water, turn off electricity to affected areas. Move valuables away from water and take photos for insurance. Then call a verified emergency plumber in ${cityName} immediately.` },
    { question: `How quickly can an emergency plumber arrive in ${cityName}?`, answer: `Most emergency plumbers in ${cityName}, ${stateName} aim to arrive within 30-60 minutes depending on your location in ${county} County. Our verified plumbers are tested for response time and confirmed to dispatch quickly.` },
    { question: `Should I attempt DIY plumbing repairs in ${cityName}?`, answer: `Only take immediate steps like shutting off water valves and containing water damage. DIY repairs on pressurized water lines or sewer systems can make the problem worse, cause additional damage, and void insurance claims. Call a licensed plumber in ${cityName} instead.` },
    { question: `Can I get a same-day plumber in ${cityName}?`, answer: `Yes — many plumbers serving ${cityName} and ${county} County offer same-day service for urgent repairs. Plumbers listed here are rated for responsiveness, so you can see which ones consistently arrive quickly. For true emergencies like burst pipes or sewer backups, most can dispatch within 30-60 minutes.` },
    { question: `Are emergency plumbers in ${cityName} available 24/7?`, answer: `Yes — the emergency plumbers listed on Fast Plumber Near Me serving ${cityName} and ${county} County offer 24/7 availability. We verify that they actually answer emergency calls at all hours, including nights, weekends, and holidays.` },
    { question: `What are the most common plumbing emergencies in ${cityName}?`, answer: `The most common plumbing emergencies in ${cityName}, ${stateName} include burst or frozen pipes, water heater failures, sewer line backups, clogged drains, and gas line issues. ${county} County homes may be especially susceptible depending on the age and type of construction.` },
  ];
}

// ---------------------------------------------------------------------------
// Top 3 — scored plumbers with decision data, ranked by city percentile
// ---------------------------------------------------------------------------

interface TopPlumber {
  plumber: Plumber;
  synthesized: SynthesizedPlumber;
  percentile: number;
}

function getTop3Plumbers(
  plumbers: Plumber[],
  stateAbbr: string,
  citySlug: string,
): TopPlumber[] {
  const allSynthesized = getAllPlumbers();
  const cityRankKey = `${citySlug}-${stateAbbr.toLowerCase()}`;
  const candidates: TopPlumber[] = [];

  for (const p of plumbers) {
    // Match by placeId or slug
    const synth = allSynthesized.find(
      (s) => s.placeId === p.id || s.slug === p.slug
    );
    if (!synth?.decision?.verdict) continue;
    // Belt-and-suspenders: a plumber must have real review-backed dimension
    // scores to qualify for Top 3, even if a stale `decision.verdict` exists.
    // Pass 2 in score-plumbers.ts already guards against this, but this
    // filter prevents stale Firestore data from leaking into the UI.
    if (typeof synth.scores?.reliability !== "number") continue;
    if (synth.scores.method === "no_reviews") continue;

    // Top 3 must be ranked FOR THIS SPECIFIC CITY. Radius-discovered plumbers
    // (whose serviceCities don't include this city) get city_rank entries for
    // their home city only — they show in this city's main listing via the
    // 20-mile sweep, but they shouldn't be "Top 3 in Arlington" if they're
    // really "Top of Dallas." Require an actual city_rank entry for this city.
    const cityRank = synth.city_rank?.[cityRankKey] ?? synth.city_rank?.[citySlug];
    if (!cityRank) continue;
    const percentile = cityRank.overall_percentile;

    candidates.push({ plumber: p, synthesized: synth, percentile });
  }

  // Sort by percentile (highest first), take top 3
  candidates.sort((a, b) => b.percentile - a.percentile);
  return candidates.slice(0, 3);
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state: stateSlug, city: citySlug } = await params;
  const city = getCityData(stateSlug, citySlug);
  if (!city) notFound();

  const stateInfo = getStateBySlug(stateSlug);
  if (!stateInfo) notFound();

  // Fetch plumbers — combine serviceCities match + 20-mile radius
  const firestoreCitySlug = `${citySlug}-${city.state.toLowerCase()}`;
  let plumbers: (Plumber & { distanceMiles?: number })[] = [];
  const cityCoord = getCityCoordBySlug(city.state, citySlug);

  try {
    // Start with direct serviceCities match from Firestore
    const directMatch = await getPlumbersByCity(firestoreCitySlug);
    if (directMatch.length === 0) {
      const fallback = await getPlumbersByCity(citySlug);
      plumbers = fallback.map((p) => ({ ...p }));
    } else {
      plumbers = directMatch.map((p) => ({ ...p }));
    }

    // Add radius-based plumbers (20 miles) from Firestore
    if (cityCoord) {
      const [cityLat, cityLng] = cityCoord;
      const statePlumbers = await getActivePlumbersByState(city.state);
      const existingIds = new Set(plumbers.map((p) => p.id));

      for (const p of statePlumbers) {
        if (existingIds.has(p.id)) continue;
        if (!p.address?.lat || !p.address?.lng) continue;
        const dist = calculateDistance(cityLat, cityLng, p.address.lat, p.address.lng);
        if (dist <= 20) {
          plumbers.push({ ...p, distanceMiles: dist });
          existingIds.add(p.id);
        }
      }

      // Attach distance to all plumbers (including direct matches)
      for (const p of plumbers) {
        if (p.distanceMiles == null && p.address?.lat && p.address?.lng) {
          p.distanceMiles = calculateDistance(cityLat, cityLng, p.address.lat, p.address.lng);
        }
      }

      // Filter out plumbers beyond 20-mile radius (serviceCities matches may be outside radius)
      plumbers = plumbers.filter(
        (p) => p.distanceMiles == null || p.distanceMiles <= 20
      );
    }
  } catch {
    // Firebase not configured — will fall through to static fallback
  }

  // Fallback: if Firestore returned nothing (not configured or empty),
  // use the static synthesized JSON with 20-mile radius matching.
  // This ensures city pages always show nearby plumbers at build time.
  if (plumbers.length === 0) {
    plumbers = getPlumbersNearCity(city.state, citySlug);
  }

  // Sort: featured > premium > free, then by decision engine percentile
  // (with fallback to old quality score for unscored plumbers).
  // This ensures the main list ordering agrees with the Top 3 section.
  const maxReviewCount = Math.max(1, ...plumbers.map((p) => p.googleReviewCount || 0));
  const allSynth = getAllPlumbers();
  const cityRankKey = `${citySlug}-${city.state.toLowerCase()}`;
  plumbers.sort((a, b) => {
    const tierOrder = { featured: 0, premium: 1, free: 2 };
    const tierDiff = tierOrder[a.listingTier] - tierOrder[b.listingTier];
    if (tierDiff !== 0) return tierDiff;

    // Look up decision engine percentile for each plumber
    const aSynth = allSynth.find((s) => s.placeId === a.id || s.slug === a.slug);
    const bSynth = allSynth.find((s) => s.placeId === b.id || s.slug === b.slug);
    const aRank = aSynth?.city_rank?.[cityRankKey] ?? aSynth?.city_rank?.[citySlug];
    const bRank = bSynth?.city_rank?.[cityRankKey] ?? bSynth?.city_rank?.[citySlug];

    // Scored plumbers always sort above unscored
    const aScored = aRank != null;
    const bScored = bRank != null;
    if (aScored && !bScored) return -1;
    if (!aScored && bScored) return 1;

    // Both scored: sort by percentile (higher = better), weighted by distance
    if (aScored && bScored) {
      const aScore = (aRank!.overall_percentile) * getDistanceWeight(a.distanceMiles ?? 0);
      const bScore = (bRank!.overall_percentile) * getDistanceWeight(b.distanceMiles ?? 0);
      return bScore - aScore;
    }

    // Neither scored: fall back to old quality formula
    const aQuality = calculateQualityScore(a, maxReviewCount) * getDistanceWeight(a.distanceMiles ?? 0);
    const bQuality = calculateQualityScore(b, maxReviewCount) * getDistanceWeight(b.distanceMiles ?? 0);
    return bQuality - aQuality;
  });

  // Cap displayed plumbers to prevent spammy listings
  plumbers = plumbers.slice(0, MAX_PLUMBERS_PER_PAGE);

  // Top 3 scored plumbers for this city
  const top3 = getTop3Plumbers(plumbers, city.state, citySlug);
  const hasTop3 = top3.length >= 3;

  const faqs = getCityFaqs(city.name, city.state, city.county);

  // JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://fastplumbernearme.com" },
      { "@type": "ListItem", position: 2, name: "Emergency Plumbers", item: "https://fastplumbernearme.com/emergency-plumbers" },
      { "@type": "ListItem", position: 3, name: stateInfo.name, item: `https://fastplumbernearme.com/emergency-plumbers/${stateSlug}` },
      { "@type": "ListItem", position: 4, name: city.name, item: `https://fastplumbernearme.com/emergency-plumbers/${stateSlug}/${citySlug}` },
    ],
  };

  function plumberSlug(name: string) {
    return name.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  const plumberListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Emergency Plumbers in ${city.name}, ${city.state}`,
    itemListElement: plumbers.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Plumber",
        name: p.businessName,
        telephone: p.phone,
        url: `https://fastplumbernearme.com/plumber/${plumberSlug(p.businessName)}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: p.address?.city || city.name,
          addressRegion: p.address?.state || city.state,
          ...(p.address?.street && { streetAddress: p.address.street }),
          ...(p.address?.zip && { postalCode: p.address.zip }),
        },
        ...(p.address?.lat && p.address?.lng && {
          geo: { "@type": "GeoCoordinates", latitude: p.address.lat, longitude: p.address.lng },
        }),
        ...(p.googleRating && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.googleRating,
            reviewCount: p.googleReviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }),
      },
    })),
  };

  // Pros/Cons Review schema — one Review per plumber with positiveNotes/negativeNotes
  const plumberReviewsJsonLd = plumbers
    .filter((p) => {
      const strengths = p.reviewSynthesis?.strengths ?? [];
      const weaknesses = [
        ...(p.reviewSynthesis?.weaknesses ?? []),
        ...(p.reviewSynthesis?.redFlags ?? []),
      ];
      return strengths.length > 0 || weaknesses.length > 0;
    })
    .map((p) => {
      const strengths = p.reviewSynthesis?.strengths ?? [];
      const weaknesses = [
        ...(p.reviewSynthesis?.weaknesses ?? []),
        ...(p.reviewSynthesis?.redFlags ?? []),
      ];
      return {
        "@context": "https://schema.org",
        "@type": "Review",
        itemReviewed: {
          "@type": "Plumber",
          name: p.businessName,
          url: `https://fastplumbernearme.com/plumber/${plumberSlug(p.businessName)}`,
        },
        author: {
          "@type": "Organization",
          name: "Fast Plumber Near Me",
          url: "https://fastplumbernearme.com",
        },
        ...(p.googleRating && {
          reviewRating: {
            "@type": "Rating",
            ratingValue: p.googleRating,
            bestRating: 5,
            worstRating: 1,
          },
        }),
        ...(strengths.length > 0 && {
          positiveNotes: {
            "@type": "ItemList",
            itemListElement: strengths.map((s, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: s,
            })),
          },
        }),
        ...(weaknesses.length > 0 && {
          negativeNotes: {
            "@type": "ItemList",
            itemListElement: weaknesses.map((w, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: w,
            })),
          },
        }),
      };
    });

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(plumberListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {plumberReviewsJsonLd.map((reviewJsonLd, i) => (
        <script key={`review-${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJsonLd) }} />
      ))}

      {/* Hero */}
      <section className="bg-primary text-white py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 text-blue-300 text-sm mb-2">
            <Link href="/emergency-plumbers" className="hover:text-white transition-colors">All States</Link>
            <span>/</span>
            <Link href={`/emergency-plumbers/${stateSlug}`} className="hover:text-white transition-colors">{stateInfo.name}</Link>
            <span>/</span>
            <span>{city.name}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
            Emergency Plumbers in {city.name}, {city.state}
          </h1>
          <p className="text-lg text-blue-200">24/7 and same-day plumbers ready to help right now</p>
          <div className="flex items-center gap-4 mt-4 text-sm text-blue-300">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {city.county}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {plumbers.length} plumber{plumbers.length !== 1 ? "s" : ""} available
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Top 3 Plumbers — shown when 3+ plumbers have scoring data */}
        {hasTop3 && (
          <section className="mb-10">
            <div className="flex items-center gap-2.5 mb-6">
              <Image
                src="/icons/signals/podium-gold.png"
                alt=""
                width={32}
                height={32}
                style={{ width: 32, height: 32 }}
              />
              <h2 className="text-2xl font-bold text-gray-900">
                Top 3 Plumbers in {city.name}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
              {top3.map((t, i) => {
                const verdict = t.synthesized.decision?.verdict;
                const verdictLabel = verdict === "strong_hire" ? "Strong Hire"
                  : verdict === "conditional_hire" ? "Conditional Hire"
                  : verdict === "caution" ? "Caution" : null;
                const verdictColor = verdict === "strong_hire" ? "bg-green-100 text-green-800 border-green-200"
                  : verdict === "conditional_hire" ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                  : verdict === "caution" ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-gray-100 text-gray-600 border-gray-200";
                // Podium-aware styling: each medal position gets its own
                // tinted border so the ranking is reinforced visually, not
                // just by the trophy icon.
                const cardBorder =
                  i === 0 ? "border-yellow-400 ring-1 ring-yellow-200" :
                  i === 1 ? "border-slate-300 ring-1 ring-slate-200" :
                  i === 2 ? "border-amber-700/50 ring-1 ring-amber-200" :
                  "border-gray-200";
                const evidenceQuote = t.synthesized.evidence_quotes?.find(
                  (eq) => eq.dimension === "workmanship" || eq.dimension === "reliability"
                );
                const rank = t.synthesized.city_rank?.[`${citySlug}-${city.state.toLowerCase()}`]
                  ?? t.synthesized.city_rank?.[citySlug];
                const podiumAlt =
                  i === 0 ? "1st place" : i === 1 ? "2nd place" : i === 2 ? "3rd place" : `#${i + 1}`;

                return (
                  <div key={t.plumber.id} className={`bg-white border ${cardBorder} rounded-xl p-5 flex flex-col`}>
                    <div className="flex items-center gap-2 mb-2">
                      {/* Medal trophy replaces the '#N' text — the icon IS
                          the rank indicator. Gold/silver/bronze from
                          PODIUM_ICONS so #1/#2/#3 read instantly. */}
                      {i < PODIUM_ICONS.length ? (
                        <Image
                          src={PODIUM_ICONS[i]}
                          alt={podiumAlt}
                          width={36}
                          height={36}
                          className="flex-shrink-0"
                          style={{ width: 36, height: 36 }}
                        />
                      ) : (
                        <span className="text-lg font-bold text-primary">#{i + 1}</span>
                      )}
                      {verdictLabel && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${verdictColor}`}>
                          {verdictLabel}
                        </span>
                      )}
                    </div>
                    <Link href={`/plumber/${plumberSlug(t.plumber.businessName)}`} className="hover:text-primary transition-colors">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{t.plumber.businessName}</h3>
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      {t.plumber.googleRating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          {t.plumber.googleRating}
                          {t.plumber.googleReviewCount > 0 && (
                            <span className="text-gray-400">({t.plumber.googleReviewCount})</span>
                          )}
                        </span>
                      )}
                      {rank && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          {rank.rank}
                        </span>
                      )}
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

        {/* Plumber listings */}
        {plumbers.length > 0 ? (
          <PlumberListWithSort
            plumbers={JSON.parse(JSON.stringify(plumbers))}
            citySlug={citySlug}
            cityName={city.name}
          />
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Plumber Listings Coming Soon</h2>
            <p className="text-gray-600 mb-4">
              We&apos;re currently adding verified plumbers in {city.name}. Check back soon or list your plumbing business below.
            </p>
            <Link href="/add-your-business" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors">
              List Your Business
            </Link>
          </div>
        )}

        {/* City content */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">About Emergency Plumbing in {city.name}</h2>
          <p className="text-gray-600 leading-relaxed">{city.heroContent}</p>
        </section>

        {/* Emergency types */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Common Plumbing Emergencies in {city.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {emergencyTypes.map((e) => (
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

        {/* Service-specific pages — internal linking for SEO */}
        {CITY_COVERAGE[`${city.state}:${citySlug}`] && plumbers.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Plumbing Services in {city.name}</h2>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CONFIGS.filter((s) => s.type === "service").map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}/${stateSlug}/${citySlug}`}
                  className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
                >
                  {s.displayName} <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Nearby cities — experiment-aware */}
        {(() => {
          const expCount = getExperimentNearbyCityCount(stateSlug, citySlug);
          const nearbyCities = expCount != null
            ? getExpandedNearbyCities(stateSlug, citySlug, city.nearbyCities, expCount)
            : city.nearbyCities;
          return nearbyCities.length > 0 ? (
            <section className="mb-12">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Nearby Cities</h2>
              <div className="flex flex-wrap gap-2">
                {nearbyCities.map((nearby) => (
                  <Link
                    key={`${nearby.stateSlug}-${nearby.citySlug}`}
                    href={`/emergency-plumbers/${nearby.stateSlug}/${nearby.citySlug}`}
                    className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
                  >
                    {nearby.name} <ArrowRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null;
        })()}

        {/* Emergency CTA */}
        {plumbers.length > 0 && (
          <div className="bg-accent/5 border-2 border-accent/20 rounded-2xl p-6 sm:p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Plumbing Emergency Right Now?</h2>
            <p className="text-gray-600 mb-4">Don&apos;t wait — call a verified plumber in {city.name} immediately.</p>
            <a
              href={`tel:${plumbers[0].phone}`}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-4 px-8 rounded-xl text-lg transition-colors shadow-lg shadow-accent/25"
            >
              <Phone className="w-5 h-5" />
              Call Top-Rated Plumber Now
            </a>
          </div>
        )}
      </div>

      <CallToAction />
    </>
  );
}
