"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CITY_LIST } from "@/lib/city-list";

export default function CitySearch() {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  const filtered =
    query.length > 1
      ? CITY_LIST.filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.citySlug.includes(query.toLowerCase())
        ).slice(0, 8)
      : [];

  const handleSelect = (stateSlug: string, citySlug: string) => {
    setShowDropdown(false);
    setQuery("");
    router.push(`/emergency-plumbers/${stateSlug}/${citySlug}`);
  };

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Enter your city (e.g. Phoenix, Chicago, Miami)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => query.length > 1 && setShowDropdown(true)}
          className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none shadow-sm text-gray-900"
        />
      </div>
      {showDropdown && filtered.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map((city) => (
            <li key={`${city.stateSlug}-${city.citySlug}`}>
              <button
                className="w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-900 transition-colors"
                onClick={() => handleSelect(city.stateSlug, city.citySlug)}
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
