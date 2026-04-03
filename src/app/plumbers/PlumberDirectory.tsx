"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, Zap, Star, DollarSign, Phone, ArrowRight, MapPin } from "lucide-react";
import type { SynthesizedPlumber } from "@/lib/plumber-data";
import { calculateDistance, getDistanceWeight, getDistanceLabel } from "@/lib/geo";

type SortMode = "best-match" | "fastest" | "top-rated" | "best-price";

interface Props {
  plumbers: SynthesizedPlumber[];
  cityCoords: Record<string, [number, number]>; // "CityName" -> [lat, lng]
}

const PRICE_ORDER: Record<string, number> = {
  budget: 0, "mid-range": 1, unknown: 2, mixed: 3, premium: 4,
};

function responseScore(p: SynthesizedPlumber, dist: number | null): number {
  let score = 0;
  const s = p.synthesis;
  if (!s) return p.is24Hour ? 1 : 0;
  // Derive badges from strengths (plumber-data doesn't have explicit badges)
  const str = s.strengths.join(" ").toLowerCase();
  if (str.includes("fast") || str.includes("quick") || str.includes("prompt")) score += 3;
  if (s.bestFor?.some((b) => b.toLowerCase().includes("emergency"))) score += 2;
  if (p.is24Hour) score += 2;
  if (s.redFlags?.includes("slow-response")) score -= 3;
  if (s.redFlags?.includes("emergency-unavailable")) score -= 5;
  if (dist != null) score -= dist / 10;
  return score;
}

function getResponseLabel(score: number) {
  if (score >= 5) return { text: "Likely fast response", color: "text-green-600" };
  if (score >= 2) return { text: "Moderate response time", color: "text-gray-500" };
  return { text: "May be slow to respond", color: "text-amber-600" };
}

function getPriceDollars(signal: string) {
  switch (signal) {
    case "budget": return { text: "$", color: "#0F6E56" };
    case "mid-range": return { text: "$$", color: "#854F0B" };
    case "premium": return { text: "$$$$", color: "#A32D2D" };
    case "mixed": return { text: "$-$$$", color: "#854F0B" };
    default: return { text: "", color: "#6B7280" };
  }
}

const SORT_OPTIONS: { mode: SortMode; label: string; icon: typeof Star }[] = [
  { mode: "best-match", label: "Best Match", icon: Sparkles },
  { mode: "fastest", label: "Fastest", icon: Zap },
  { mode: "top-rated", label: "Top Rated", icon: Star },
  { mode: "best-price", label: "Best Price", icon: DollarSign },
];

