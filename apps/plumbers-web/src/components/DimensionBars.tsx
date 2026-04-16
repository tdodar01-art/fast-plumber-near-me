"use client";

import Image from "next/image";
import { useState } from "react";
import type { DimensionKey } from "@/lib/decision-engine";
import { FLAG_THRESHOLD, EXCEL_THRESHOLD, type PlumberLike } from "@/lib/plumber-signals";

/**
 * DimensionBars — 5 horizontal bars showing each dimension score 0-100,
 * color-coded by threshold (red <60, amber 60-79, green ≥80), with a tick
 * marking the plumber's percentile rank within the city.
 *
 * Click a bar to reveal the evidence quote supporting that score.
 *
 * Renders nothing if plumber has no scores.
 */

const DIMENSIONS: { key: DimensionKey; label: string; iconSlug: string }[] = [
  { key: "reliability", label: "Reliability", iconSlug: "reliability" },
  { key: "pricing_fairness", label: "Pricing fairness", iconSlug: "pricing" },
  { key: "workmanship", label: "Workmanship", iconSlug: "workmanship" },
  { key: "responsiveness", label: "Responsiveness", iconSlug: "responsiveness" },
  { key: "communication", label: "Communication", iconSlug: "communication" },
];

function barColor(score: number): string {
  if (score < FLAG_THRESHOLD) return "bg-red-500";
  if (score >= EXCEL_THRESHOLD) return "bg-green-500";
  return "bg-amber-400";
}

function textColor(score: number): string {
  if (score < FLAG_THRESHOLD) return "text-red-700";
  if (score >= EXCEL_THRESHOLD) return "text-green-700";
  return "text-amber-700";
}

function iconFor(dim: DimensionKey, score: number): string {
  const slug = DIMENSIONS.find((d) => d.key === dim)!.iconSlug;
  if (score < FLAG_THRESHOLD) return `/icons/signals/${slug}-flag.png`;
  if (score >= EXCEL_THRESHOLD) return `/icons/signals/${slug}-excel.png`;
  return `/icons/signals/${slug}-excel.png`; // neutral — use the excel icon dimmed
}

export default function DimensionBars({
  plumber,
  primaryCitySlug,
}: {
  plumber: PlumberLike;
  primaryCitySlug?: string;
}) {
  const [openKey, setOpenKey] = useState<DimensionKey | null>(null);
  const scores = plumber.scores;
  if (!scores) return null;

  const rank = primaryCitySlug
    ? plumber.city_rank?.[primaryCitySlug] ?? null
    : null;
  const percentiles = rank?.dim_percentiles ?? {};

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">
        How they score across what matters
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Based on {scores.review_count_used} reviews analyzed. Click a row for
        the quote that best illustrates the score.
      </p>
      <div className="space-y-3">
        {DIMENSIONS.map(({ key, label }) => {
          const score = (scores as unknown as Record<string, number>)[key] ?? 0;
          const pct = percentiles[key];
          const evidence = plumber.evidence_quotes?.find(
            (q) => q.dimension === key,
          );
          const isOpen = openKey === key;
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() =>
                  setOpenKey((prev) => (prev === key ? null : key))
                }
                className="w-full text-left group"
                aria-expanded={isOpen}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Image
                      src={iconFor(key, score)}
                      alt=""
                      width={18}
                      height={18}
                      style={{ width: 18, height: 18 }}
                      className={score < FLAG_THRESHOLD || score >= EXCEL_THRESHOLD ? "" : "opacity-50"}
                    />
                    <span className="text-sm font-medium text-gray-800">
                      {label}
                    </span>
                    {pct != null && (
                      <span className="text-[10px] text-gray-400 font-normal">
                        ({pct}th %ile in city)
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${textColor(score)}`}>
                    {score}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full ${barColor(score)} transition-all`}
                    style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                  />
                  {pct != null && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-gray-800 opacity-40"
                      style={{ left: `${pct}%` }}
                      title={`${pct}th percentile in city`}
                    />
                  )}
                </div>
              </button>
              {isOpen && evidence?.quote && (
                <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-xs italic text-gray-600 leading-snug">
                  &ldquo;{evidence.quote}&rdquo;
                  <span className="block not-italic text-[10px] text-gray-400 mt-0.5">
                    — from a customer review
                  </span>
                </blockquote>
              )}
              {isOpen && !evidence?.quote && (
                <p className="mt-2 text-xs text-gray-400 italic">
                  No direct quote available for this dimension yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
