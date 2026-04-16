"use client";

import Image from "next/image";
import { useState } from "react";
import type { Signal } from "@/lib/plumber-signals";

/**
 * SignalChip — one icon + label, with a tooltip/popover that reveals the
 * detail and any evidence quote. Click to toggle (for mobile); hover-only
 * tooltip on desktop also works via the browser's `title` attribute.
 *
 * Color keying:
 *   flag  — red tinted pill
 *   excel — green tinted pill
 *   info  — neutral gray
 *   seal  (verdict) — colored by verdict id: gold / green / amber / red
 */

type ChipStyle = {
  bg: string;
  text: string;
  border: string;
  ring: string;
  bold?: boolean;
};

const KIND_STYLES: Record<string, ChipStyle> = {
  flag: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    ring: "ring-red-300",
  },
  excel: {
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border-green-200",
    ring: "ring-green-300",
  },
  info: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    ring: "ring-gray-300",
  },
};

// Verdict chips get per-verdict styling — these are HEADLINE signals, so
// they're slightly bolder than regular chips (heavier weight + stronger
// color) to draw the eye.
const VERDICT_STYLES: Record<string, ChipStyle> = {
  "verdict-strong_hire": {
    bg: "bg-yellow-100",
    text: "text-yellow-900",
    border: "border-yellow-400",
    ring: "ring-yellow-400",
    bold: true,
  },
  "verdict-conditional_hire": {
    bg: "bg-green-100",
    text: "text-green-900",
    border: "border-green-400",
    ring: "ring-green-400",
    bold: true,
  },
  "verdict-caution": {
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-400",
    ring: "ring-amber-400",
    bold: true,
  },
  "verdict-avoid": {
    bg: "bg-red-100",
    text: "text-red-900",
    border: "border-red-400",
    ring: "ring-red-400",
    bold: true,
  },
};

function styleFor(signal: Signal): ChipStyle {
  if (signal.kind === "seal") {
    return VERDICT_STYLES[signal.id] ?? KIND_STYLES.info;
  }
  return KIND_STYLES[signal.kind] ?? KIND_STYLES.info;
}

export default function SignalChip({
  signal,
  compact = false,
}: {
  signal: Signal;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const styles = styleFor(signal);

  const hasDetail = Boolean(signal.detail || signal.evidence);

  const handleClick = (e: React.MouseEvent) => {
    if (!hasDetail) return;
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const weightClass = styles.bold ? "font-bold" : "font-medium";
  const iconSize = signal.kind === "seal" ? (compact ? 16 : 20) : compact ? 14 : 18;

  return (
    <div
      className="relative inline-block"
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        title={`${signal.label} — ${signal.detail}`}
        className={`inline-flex items-center gap-1.5 ${styles.bg} ${styles.text} ${styles.border} border rounded-full ${
          compact ? "px-2 py-0.5" : "px-2.5 py-1"
        } text-xs ${weightClass} whitespace-nowrap transition-shadow cursor-help ${
          open ? `ring-2 ${styles.ring}` : ""
        }`}
      >
        <Image
          src={signal.icon}
          alt=""
          width={iconSize}
          height={iconSize}
          className="flex-shrink-0"
          style={{ width: iconSize, height: iconSize }}
        />
        <span className="leading-none">{signal.label}</span>
      </button>

      {open && hasDetail && (
        <div
          className={`absolute top-full left-0 mt-1.5 z-20 w-72 ${styles.bg} ${styles.border} border rounded-lg shadow-lg p-3 text-left`}
          onClick={(e) => e.stopPropagation()}
        >
          <p className={`text-xs font-semibold ${styles.text} leading-tight`}>
            {signal.label}
          </p>
          <p className="text-[11px] text-gray-700 leading-snug mt-1">
            {signal.detail}
          </p>
          {signal.evidence && (
            <blockquote className="mt-2 pl-2 border-l-2 border-gray-300 text-[11px] italic text-gray-600 leading-snug">
              &ldquo;{signal.evidence}&rdquo;
            </blockquote>
          )}
        </div>
      )}
    </div>
  );
}