export default function PlumberDirectory({ plumbers, cityCoords }: Props) {
  const searchParams = useSearchParams();
  const cityFilter = searchParams.get("city") || "";
  const [sortMode, setSortMode] = useState<SortMode>("best-match");

  // Calculate distance for each plumber when city is selected
  const plumbersWithDistance = useMemo(() => {
    const cityCoord = cityFilter ? cityCoords[cityFilter] : null;
    return plumbers.map((p) => {
      let dist: number | null = null;
      if (cityCoord && p.location) {
        dist = calculateDistance(cityCoord[0], cityCoord[1], p.location.lat, p.location.lng);
      }
      return { ...p, distanceMiles: dist };
    });
  }, [plumbers, cityFilter, cityCoords]);

  // Filter by 20-mile radius when city is selected
  const filtered = useMemo(() => {
    if (!cityFilter) return plumbersWithDistance;
    return plumbersWithDistance.filter((p) => {
      // Include if within 20 miles
      if (p.distanceMiles != null && p.distanceMiles <= 20) return true;
      // Also include if city matches directly
      if (p.city === cityFilter) return true;
      if (p.serviceCities?.includes(cityFilter)) return true;
      return false;
    });
  }, [plumbersWithDistance, cityFilter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case "best-match":
        return arr.sort((a, b) => {
          const aScore = (a.synthesis?.score ?? 0) * getDistanceWeight(a.distanceMiles ?? 0);
          const bScore = (b.synthesis?.score ?? 0) * getDistanceWeight(b.distanceMiles ?? 0);
          return bScore - aScore;
        });
      case "fastest":
        return arr.sort((a, b) => responseScore(b, b.distanceMiles) - responseScore(a, a.distanceMiles));
      case "top-rated":
        return arr.sort((a, b) => {
          if ((b.googleRating ?? 0) !== (a.googleRating ?? 0)) return (b.googleRating ?? 0) - (a.googleRating ?? 0);
          return (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0);
        });
      case "best-price":
        return arr.sort((a, b) => {
          const aPrice = PRICE_ORDER[a.synthesis?.priceSignal ?? "unknown"] ?? 2;
          const bPrice = PRICE_ORDER[b.synthesis?.priceSignal ?? "unknown"] ?? 2;
          if (aPrice !== bPrice) return aPrice - bPrice;
          return (b.synthesis?.score ?? 0) - (a.synthesis?.score ?? 0);
        });
      default:
        return arr;
    }
  }, [filtered, sortMode]);

  return (
    <>
      {/* Sort bar — sticky */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {SORT_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                sortMode === mode
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Showing {sorted.length} plumber{sorted.length !== 1 ? "s" : ""}
          {cityFilter ? ` near ${cityFilter}` : ""}
        </p>
      </div>

      {/* Plumber list */}
      <div className="space-y-3 mt-4">
        {sorted.map((plumber, index) => {
          const s = plumber.synthesis;
          const hasRedFlags = (s?.redFlags?.length ?? 0) > 0;
          const price = getPriceDollars(s?.priceSignal ?? "unknown");
          const distLabel = plumber.distanceMiles != null ? getDistanceLabel(plumber.distanceMiles, cityFilter || undefined) : null;

          return (
            <div
              key={plumber.placeId}
              className="rounded-xl p-4 relative"
              style={{ border: hasRedFlags ? "1.5px solid #F09595" : "0.5px solid #E5E7EB" }}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg font-[family-name:var(--font-fraunces)] font-bold text-gray-300 w-7 text-center shrink-0 pt-1">
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/plumber/${plumber.slug}`}
                        className="font-bold text-gray-900 hover:text-primary text-sm leading-tight block"
                      >
                        {plumber.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        <span>{plumber.city}</span>
                        {plumber.googleRating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3" fill="#EF9F27" stroke="#EF9F27" />
                            {plumber.googleRating.toFixed(1)}
                            <span className="text-gray-400">({plumber.googleReviewCount.toLocaleString()})</span>
                          </span>
                        )}
                        {price.text && (
                          <span className="font-semibold" style={{ color: price.color }}>{price.text}</span>
                        )}
                      </div>
                      {/* Distance */}
                      {distLabel && (
                        <p className={`flex items-center gap-1 text-xs mt-0.5 ${distLabel.color === "amber" ? "text-amber-600" : "text-gray-400"}`}>
                          <MapPin className="w-3 h-3" />
                          {distLabel.text}
                        </p>
                      )}
                    </div>
                  </div>

                  {s && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{s.summary}</p>}

                  {hasRedFlags && (
                    <p className="text-xs font-semibold mt-1.5" style={{ color: "#A32D2D" }}>
                      {s!.redFlags.length} red flag{s!.redFlags.length > 1 ? "s" : ""} found
                    </p>
                  )}

                  {/* Response estimate when Fastest sort active */}
                  {sortMode === "fastest" && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${getResponseLabel(responseScore(plumber, plumber.distanceMiles)).color}`}>
                      <Zap className="w-3 h-3" />
                      {getResponseLabel(responseScore(plumber, plumber.distanceMiles)).text}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2.5">
                    <Link href={`/plumber/${plumber.slug}`} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "#0C447C" }}>
                      View profile <ArrowRight className="w-3 h-3" />
                    </Link>
                    <a href={`tel:${plumber.phone.replace(/\D/g, "")}`} className="flex items-center gap-1 text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#0F6E56" }}>
                      <Phone className="w-3 h-3" /> Call
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">No plumbers found{cityFilter ? ` near ${cityFilter}` : ""}.</p>
          </div>
        )}
      </div>
    </>
  );
}
