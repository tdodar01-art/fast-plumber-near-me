"use client";

import { useState, useMemo } from "react";
import { DollarSign, Zap, Sparkles, Star } from "lucide-react";
import type { Plumber } from "@/lib/types";
import PlumberCard from "./PlumberCard";

type SortMode = "best-match" | "fastest" | "top-rated" | "best-price";

interface PlumberWithDistance extends Plumber {
  distanceMiles?: number;
}

interface Props {
  plumbers: PlumberWithDistance[];
  citySlug: string;
  cityName: string;
}

// --- Pricing tier order (lower = cheaper = better for "Best Price" sort) ---
const PRICE_ORDER: Record<string, number> = {
  budget: 0,
  "mid-range": 1,
  unknown: 2,
  mixed: 3,
  premium: 4,
};

function getPricingTier(p: PlumberWithDistance): string {
  return (p.reviewSynthesis as { pricingTier?: string } | null)?.pricingTier || "unknown";
}

// --- Response score for "Fastest Response" sort ---
function calculateResponseScore(p: PlumberWithDistance): number {
  let score = 0;
  const synthesis = p.reviewSynthesis;
  if (!synthesis) return p.is24Hour ? 1 : 0;

  const badges = synthesis.badges || [];
  const redFlags = synthesis.redFlags || [];
  const emergencySignals = synthesis.emergencySignals || [];

  if (badges.includes("Fast Responder")) score += 3;
  if (emergencySignals.length > 0) score += 2;
  if (badges.includes("24/7 Verified by Reviews")) score += 2;
  if (p.is24Hour) score += 1;
  if (redFlags.includes("slow-response")) score -= 3;
  if (redFlags.includes("emergency-unavailable")) score -= 5;

  // Distance penalty — closer plumbers can respond faster
  if (p.distanceMiles != null) {
    score -= p.distanceMiles / 10;
  }

  return score;
}

function getResponseLabel(score: number): { text: string; color: string } | null {
  if (score >= 5) return { text: "Likely fast response", color: "text-green-600" };
  if (score >= 2) return { text: "Moderate response time", color: "text-gray-500" };
  return { text: "May be slow to respond", color: "text-amber-600" };
}

const SORT_OPTIONS: { mode: SortMode; label: string; icon: typeof Star }[] = [
  { mode: "best-match", label: "Best Match", icon: Sparkles },
  { mode: "fastest", label: "Fastest", icon: Zap },
  { mode: "top-rated", label: "Top Rated", icon: Star },
  { mode: "best-price", label: "Best Price", icon: DollarSign },
];

export default function PlumberListWithSort({ plumbers, citySlug, cityName }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("best-match");

  const sorted = useMemo(() => {
    const arr = [...plumbers];

    switch (sortMode) {
      case "best-match":
        return arr;

      case "fastest":
        return arr.sort((a, b) => calculateResponseScore(b) - calculateResponseScore(a));

      case "top-rated":
        return arr.sort((a, b) => {
          if ((b.googleRating || 0) !== (a.googleRating || 0)) return (b.googleRating || 0) - (a.googleRating || 0);
          return (b.googleReviewCount || 0) - (a.googleReviewCount || 0);
        });

      case "best-price":
        return arr.sort((a, b) => {
          const aTier = PRICE_ORDER[getPricingTier(a)] ?? 2;
          const bTier = PRICE_ORDER[getPricingTier(b)] ?? 2;
          if (aTier !== bTier) return aTier - bTier;
          return (b.googleRating || 0) - (a.googleRating || 0);
        });

      default:
        return arr;
    }
  }, [plumbers, sortMode]);

  return (
    <>
      {/* Sort bar — sticky on mobile */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm py-3 -mx-4 px-4 mb-4 border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {SORT_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                sortMode === mode
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Plumber cards */}
      <div className="space-y-4 mb-12">
        {sorted.map((plumber) => (
          <div key={plumber.id}>
            <PlumberCard
              plumber={plumber}
              citySlug={citySlug}
              distanceMiles={plumber.distanceMiles}
              cityName={cityName}
            />
            {/* Response estimate — only shown when Fastest sort is active */}
            {sortMode === "fastest" && (
              <ResponseEstimate score={calculateResponseScore(plumber)} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function ResponseEstimate({ score }: { score: number }) {
  const label = getResponseLabel(score);
  if (!label) return null;
  return (
    <p className={`text-xs mt-1 ml-4 flex items-center gap-1 ${label.color}`}>
      <Zap className="w-3 h-3" />
      {label.text}
    </p>
  );
}
