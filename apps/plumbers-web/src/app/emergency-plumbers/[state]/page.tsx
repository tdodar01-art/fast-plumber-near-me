import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin, Users } from "lucide-react";
import CallToAction from "@/components/CallToAction";
import { getCitiesForState } from "@/lib/cities-data";
import { getStateBySlug, getAllStateSlugs, STATES_DATA } from "@/lib/states-data";
import { getStatesWithCities } from "@/lib/cities-data";

export function generateStaticParams() {
  const statesWithCities = getStatesWithCities();
  return statesWithCities
    .map((abbr) => STATES_DATA[abbr])
    .filter(Boolean)
    .map((s) => ({ state: s!.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const stateInfo = getStateBySlug(stateSlug);
  if (!stateInfo) return {};

  return {
    title: `Emergency Plumbers in ${stateInfo.name} — Find 24/7 Service`,
    description: `Find verified emergency plumbers across ${stateInfo.name}. Browse cities, see reliability scores, and call a plumber who actually picks up.`,
  };
}

export default async function StatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: stateSlug } = await params;
  const stateInfo = getStateBySlug(stateSlug);
  if (!stateInfo) notFound();

  const cities = getCitiesForState(stateSlug);
  if (cities.length === 0) notFound();

  // Group by county
  const byCounty = cities.reduce<Record<string, typeof cities>>((acc, city) => {
    const county = city.info.county;
    if (!acc[county]) acc[county] = [];
    acc[county].push(city);
    return acc;
  }, {});

  const sortedCounties = Object.entries(byCounty).sort(
    ([, a], [, b]) => b.length - a.length
  );

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://fastplumbernearme.com" },
      { "@type": "ListItem", position: 2, name: "Emergency Plumbers", item: "https://fastplumbernearme.com/emergency-plumbers" },
      { "@type": "ListItem", position: 3, name: stateInfo.name, item: `https://fastplumbernearme.com/emergency-plumbers/${stateSlug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-300 text-sm mb-3">
            <Link href="/emergency-plumbers" className="hover:text-white transition-colors">
              All States
            </Link>
            <span>/</span>
            <span>{stateInfo.name}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Emergency Plumbers in {stateInfo.name}
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Find verified emergency plumbers across {cities.length} {cities.length === 1 ? "city" : "cities"} in {stateInfo.name}.
            Select your city below.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          {sortedCounties.map(([county, countyCities]) => (
            <div key={county} className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {county} {county.includes("County") || county.includes("Parish") || county.includes("District") ? "" : "County"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {countyCities
                  .sort((a, b) => a.info.name.localeCompare(b.info.name))
                  .map((city) => (
                    <Link
                      key={city.slug}
                      href={`/emergency-plumbers/${stateSlug}/${city.slug}`}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-primary hover:bg-blue-50 transition-colors group"
                    >
                      <div>
                        <span className="font-semibold text-gray-900">
                          {city.info.name}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">Emergency plumbers</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CallToAction />
    </>
  );
}
