import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Emergency Plumbers by City",
  description:
    "Find verified emergency plumbers in your city. Browse our directory of AI-verified, responsive plumbers serving Northern Illinois.",
};

const allCities = [
  { name: "Crystal Lake", state: "IL", slug: "crystal-lake-il", county: "McHenry" },
  { name: "McHenry", state: "IL", slug: "mchenry-il", county: "McHenry" },
  { name: "Algonquin", state: "IL", slug: "algonquin-il", county: "McHenry" },
  { name: "Lake in the Hills", state: "IL", slug: "lake-in-the-hills-il", county: "McHenry" },
  { name: "Huntley", state: "IL", slug: "huntley-il", county: "McHenry" },
  { name: "Woodstock", state: "IL", slug: "woodstock-il", county: "McHenry" },
  { name: "Cary", state: "IL", slug: "cary-il", county: "McHenry" },
  { name: "Marengo", state: "IL", slug: "marengo-il", county: "McHenry" },
  { name: "Harvard", state: "IL", slug: "harvard-il", county: "McHenry" },
  { name: "Carpentersville", state: "IL", slug: "carpentersville-il", county: "Kane" },
  { name: "Elgin", state: "IL", slug: "elgin-il", county: "Kane" },
  { name: "South Elgin", state: "IL", slug: "south-elgin-il", county: "Kane" },
  { name: "St. Charles", state: "IL", slug: "st-charles-il", county: "Kane" },
  { name: "Geneva", state: "IL", slug: "geneva-il", county: "Kane" },
  { name: "Batavia", state: "IL", slug: "batavia-il", county: "Kane" },
  { name: "Aurora", state: "IL", slug: "aurora-il", county: "Kane" },
  { name: "Naperville", state: "IL", slug: "naperville-il", county: "DuPage" },
  { name: "Wheaton", state: "IL", slug: "wheaton-il", county: "DuPage" },
  { name: "Schaumburg", state: "IL", slug: "schaumburg-il", county: "Cook" },
  { name: "Arlington Heights", state: "IL", slug: "arlington-heights-il", county: "Cook" },
];

// Group cities by county
const byCounty = allCities.reduce<Record<string, typeof allCities>>((acc, city) => {
  if (!acc[city.county]) acc[city.county] = [];
  acc[city.county].push(city);
  return acc;
}, {});

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
          {Object.entries(byCounty).map(([county, cities]) => (
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
