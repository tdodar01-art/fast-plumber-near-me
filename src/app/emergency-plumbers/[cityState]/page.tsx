import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Clock, AlertTriangle, ArrowRight, Phone, HelpCircle } from "lucide-react";
import PlumberCard from "@/components/PlumberCard";
import CallToAction from "@/components/CallToAction";
import { CITY_DATA, getAllCitySlugs } from "@/lib/cities-data";
import { getPlumbersByCity } from "@/lib/firestore";

export function generateStaticParams() {
  return getAllCitySlugs().map((cityState) => ({ cityState }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cityState: string }>;
}): Promise<Metadata> {
  const { cityState } = await params;
  const city = CITY_DATA[cityState];
  if (!city) return {};

  return {
    title: `Emergency Plumbers in ${city.name}, ${city.state} — 24/7 Verified`,
    description: `Find verified 24/7 emergency plumbers in ${city.name}, ${city.state}. AI-verified for responsiveness. Burst pipes, water heaters, sewers & drains. Call now.`,
    openGraph: {
      title: `Emergency Plumbers in ${city.name}, ${city.state}`,
      description: `Verified 24/7 emergency plumbers in ${city.name}. We call them so you don't have to wonder if they'll pick up.`,
    },
  };
}

const emergencyTypes = [
  {
    title: "Burst or Frozen Pipes",
    description:
      "A burst pipe can flood your home in minutes. Shut off your main water valve and call an emergency plumber immediately.",
  },
  {
    title: "Water Heater Failure",
    description:
      "No hot water, leaking tank, or strange noises from your water heater? Emergency plumbers can diagnose and repair or replace your unit fast.",
  },
  {
    title: "Sewer Line Backup",
    description:
      "Sewage backing up into your home is a health hazard. Emergency plumbers have the equipment to clear blockages and repair damaged sewer lines.",
  },
  {
    title: "Clogged Drains",
    description:
      "When plunging doesn't work and water won't drain, professional emergency drain cleaning can resolve even the toughest blockages.",
  },
  {
    title: "Gas Line Issues",
    description:
      "If you smell gas, evacuate immediately and call 911 first. Then call a licensed plumber for gas line repair.",
  },
];

const faqs = [
  {
    question: "How much does an emergency plumber cost?",
    answer:
      "Emergency plumber rates vary but typically range from $150-$300 for the service call, plus parts and labor. After-hours and weekend calls may cost more. Always ask for an estimate before work begins.",
  },
  {
    question: "What should I do while waiting for the plumber?",
    answer:
      "Shut off the main water valve to stop water flow. If there's standing water, turn off electricity to affected areas. Move valuables away from water. Take photos for insurance purposes.",
  },
  {
    question: "How quickly can an emergency plumber arrive?",
    answer:
      "Most emergency plumbers aim to arrive within 30-60 minutes. Our verified plumbers are tested for response time and confirmed to dispatch quickly.",
  },
  {
    question: "Should I attempt DIY plumbing repairs in an emergency?",
    answer:
      "Only take immediate steps like shutting off water valves. DIY repairs on pressurized water lines or sewer systems can make the problem worse and void insurance claims.",
  },
];

export default async function CityPage({
  params,
}: {
  params: Promise<{ cityState: string }>;
}) {
  const { cityState } = await params;
  const city = CITY_DATA[cityState];
  if (!city) notFound();

  // Fetch plumbers from Firestore — returns empty array if Firebase not configured
  let plumbers: Awaited<ReturnType<typeof getPlumbersByCity>> = [];
  try {
    plumbers = await getPlumbersByCity(cityState);
  } catch {
    // Firebase not configured yet — will show empty state
  }

  // Sort: featured > premium > free, then by reliabilityScore desc, then googleRating desc, then reviewCount desc
  plumbers.sort((a, b) => {
    const tierOrder = { featured: 0, premium: 1, free: 2 };
    const tierDiff = tierOrder[a.listingTier] - tierOrder[b.listingTier];
    if (tierDiff !== 0) return tierDiff;
    if (b.reliabilityScore !== a.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
    if ((b.googleRating || 0) !== (a.googleRating || 0)) return (b.googleRating || 0) - (a.googleRating || 0);
    return (b.googleReviewCount || 0) - (a.googleReviewCount || 0);
  });

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Emergency Plumbers in ${city.name}, ${city.state}`,
    description: `Verified emergency plumbers serving ${city.name}, ${city.state}`,
    itemListElement: plumbers.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Plumber",
        name: p.businessName,
        telephone: p.phone,
        address: {
          "@type": "PostalAddress",
          addressLocality: city.name,
          addressRegion: city.state,
        },
        ...(p.googleRating && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.googleRating,
            reviewCount: p.googleReviewCount,
          },
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
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="bg-primary text-white py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 text-blue-300 text-sm mb-2">
            <Link href="/emergency-plumbers" className="hover:text-white transition-colors">
              All Cities
            </Link>
            <span>/</span>
            <span>
              {city.name}, {city.state}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
            Emergency Plumbers in {city.name}, {city.state}
          </h1>
          <p className="text-lg text-blue-200">
            Verified 24/7 plumbers ready to help right now
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-blue-300">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {city.county} County
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
          <div className="space-y-4 mb-12">
            {plumbers.map((plumber) => (
              <PlumberCard key={plumber.id} plumber={plumber} citySlug={cityState} />
            ))}
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Plumber Listings Coming Soon
            </h2>
            <p className="text-gray-600 mb-4">
              We&apos;re currently adding verified plumbers in {city.name}. Check back soon or
              list your plumbing business below.
            </p>
            <Link
              href="/add-your-business"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              List Your Business
            </Link>
          </div>
        )}

        {/* City-specific content */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            About Emergency Plumbing in {city.name}
          </h2>
          <p className="text-gray-600 leading-relaxed">{city.heroContent}</p>
        </section>

        {/* Emergency types */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Common Plumbing Emergencies in {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {emergencyTypes.map((emergency) => (
              <div
                key={emergency.title}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-accent" />
                  {emergency.title}
                </h3>
                <p className="text-sm text-gray-600">{emergency.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="bg-white border border-gray-200 rounded-xl group"
              >
                <summary className="flex items-center justify-between cursor-pointer p-5 font-semibold text-gray-900">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    {faq.question}
                  </span>
                </summary>
                <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed -mt-1">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Nearby cities */}
        {city.nearbyCities.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Nearby Cities
            </h2>
            <div className="flex flex-wrap gap-2">
              {city.nearbyCities.map((nearby) => (
                <Link
                  key={nearby.slug}
                  href={`/emergency-plumbers/${nearby.slug}`}
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Plumbing Emergency Right Now?
            </h2>
            <p className="text-gray-600 mb-4">
              Don&apos;t wait — call a verified plumber in {city.name} immediately.
            </p>
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
