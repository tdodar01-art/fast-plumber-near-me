"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, MapPin } from "lucide-react";
import { CITY_LIST, type CityListItem } from "@/lib/city-list";
import { getCityCoordBySlug } from "@/lib/city-coords";
import { calculateDistance } from "@/lib/geo";

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
  // Kane County
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

// Common name variations for fuzzy matching
const NAME_NORMALIZATIONS: Record<string, string> = {
  "saint": "st",
  "st.": "st",
  "mount": "mt",
  "mt.": "mt",
  "fort": "ft",
  "ft.": "ft",
};

function normalizeQuery(q: string): string {
  let normalized = q.toLowerCase().trim();
  for (const [from, to] of Object.entries(NAME_NORMALIZATIONS)) {
    normalized = normalized.replace(new RegExp(`\\b${from}\\b`, "gi"), to);
  }
  return normalized;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface SearchResult {
  city: CityListItem;
  via?: string;
  distanceMiles?: number;
}

export default function CitySearch() {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Build a lookup for city names to CityListItems
  const cityNameIndex = useMemo(() => {
    const index = new Map<string, CityListItem>();
    for (const city of CITY_LIST) {
      // Index by normalized name + state
      index.set(`${normalizeQuery(city.name)}:${city.state.toLowerCase()}`, city);
      // Also index by just the normalized name (first match wins)
      const nameKey = normalizeQuery(city.name);
      if (!index.has(nameKey)) index.set(nameKey, city);
    }
    return index;
  }, []);

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
    setNoMatch(false);
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }

    const matches: SearchResult[] = [];
    const clean = q.trim();

    // Check if it's a zip code
    if (/^\d{3,5}$/.test(clean)) {
      const city = ZIP_MAP[clean];
      if (city) {
        const cityItem = CITY_LIST.find(
          (c) => c.name.toLowerCase() === city.toLowerCase()
        );
        if (cityItem) {
          matches.push({ city: cityItem, via: `ZIP ${clean}` });
        }
      }
      // Partial zip matches
      if (clean.length >= 3) {
        for (const [zip, cityName] of Object.entries(ZIP_MAP)) {
          if (zip.startsWith(clean) && !matches.find((m) => m.city.name === cityName)) {
            const cityItem = CITY_LIST.find(
              (c) => c.name.toLowerCase() === cityName.toLowerCase()
            );
            if (cityItem) matches.push({ city: cityItem, via: `ZIP ${zip}` });
          }
        }
      }
    }

    // Parse "city, state" format
    let searchName = clean;
    let searchState = "";
    const commaIdx = clean.indexOf(",");
    if (commaIdx > 0) {
      searchName = clean.slice(0, commaIdx).trim();
      searchState = clean.slice(commaIdx + 1).trim().toLowerCase();
    }

    const normalizedSearch = normalizeQuery(searchName);

    // State name → abbreviation mapping
    const stateAbbrevs: Record<string, string> = {
      illinois: "il", california: "ca", texas: "tx", florida: "fl",
      "new york": "ny", pennsylvania: "pa", ohio: "oh", georgia: "ga",
      michigan: "mi", "north carolina": "nc", "new jersey": "nj",
      virginia: "va", washington: "wa", arizona: "az", massachusetts: "ma",
      tennessee: "tn", indiana: "in", missouri: "mo", maryland: "md",
      wisconsin: "wi", colorado: "co", minnesota: "mn", "south carolina": "sc",
      alabama: "al", louisiana: "la", kentucky: "ky", oregon: "or",
      oklahoma: "ok", connecticut: "ct", iowa: "ia", utah: "ut",
      nevada: "nv", arkansas: "ar", mississippi: "ms", kansas: "ks",
      "new mexico": "nm", nebraska: "ne", idaho: "id", "west virginia": "wv",
      hawaii: "hi", "new hampshire": "nh", maine: "me", montana: "mt",
      "rhode island": "ri", delaware: "de", "south dakota": "sd",
      "north dakota": "nd", alaska: "ak", vermont: "vt", wyoming: "wy",
    };
    const stateFilter = searchState
      ? stateAbbrevs[searchState] || searchState
      : "";

    // Search CITY_LIST
    for (const city of CITY_LIST) {
      if (matches.find((m) => m.city.citySlug === city.citySlug && m.city.state === city.state)) continue;

      const normalizedCityName = normalizeQuery(city.name);

      // State filter
      if (stateFilter && city.state.toLowerCase() !== stateFilter) continue;

      // Match by substring
      if (normalizedCityName.includes(normalizedSearch) || normalizedSearch.includes(normalizedCityName)) {
        matches.push({ city });
      }
    }

    if (matches.length > 0) {
      // Sort: exact matches first, then alphabetical
      matches.sort((a, b) => {
        const aExact = normalizeQuery(a.city.name) === normalizedSearch ? 0 : 1;
        const bExact = normalizeQuery(b.city.name) === normalizedSearch ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.city.name.localeCompare(b.city.name);
      });

      setResults(matches.slice(0, 6));
      setShowDropdown(true);
    } else if (clean.length >= 3) {
      // No match — find nearest covered city by coordinates if we can
      setNoMatch(true);
      setResults([]);
      setShowDropdown(true);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }

  function navigateToCity(city: CityListItem) {
    setShowDropdown(false);
    setQuery("");
    router.push(`/emergency-plumbers/${city.stateSlug}/${city.citySlug}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results.length > 0) {
      navigateToCity(results[0].city);
    } else if (query.trim()) {
      // Last resort: try exact lookup
      const normalizedSearch = normalizeQuery(query.trim());
      const match = cityNameIndex.get(normalizedSearch);
      if (match) {
        navigateToCity(match);
      } else {
        router.push(`/plumbers`);
      }
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
            autoComplete="off"
            placeholder="Enter your zip code or city"
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => (results.length > 0 || noMatch) && setShowDropdown(true)}
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

      {showDropdown && (
        <ul className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {noMatch && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">
              We don&apos;t have coverage in &ldquo;{query.trim()}&rdquo; yet. Try a nearby city or zip code.
            </li>
          )}
          {results.map((r) => (
            <li key={`${r.city.citySlug}-${r.city.state}`}>
              <button
                className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                onClick={() => navigateToCity(r.city)}
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{r.city.name}, {r.city.state}</span>
                    {r.via && (
                      <span className="text-xs text-gray-400 ml-1.5">({r.via})</span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ color: "#0F6E56", backgroundColor: "#E1F5EE" }}>
                  View plumbers
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
