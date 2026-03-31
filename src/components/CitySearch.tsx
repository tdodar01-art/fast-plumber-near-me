"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const CITIES = [
  { name: "Crystal Lake", state: "IL", slug: "crystal-lake-il" },
  { name: "McHenry", state: "IL", slug: "mchenry-il" },
  { name: "Algonquin", state: "IL", slug: "algonquin-il" },
  { name: "Lake in the Hills", state: "IL", slug: "lake-in-the-hills-il" },
  { name: "Huntley", state: "IL", slug: "huntley-il" },
  { name: "Woodstock", state: "IL", slug: "woodstock-il" },
  { name: "Cary", state: "IL", slug: "cary-il" },
  { name: "Marengo", state: "IL", slug: "marengo-il" },
  { name: "Harvard", state: "IL", slug: "harvard-il" },
  { name: "Carpentersville", state: "IL", slug: "carpentersville-il" },
  { name: "Elgin", state: "IL", slug: "elgin-il" },
  { name: "South Elgin", state: "IL", slug: "south-elgin-il" },
  { name: "St. Charles", state: "IL", slug: "st-charles-il" },
  { name: "Geneva", state: "IL", slug: "geneva-il" },
  { name: "Batavia", state: "IL", slug: "batavia-il" },
  { name: "Aurora", state: "IL", slug: "aurora-il" },
  { name: "Naperville", state: "IL", slug: "naperville-il" },
  { name: "Wheaton", state: "IL", slug: "wheaton-il" },
  { name: "Schaumburg", state: "IL", slug: "schaumburg-il" },
  { name: "Arlington Heights", state: "IL", slug: "arlington-heights-il" },
];

export default function CitySearch() {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  const filtered = query.length > 0
    ? CITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.slug.includes(query.toLowerCase())
      )
    : [];

  const handleSelect = (slug: string) => {
    setShowDropdown(false);
    setQuery("");
    router.push(`/emergency-plumbers/${slug}`);
  };

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Enter your city or zip code..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none shadow-sm text-gray-900"
        />
      </div>
      {showDropdown && filtered.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map((city) => (
            <li key={city.slug}>
              <button
                className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-900 transition-colors"
                onClick={() => handleSelect(city.slug)}
              >
                {city.name}, {city.state}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
