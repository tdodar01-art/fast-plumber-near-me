import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Phone, Star, ArrowRight } from "lucide-react";
import {
  getPlumbersRanked,
  getUniqueCities,
  getDataMeta,
} from "@/lib/plumber-data";
import TrustScoreRing from "@/components/profile/TrustScoreRing";
import DirectoryFilters from "./DirectoryFilters";

export const metadata: Metadata = {
  title: "Ranked Plumbers — Honest Reviews & Trust Scores",
  description:
    "Every plumber ranked by trust score. AI-analyzed Google reviews show the truth — strengths, weaknesses, and red flags. No paid placements.",
};

function getPriceDollars(signal: string) {
  switch (signal) {
    case "budget": return { text: "$", color: "#0F6E56" };
    case "mid-range": return { text: "$$", color: "#854F0B" };
    case "premium": return { text: "$$$$", color: "#A32D2D" };
    case "mixed": return { text: "$-$$$", color: "#854F0B" };
    default: return { text: "", color: "#6B7280" };
  }
}

export default function PlumbersDirectoryPage() {
  const plumbers = getPlumbersRanked();
  const cities = getUniqueCities();
  const meta = getDataMeta();
  const withSynthesis = plumbers.filter((p) => p.synthesis);

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6 font-[family-name:var(--font-dm-sans)]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-gray-900 mb-1">
          Plumber rankings
        </h1>
        <p className="text-sm text-gray-500">
          {withSynthesis.length} plumbers analyzed across{" "}
          {cities.length} cities. Ranked by AI trust score, not ad spend.
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={<div className="h-8 mb-5" />}>
        <DirectoryFilters cities={cities} />
      </Suspense>

      {/* Plumber List */}
      <div className="space-y-3" id="plumber-list">
        {plumbers.map((plumber, index) => {
          const s = plumber.synthesis;
          const rank = index + 1;
          const price = getPriceDollars(s?.priceSignal ?? "unknown");
          const hasRedFlags = (s?.redFlags?.length ?? 0) > 0;

          return (
            <div
              key={plumber.placeId}
              className="rounded-xl p-4 relative"
              style={{ border: hasRedFlags ? "1.5px solid #F09595" : "0.5px solid #E5E7EB" }}
              data-city={plumber.city}
              data-trust={s?.trustLevel ?? ""}
              data-price={s?.priceSignal ?? ""}
            >
              <div className="flex items-start gap-3">
                {/* Rank */}
                <span className="text-lg font-[family-name:var(--font-fraunces)] font-bold text-gray-300 w-7 text-center shrink-0 pt-1">
                  {rank}
                </span>

                {/* Score ring */}
                {s && (
                  <div className="shrink-0 pt-0.5">
                    <TrustScoreRing score={s.score} size="sm" />
                  </div>
                )}

                {/* Info */}
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
                            <span className="text-gray-400">
                              ({plumber.googleReviewCount.toLocaleString()})
                            </span>
                          </span>
                        )}
                        {price.text && (
                          <span className="font-semibold" style={{ color: price.color }}>
                            {price.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  {s && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {s.summary}
                    </p>
                  )}

                  {/* Red flag indicator */}
                  {hasRedFlags && (
                    <p className="text-xs font-semibold mt-1.5" style={{ color: "#A32D2D" }}>
                      {s!.redFlags.length} red flag{s!.redFlags.length > 1 ? "s" : ""} found
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-2.5">
                    <Link
                      href={`/plumber/${plumber.slug}`}
                      className="flex items-center gap-1 text-xs font-semibold hover:underline"
                      style={{ color: "#0C447C" }}
                    >
                      View profile
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <a
                      href={`tel:${plumber.phone.replace(/\D/g, "")}`}
                      className="flex items-center gap-1 text-xs font-bold text-white px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: "#0F6E56" }}
                    >
                      <Phone className="w-3 h-3" />
                      Call
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 mt-8 mb-4">
        Data from Google Reviews, analyzed by AI &middot; Last updated{" "}
        {new Date(meta.synthesizedAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </div>
    </div>
  );
}
