import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { CITY_LIST } from "@/lib/city-list";

export const metadata: Metadata = {
  title: "Emergency Plumbers by City",
  description:
    "Find verified emergency plumbers in your city. Browse our directory of AI-verified, responsive plumbers serving Northern Illinois.",
};

// Group cities by county
const byCounty = CITY_LIST.reduce<Record<string, typeof CITY_LIST>>((acc, city) => {
  if (!acc[city.county]) acc[city.county] = [];
  acc[city.county].push(city);
  return acc;
}, {});

// Sort counties by number of cities (largest first)
const sortedCounties = Object.entries(byCounty).sort(
  ([, a], [, b]) => b.length - a.length
);

export default function EmergencyPlumbersIndex() {
  return (
    <>
      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Emergency Plumbers by City
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Browse verified emergency plumbers serving Northern Illinois. Select your city below.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          {sortedCounties.map(([county, cities]) => (
            <div key={county} className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {county} County
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {cities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/emergency-plumbers/${city.slug}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-primary hover:bg-blue-50 transition-colors group"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">
                        {city.name}, {city.state}
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
    </>
  );
}
