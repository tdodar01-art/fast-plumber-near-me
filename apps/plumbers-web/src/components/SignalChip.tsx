"use client";

import Image from "next/image";
import { useState } from "react";
import type { Signal } from "@/lib/plumber-signals";

/**
 * SignalChip — one icon + label, with a tooltip/popover that reveals the
 * detail and any evidence quote. Click to toggle (for mobile); hover-only
 * tooltip on desktop also works via the browser's `title` attribute.
 *
 * Color keying per kind:
 *   flag  — red tinted pill
 *   excel — green tinted pill
 *   info  — neutral gray
 *   seal  — should use VerdictSeal instead
 */

const KIND_STYLES = {
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
  seal: {
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    border: "border-yellow-200",
    ring: "ring-yellow-300",
  },
} as const;

export default function SignalChip({
  signal,
  compact = false,
}: {
  signal: Signal;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const styles = KIND_STYLES[signal.kind];

  const hasDetail = Boolean(signal.detail || signal.evidence);

  const handleClick = (e: React.MouseEvent) => {
    if (!hasDetail) return;
    e.stopPropagation();
    setOpen((v) => !v);
  };

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
        } text-xs font-medium whitespace-nowrap transition-shadow cursor-help ${
          open ? `ring-2 ${styles.ring}` : ""
        }`}
      >
        <Image
          src={signal.icon}
          alt=""
          width={compact ? 14 : 18}
          height={compact ? 14 : 18}
          className="flex-shrink-0"
          style={{ width: compact ? 14 : 18, height: compact ? 14 : 18 }}
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
