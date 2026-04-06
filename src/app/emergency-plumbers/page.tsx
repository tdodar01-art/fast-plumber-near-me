import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { STATES_DATA } from "@/lib/states-data";
import { CITY_DATA, getStatesWithCities, getTotalCityCount } from "@/lib/cities-data";

export const metadata: Metadata = {
  title: "Emergency Plumbers by State",
  description:
    "Find verified emergency plumbers across the United States. Browse by state to find 24/7 plumbers in your city.",
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://fastplumbernearme.com" },
    { "@type": "ListItem", position: 2, name: "Emergency Plumbers", item: "https://fastplumbernearme.com/emergency-plumbers" },
  ],
};

export default function EmergencyPlumbersIndex() {
  const statesWithCities = getStatesWithCities();
  const totalCities = getTotalCityCount();

  // Sort states by number of cities (most first)
  const sortedStates = statesWithCities
    .map((abbr) => ({
      ...STATES_DATA[abbr],
      cityCount: Object.keys(CITY_DATA[abbr] || {}).length,
    }))
    .filter((s) => s.name)
    .sort((a, b) => b.cityCount - a.cityCount);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Emergency Plumbers by State
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Serving {totalCities} cities across {sortedStates.length} states. Select your state to find verified emergency plumbers.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sortedStates.map((state) => (
              <Link
                key={state.abbreviation}
                href={`/emergency-plumbers/${state.slug}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-primary hover:bg-blue-50 transition-colors group"
              >
                <div>
                  <span className="font-semibold text-gray-900">{state.name}</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {state.cityCount} {state.cityCount === 1 ? "city" : "cities"}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
