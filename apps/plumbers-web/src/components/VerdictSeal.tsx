import Image from "next/image";
import type { Verdict } from "@/lib/decision-engine";

/**
 * VerdictSeal — nano-banana generated circular seal that shows a plumber's
 * decision verdict at a glance. 4 variants: strong_hire (gold), conditional
 * (silver), caution (amber), avoid (red).
 *
 * Placed on both card headers (sm) and detail pages (lg). If the plumber
 * has no decision (Pass 3 never ran), renders nothing.
 */

const SEAL_CONFIG: Record<
  Verdict,
  { filename: string; label: string; description: string }
> = {
  strong_hire: {
    filename: "verdict-strong-hire.svg",
    label: "Top pick",
    description:
      "Consistently strong across reliability, workmanship, pricing, and response. Safe to call first.",
  },
  conditional_hire: {
    filename: "verdict-conditional.svg",
    label: "Solid pick",
    description:
      "Good in most areas with a caveat or two. Worth calling, but read the specifics.",
  },
  caution: {
    filename: "verdict-caution.png",
    label: "Proceed with care",
    description:
      "Reviews reveal real concerns in at least one area. Get a written quote and consider alternatives.",
  },
  avoid: {
    filename: "verdict-avoid.png",
    label: "Avoid",
    description:
      "Multiple material concerns across reviews. Check alternatives before calling.",
  },
};

const SIZE_MAP = { sm: 44, md: 72, lg: 120 } as const;
type Size = keyof typeof SIZE_MAP;

export default function VerdictSeal({
  verdict,
  size = "sm",
  showLabel = false,
}: {
  verdict: Verdict | null | undefined;
  size?: Size;
  showLabel?: boolean;
}) {
  if (!verdict) return null;
  const cfg = SEAL_CONFIG[verdict];
  if (!cfg) return null;
  const px = SIZE_MAP[size];

  return (
    <div
      className="inline-flex flex-col items-center gap-1 flex-shrink-0"
      title={cfg.description}
    >
      <Image
        src={`/icons/signals/${cfg.filename}`}
        alt={cfg.label}
        width={px}
        height={px}
        priority={size === "lg"}
        className="object-contain"
        style={{ width: px, height: px }}
      />
      {showLabel && (
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide leading-none ${
            verdict === "strong_hire"
              ? "text-yellow-700"
              : verdict === "conditional_hire"
              ? "text-gray-600"
              : verdict === "caution"
              ? "text-amber-700"
              : "text-red-700"
          }`}
        >
          {cfg.label}
        </span>
      )}
    </div>
  );
}
