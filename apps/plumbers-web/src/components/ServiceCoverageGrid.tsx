"use client";

import { useState } from "react";
import type { SpecialtyKey, ServiceCategory } from "@/lib/decision-engine";
import type { PlumberLike } from "@/lib/plumber-signals";

/**
 * ServiceCoverageGrid — 12-cell grid showing what this plumber does well,
 * does poorly, and has no data on. Each cell = one of the 12 specialty_keys
 * in scores.specialty_strength, cross-referenced with reviewSynthesis.
 * servicesMentioned for actual review evidence.
 *
 * Click a cell to reveal the avg rating + top quote from reviews that
 * mentioned that service.
 */

// Map specialty_strength keys (underscore) to servicesMentioned keys (hyphen).
// Some don't have 1:1 matches — we try the closest or leave null.
const KEY_MAP: Record<SpecialtyKey, ServiceCategory | null> = {
  water_heater: "water-heater",
  drain: "drain-cleaning",
  repipe: "repiping",
  emergency: "burst-pipe",
  remodel: "bathroom-remodel",
  sewer: "sewer",
  toilet: "toilet",
  fixture: "faucet-fixture",
  sump_pump: "sump-pump",
  gas_line: "gas-leak",
  slab_leak: "slab-leak",
  water_line: "water-line",
};

const DISPLAY_NAMES: Record<SpecialtyKey, string> = {
  water_heater: "Water heater",
  drain: "Drain",
  repipe: "Repiping",
  emergency: "Emergency",
  remodel: "Remodel",
  sewer: "Sewer line",
  toilet: "Toilet",
  fixture: "Fixtures",
  sump_pump: "Sump pump",
  gas_line: "Gas line",
  slab_leak: "Slab leak",
  water_line: "Water line",
};

const SPECIALTY_KEYS: SpecialtyKey[] = [
  "emergency", "water_heater", "drain", "sewer",
  "toilet", "fixture", "gas_line", "water_line",
  "repipe", "remodel", "sump_pump", "slab_leak",
];

function cellColor(score: number, reviewCount: number): string {
  if (reviewCount === 0 && score === 0) return "bg-gray-50 border-gray-200";
  if (score >= 85) return "bg-green-100 border-green-300";
  if (score >= 65) return "bg-emerald-50 border-emerald-200";
  if (score >= 50) return "bg-amber-50 border-amber-200";
  if (score > 0) return "bg-red-50 border-red-300";
  return "bg-gray-50 border-gray-200";
}

function scoreLabel(score: number, reviewCount: number): string {
  if (reviewCount === 0 && score === 0) return "—";
  if (score >= 85) return "Excels";
  if (score >= 65) return "Good";
  if (score >= 50) return "Mixed";
  if (score > 0) return "Concerns";
  return "—";
}

export default function ServiceCoverageGrid({
  plumber,
}: {
  plumber: PlumberLike;
}) {
  const [openKey, setOpenKey] = useState<SpecialtyKey | null>(null);
  const scores = plumber.scores;
  if (!scores) return null;
  const specialty = scores.specialty_strength ?? {};
  const rs = (plumber.reviewSynthesis ?? plumber.synthesis ?? null) as
    | { servicesMentioned?: Partial<Record<ServiceCategory, { count: number; avgRating: number; topQuote: string }>> }
    | null;
  const services = rs?.servicesMentioned ?? {};

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">
        What they do well (and don&rsquo;t)
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Green means reviews confirm they&rsquo;re good at it. Red means reviewers flag issues. Gray means no reviews talk about it yet.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {SPECIALTY_KEYS.map((key) => {
          const score = (specialty as Record<string, number>)[key] ?? 0;
          const serviceKey = KEY_MAP[key];
          const sm = serviceKey ? services[serviceKey] : undefined;
          const reviewCount = sm?.count ?? 0;
          const isOpen = openKey === key;
          const hasData = reviewCount > 0 || score > 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => hasData && setOpenKey((p) => (p === key ? null : key))}
              className={`text-left p-2.5 rounded-lg border ${cellColor(score, reviewCount)} transition-shadow ${
                hasData ? "cursor-pointer hover:shadow-sm" : "cursor-default"
              } ${isOpen ? "ring-2 ring-gray-400" : ""}`}
              aria-label={`${DISPLAY_NAMES[key]} — ${scoreLabel(score, reviewCount)}`}
            >
              <div className="text-[11px] font-semibold text-gray-700 leading-tight">
                {DISPLAY_NAMES[key]}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {scoreLabel(score, reviewCount)}
                {reviewCount > 0 && ` · ${reviewCount} reviews`}
              </div>
            </button>
          );
        })}
      </div>
      {openKey && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold text-gray-900">
              {DISPLAY_NAMES[openKey]}
            </p>
            {(() => {
              const svc = KEY_MAP[openKey] ? services[KEY_MAP[openKey]!] : undefined;
              return svc ? (
                <span className="text-xs text-gray-600">
                  {svc.count} reviews · avg {svc.avgRating.toFixed(1)}★
                </span>
              ) : null;
            })()}
          </div>
          {(() => {
            const svc = KEY_MAP[openKey] ? services[KEY_MAP[openKey]!] : undefined;
            return svc?.topQuote ? (
              <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-xs italic text-gray-600 leading-snug">
                &ldquo;{svc.topQuote}&rdquo;
              </blockquote>
            ) : (
              <p className="mt-2 text-xs text-gray-400 italic">
                No direct reviewer quote captured yet.
              </p>
            );
          })()}
        </div>
      )}
    </section>
  );
}
