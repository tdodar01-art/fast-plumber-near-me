"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ZIP_PREFIX_COORDS } from "@/lib/zip-prefixes";
import { SearchIcon } from "./icons";

/** Slim market shape passed from the server (derived from markets.json). */
export interface SearchMarket {
  name: string;
  /** Two-letter lowercase state code. */
  st: string;
  slug: string;
  lat: number;
  lng: number;
  /** Listed plumber count (rendered in suggestions). */
  plumbers: number;
  /** 24/7-listed count. */
  emergency: number;
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bst\.?\b/g, "saint")
    .replace(/\bmt\.?\b/g, "mount")
    .replace(/[^a-z0-9, ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Suggestion {
  market: SearchMarket;
  /** Present for ZIP matches — approximate distance from the ZIP centroid. */
  distanceMiles?: number;
}

/**
 * Oversized city/ZIP search (02 §2.1 item 2) — pure client-side matching over
 * the committed markets list; every result links straight to a market page.
 * ZIPs resolve through the 3-digit prefix → coords table → nearest market.
 */
export default function MarketSearch({
  markets,
  initFromUrlQuery = false,
  routeFragment = "",
}: {
  markets: SearchMarket[];
  routeFragment?: string;
  /**
   * Read ?q= from the URL on mount and prefill the search (used on /plumbers,
   * the WebSite SearchAction target). Client-only — the page itself stays
   * static and self-canonical; query strings never mint indexable states.
   */
  initFromUrlQuery?: boolean;
}) {
  const router = useRouter();
  const urlQuery = useSyncExternalStore(
    (listener) => {
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    },
    () =>
      initFromUrlQuery
        ? (new URLSearchParams(window.location.search).get("q") ?? "").slice(
            0,
            80,
          )
        : "",
    () => "",
  );
  const [editedQuery, setQuery] = useState<string | null>(null);
  const query = editedQuery ?? urlQuery;
  const [error, setError] = useState("");

  const normalized = useMemo(
    () =>
      markets.map((m) => ({
        m,
        norm: normalize(m.name),
        full: `${normalize(m.name)}, ${m.st}`,
      })),
    [markets],
  );

  const suggestions: Suggestion[] = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    // ZIP mode: 3–5 digits → prefix centroid → nearest covered markets.
    if (/^\d{3,5}$/.test(q)) {
      const coords = ZIP_PREFIX_COORDS[q.slice(0, 3)];
      if (!coords) return [];
      const [lat, lng] = coords;
      return markets
        .map((m) => ({
          market: m,
          distanceMiles: haversineMiles(lat, lng, m.lat, m.lng),
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 5);
    }

    const nq = normalize(q);
    if (!nq) return [];
    const starts: Suggestion[] = [];
    const includes: Suggestion[] = [];
    for (const { m, norm, full } of normalized) {
      if (norm.startsWith(nq) || full.startsWith(nq))
        starts.push({ market: m });
      else if (norm.includes(nq)) includes.push({ market: m });
      if (starts.length >= 8) break;
    }
    return [...starts, ...includes].slice(0, 8);
  }, [query, markets, normalized]);

  const go = (m: SearchMarket) => {
    router.push(`/plumbers/${m.st}/${m.slug}${routeFragment}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      setError("");
      go(suggestions[0].market);
    } else if (query.trim()) {
      setError(
        "We haven't built a guide for that search yet — try a nearby larger city, or browse all states.",
      );
    }
  };

  return (
    <form className="searchbox" role="search" onSubmit={onSubmit}>
      <p className="search-help">
        Search a city or ZIP to find a nearby guide. ZIP matches use an
        approximate area; confirm the business serves your address.
      </p>
      <div className="search-row">
        <input
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          placeholder="City or ZIP code"
          aria-label="City or ZIP code"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError("");
          }}
        />
        <button type="submit">
          <SearchIcon size={18} />
          Build my shortlist
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="search-suggest" role="listbox">
          {suggestions.map((s, i) => (
            <button
              key={`${s.market.st}-${s.market.slug}`}
              type="button"
              className={i === 0 ? "active" : undefined}
              onClick={() => go(s.market)}
            >
              <span>
                {s.market.name}, {s.market.st.toUpperCase()}
              </span>
              <span className="sug-meta num">
                {s.market.plumbers} plumbers
                {s.market.emergency > 0
                  ? ` · ${s.market.emergency} list 24/7`
                  : ""}
                {s.distanceMiles != null
                  ? ` · ${Math.round(s.distanceMiles)} mi`
                  : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="search-err">{error}</p>}
    </form>
  );
}
