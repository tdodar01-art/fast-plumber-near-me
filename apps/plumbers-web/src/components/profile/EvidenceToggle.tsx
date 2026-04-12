"use client";

import { useState } from "react";
import { ChevronDown, Quote } from "lucide-react";
import type { EvidenceQuote } from "@/lib/decision-engine";

const DIM_LABELS: Record<string, string> = {
  reliability: "Reliability",
  pricing_fairness: "Pricing",
  workmanship: "Workmanship",
  responsiveness: "Responsiveness",
  communication: "Communication",
};

export default function EvidenceToggle({ quotes }: { quotes: EvidenceQuote[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "0.5px solid #E5E7EB" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide font-[family-name:var(--font-dm-sans)]">
          Evidence from reviews ({quotes.length})
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3">
          {quotes.map((eq, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Quote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-300" />
              <div>
                <p className="text-sm text-gray-700 font-[family-name:var(--font-dm-sans)] italic">
                  &ldquo;{eq.quote}&rdquo;
                </p>
                <p className="text-xs text-gray-400 mt-0.5 font-[family-name:var(--font-dm-sans)]">
                  {DIM_LABELS[eq.dimension] ?? eq.dimension}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
