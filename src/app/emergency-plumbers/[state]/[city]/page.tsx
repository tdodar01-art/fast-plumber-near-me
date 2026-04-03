import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Clock, AlertTriangle, ArrowRight, Phone, HelpCircle } from "lucide-react";
import PlumberCard from "@/components/PlumberCard";
import PlumberListWithSort from "@/components/PlumberListWithSort";
import CallToAction from "@/components/CallToAction";
import { getAllCityParams, getCityData } from "@/lib/cities-data";
import { getStateBySlug } from "@/lib/states-data";
import { getPlumbersByCity, getActivePlumbersByState } from "@/lib/firestore";
import { calculateQualityScore } from "@/lib/scoring";
import { getCityCoordBySlug } from "@/lib/city-coords";
import { calculateDistance, getDistanceWeight } from "@/lib/geo";
import type { Plumber } from "@/lib/types";

export function generateStaticParams() {
  return getAllCityParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state: stateSlug, city: citySlug } = await params;
  const city = getCityData(stateSlug, citySlug);
  if (!city) return {};

  const ogUrl = new URL("https://fastplumbernearme.com/api/og");
  ogUrl.searchParams.set("city", city.name);
  ogUrl.searchParams.set("state", city.state);
  ogUrl.searchParams.set("county", city.county);

  return {
    title: `Emergency Plumbers in ${city.name}, ${city.state} — 24/7 Verified`,
    description: `Find verified 24/7 emergency plumbers in ${city.name}, ${city.state}. AI-verified for responsiveness. Burst pipes, water heaters, sewers & drains. Call now.`,
    openGraph: {
      title: `Emergency Plumbers in ${city.name}, ${city.state}`,
      description: `Verified 24/7 emergency plumbers in ${city.name}. We call them so you don't have to wonder if they'll pick up.`,
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
    { question: `Are emergency plumbers in ${cityName} available 24/7?`, answer: `Yes — the emergency plumbers listed on Fast Plumber Near Me serving ${cityName} and ${county} County offer 24/7 availability. We verify that they actually answer emergency calls at all hours, including nights, weekends, and holidays.` },
    { question: `What are the most common plumbing emergencies in ${cityName}?`, answer: `The most common plumbing emergencies in ${cityName}, ${stateName} include burst or frozen pipes, water heater failures, sewer line backups, clogged drains, and gas line issues. ${county} County homes may be especially susceptible depending on the age and type of construction.` },
  ];
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
    // Start with direct serviceCities match
    const directMatch = await getPlumbersByCity(firestoreCitySlug);
    if (directMatch.length === 0) {
      const fallback = await getPlumbersByCity(citySlug);
      plumbers = fallback.map((p) => ({ ...p }));
    } else {
      plumbers = directMatch.map((p) => ({ ...p }));
    }

    // Add radius-based plumbers (20 miles) if we have city coordinates
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
    }
  } catch {
    // Firebase not configured
  }

  // Sort: featured > premium > free, then by quality × distance weight
  const maxReviewCount = Math.max(1, ...plumbers.map((p) => p.googleReviewCount || 0));
  plumbers.sort((a, b) => {
    const tierOrder = { featured: 0, premium: 1, free: 2 };
    const tierDiff = tierOrder[a.listingTier] - tierOrder[b.listingTier];
    if (tierDiff !== 0) return tierDiff;
    const aQuality = calculateQualityScore(a, maxReviewCount) * getDistanceWeight(a.distanceMiles ?? 0);
    const bQuality = calculateQualityScore(b, maxReviewCount) * getDistanceWeight(b.distanceMiles ?? 0);
    return bQuality - aQuality;
  });

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
        address: { "@type": "PostalAddress", addressLocality: city.name, addressRegion: city.state },
        ...(p.googleRating && {
          aggregateRating: { "@type": "AggregateRating", ratingValue: p.googleRating, reviewCount: p.googleReviewCount },
        }),
      },
    })),
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

  // AggregateRating for the city page (aggregate of all plumber ratings)
  const ratedPlumbers = plumbers.filter((p) => p.googleRating && p.googleReviewCount);
  const aggregateRatingJsonLd = ratedPlumbers.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `Emergency Plumbers in ${city.name}, ${city.state}`,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: (ratedPlumbers.reduce((sum, p) => sum + (p.googleRating || 0), 0) / ratedPlumbers.length).toFixed(1),
      reviewCount: ratedPlumbers.reduce((sum, p) => sum + (p.googleReviewCount || 0), 0),
      bestRating: 5,
      worstRating: 1,
    },
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(plumberListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {aggregateRatingJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aggregateRatingJsonLd) }} />
      )}

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
          <p className="text-lg text-blue-200">Verified 24/7 plumbers ready to help right now</p>
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

        {/* Nearby cities */}
        {city.nearbyCities.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nearby Cities</h2>
            <div className="flex flex-wrap gap-2">
              {city.nearbyCities.map((nearby) => (
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
        )}

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
