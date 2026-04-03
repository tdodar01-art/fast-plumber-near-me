"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, MapPin } from "lucide-react";

// Zip-to-city mapping for our covered service area
const ZIP_MAP: Record<string, string> = {
  // McHenry County
  "60014": "Crystal Lake", "60012": "Crystal Lake",
  "60050": "McHenry", "60051": "McHenry",
  "60142": "Huntley",
  "60156": "Lake in the Hills",
  "60098": "Woodstock",
  "60152": "Marengo",
  "60033": "Harvard",
  "60013": "Cary",
  "60021": "Fox River Grove",
  "60102": "Algonquin",
  // Kane County (Fox Valley)
  "60120": "Elgin", "60121": "Elgin", "60123": "Elgin", "60124": "Elgin",
  "60174": "St. Charles", "60175": "St. Charles",
  "60134": "Geneva",
  "60510": "Batavia",
  "60502": "Aurora", "60503": "Aurora", "60504": "Aurora", "60505": "Aurora", "60506": "Aurora",
  "60177": "South Elgin",
  "60542": "North Aurora",
  "60538": "Montgomery",
  "60110": "Carpentersville",
  // Lake County
  "60048": "Libertyville",
  "60060": "Mundelein",
  "60031": "Gurnee",
  "60087": "Waukegan", "60085": "Waukegan",
  "60047": "Lake Zurich",
  "60030": "Grayslake",
  "60002": "Antioch",
  "60073": "Round Lake",
  "60099": "Zion",
  // DuPage County
  "60540": "Naperville", "60563": "Naperville", "60564": "Naperville", "60565": "Naperville",
  "60187": "Wheaton", "60189": "Wheaton",
  "60515": "Downers Grove", "60516": "Downers Grove",
  "60126": "Elmhurst",
  "60148": "Lombard",
  "60137": "Glen Ellyn",
  "60521": "Hinsdale",
  "60532": "Lisle",
  // Northwest Cook
  "60173": "Schaumburg", "60193": "Schaumburg", "60194": "Schaumburg", "60195": "Schaumburg",
  "60004": "Arlington Heights", "60005": "Arlington Heights",
  "60067": "Palatine", "60074": "Palatine",
  "60169": "Hoffman Estates", "60192": "Hoffman Estates",
  "60016": "Des Plaines", "60018": "Des Plaines",
};

// Cities that have plumber coverage (scraped + 5-mile service radius)
const COVERED_CITIES = [
  "Algonquin", "Carpentersville", "Cary", "Crystal Lake", "Deerfield",
  "Elgin", "Fox River Grove", "Glencoe", "Harvard", "Highland Park",
  "Huntley", "Lake in the Hills", "Lake Zurich", "Marengo", "McHenry",
  "Northbrook", "Round Lake", "South Elgin", "St. Charles", "Streamwood",
  "Winnetka", "Woodstock",
];

// All cities in our service area for suggestions
const ALL_SERVICE_CITIES = [
  ...COVERED_CITIES,
  "St. Charles", "Geneva", "Batavia", "Aurora", "South Elgin",
  "North Aurora", "Montgomery", "Carpentersville",
  "Libertyville", "Mundelein", "Gurnee", "Waukegan", "Lake Zurich",
  "Grayslake", "Antioch", "Round Lake", "Zion",
  "Naperville", "Wheaton", "Downers Grove", "Elmhurst", "Lombard",
  "Glen Ellyn", "Hinsdale", "Lisle",
  "Schaumburg", "Arlington Heights", "Palatine", "Hoffman Estates", "Des Plaines",
].sort();

interface SearchResult {
  city: string;
  hasCoverage: boolean;
  via?: string; // "zip" if matched via zip
}

export default function CitySearch() {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }

    const matches: SearchResult[] = [];
    const clean = q.trim();

    // Check if it's a zip code
    if (/^\d{3,5}$/.test(clean)) {
      const city = ZIP_MAP[clean];
      if (city) {
        matches.push({
          city,
          hasCoverage: COVERED_CITIES.includes(city),
          via: `ZIP ${clean}`,
        });
      }
      // Also check partial zip matches
      if (clean.length >= 3) {
        for (const [zip, city] of Object.entries(ZIP_MAP)) {
          if (zip.startsWith(clean) && !matches.find(m => m.city === city)) {
            matches.push({
              city,
              hasCoverage: COVERED_CITIES.includes(city),
              via: `ZIP ${zip}`,
            });
          }
        }
      }
    }

    // City name search
    const lower = clean.toLowerCase();
    for (const city of ALL_SERVICE_CITIES) {
      if (city.toLowerCase().includes(lower) && !matches.find(m => m.city === city)) {
        matches.push({
          city,
          hasCoverage: COVERED_CITIES.includes(city),
        });
      }
    }

    setResults(matches.slice(0, 6));
    setShowDropdown(matches.length > 0);
  }

  function handleSelect(city: string, hasCoverage: boolean) {
    setShowDropdown(false);
    setQuery("");
    if (hasCoverage) {
      router.push(`/plumbers?city=${encodeURIComponent(city)}`);
    } else {
      router.push(`/plumbers`);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0].city, results[0].hasCoverage);
    } else if (query.trim()) {
      router.push(`/plumbers`);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            inputMode="text"
            placeholder="Enter your zip code or city"
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="w-full pl-12 pr-4 py-3.5 min-h-[48px] text-lg rounded-xl border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-xl text-base font-bold text-white bg-accent hover:bg-accent-dark transition-colors shadow-lg shadow-accent/25 sm:w-auto"
        >
          Find Plumbers
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {showDropdown && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {results.map((r) => (
            <li key={r.city + (r.via || "")}>
              <button
                className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                onClick={() => handleSelect(r.city, r.hasCoverage)}
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{r.city}, IL</span>
                    {r.via && (
                      <span className="text-xs text-gray-400 ml-1.5">({r.via})</span>
                    )}
                  </div>
                </div>
                {r.hasCoverage ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: "#0F6E56", backgroundColor: "#E1F5EE" }}>
                    Plumbers available
                  </span>
                ) : (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                    Coming soon
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
