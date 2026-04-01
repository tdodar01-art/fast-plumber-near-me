"use client";

import { Phone, Star } from "lucide-react";

interface StickyBottomBarProps {
  name: string;
  score: number;
  rating: number | null;
  priceSignal: string;
  phone: string;
}

function getScoreColor(score: number) {
  if (score >= 80) return "#0F6E56";
  if (score >= 60) return "#BA7517";
  return "#A32D2D";
}

function getPriceDollars(signal: string) {
  switch (signal) {
    case "budget": return "$";
    case "mid-range": return "$$";
    case "premium": return "$$$$";
    case "mixed": return "$-$$$";
    default: return "";
  }
}

export default function StickyBottomBar({
  name,
  score,
  rating,
  priceSignal,
  phone,
}: StickyBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-2.5 sm:hidden">
      <div className="max-w-[480px] mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="text-sm font-[family-name:var(--font-fraunces)] font-bold shrink-0"
            style={{ color: getScoreColor(score) }}
          >
            {score}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {rating && (
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3" fill="#EF9F27" stroke="#EF9F27" />
                  {rating.toFixed(1)}
                </span>
              )}
              {getPriceDollars(priceSignal) && (
                <span>{getPriceDollars(priceSignal)}</span>
              )}
            </div>
          </div>
        </div>
        <a
          href={`tel:${phone.replace(/\D/g, "")}`}
          className="shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: "#0F6E56" }}
        >
          <Phone className="w-4 h-4" />
          Call
        </a>
      </div>
    </div>
  );
}
