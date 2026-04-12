import {
  ShieldCheck,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Quote,
  Trophy,
  XCircle,
} from "lucide-react";
import type { DecisionCore, EvidenceQuote, CityRankEntry, Verdict } from "@/lib/decision-engine";
import EvidenceToggle from "./EvidenceToggle";

// ---------------------------------------------------------------------------
// Verdict config
// ---------------------------------------------------------------------------

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; bg: string; text: string; border: string; icon: typeof ShieldCheck }
> = {
  strong_hire: {
    label: "Strong Hire",
    bg: "#E6F4ED",
    text: "#0F6E56",
    border: "#A3D9C5",
    icon: ShieldCheck,
  },
  conditional_hire: {
    label: "Hire with Conditions",
    bg: "#FFF8E6",
    text: "#BA7517",
    border: "#E8D5A0",
    icon: ThumbsUp,
  },
  caution: {
    label: "Proceed with Caution",
    bg: "#FFF4E6",
    text: "#B45309",
    border: "#F0C88C",
    icon: AlertTriangle,
  },
  avoid: {
    label: "Not Recommended",
    bg: "#FCEBEB",
    text: "#A32D2D",
    border: "#F09595",
    icon: XCircle,
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DecisionPanelProps {
  decision: DecisionCore;
  cityRankEntry: CityRankEntry;
  evidenceQuotes?: EvidenceQuote[];
  plumberName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DecisionPanel({
  decision,
  cityRankEntry,
  evidenceQuotes,
  plumberName,
}: DecisionPanelProps) {
  const vc = VERDICT_CONFIG[decision.verdict];
  const VerdictIcon = vc.icon;

  return (
    <section className="mb-6">
      <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-gray-900 mb-3">
        Our Verdict
      </h2>

      {/* Verdict badge + rank */}
      <div
        className="rounded-xl p-4 mb-3"
        style={{ backgroundColor: vc.bg, border: `1.5px solid ${vc.border}` }}
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: vc.text }}
          >
            <VerdictIcon className="w-4 h-4 text-white" />
          </div>
          <span
            className="font-[family-name:var(--font-dm-sans)] font-bold text-base"
            style={{ color: vc.text }}
          >
            {vc.label}
          </span>
        </div>
        <p
          className="text-sm font-[family-name:var(--font-dm-sans)]"
          style={{ color: vc.text, opacity: 0.85 }}
        >
          {cityRankEntry.rank}
        </p>
      </div>

      {/* Two-column: Best for / Avoid if */}
      {(decision.best_for.length > 0 || decision.avoid_if.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Best for */}
          <div
            className="rounded-xl p-3"
            style={{
              backgroundColor: decision.best_for.length > 0 ? "#E6F4ED" : "#F9FAFB",
              border: `0.5px solid ${decision.best_for.length > 0 ? "#A3D9C5" : "#E5E7EB"}`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy
                className="w-3.5 h-3.5"
                style={{ color: decision.best_for.length > 0 ? "#0F6E56" : "#9CA3AF" }}
              />
              <span
                className="font-[family-name:var(--font-dm-sans)] font-semibold text-xs uppercase tracking-wide"
                style={{ color: decision.best_for.length > 0 ? "#0F6E56" : "#9CA3AF" }}
              >
                Best for
              </span>
            </div>
            {decision.best_for.length > 0 ? (
              <ul className="space-y-1">
                {decision.best_for.map((item, i) => (
                  <li
                    key={i}
                    className="text-xs font-[family-name:var(--font-dm-sans)]"
                    style={{ color: "#0F6E56" }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 font-[family-name:var(--font-dm-sans)]">
                No standout specialties
              </p>
            )}
          </div>

          {/* Avoid if */}
          <div
            className="rounded-xl p-3"
            style={{
              backgroundColor: decision.avoid_if.length > 0 ? "#FCEBEB" : "#F9FAFB",
              border: `0.5px solid ${decision.avoid_if.length > 0 ? "#F09595" : "#E5E7EB"}`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <ThumbsDown
                className="w-3.5 h-3.5"
                style={{ color: decision.avoid_if.length > 0 ? "#A32D2D" : "#9CA3AF" }}
              />
              <span
                className="font-[family-name:var(--font-dm-sans)] font-semibold text-xs uppercase tracking-wide"
                style={{ color: decision.avoid_if.length > 0 ? "#A32D2D" : "#9CA3AF" }}
              >
                Avoid if
              </span>
            </div>
            {decision.avoid_if.length > 0 ? (
              <ul className="space-y-1">
                {decision.avoid_if.map((item, i) => (
                  <li
                    key={i}
                    className="text-xs font-[family-name:var(--font-dm-sans)]"
                    style={{ color: "#A32D2D" }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 font-[family-name:var(--font-dm-sans)]">
                No major caveats
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hire if / Caution if bullets */}
      <div className="space-y-2 mb-3">
        {decision.hire_if.map((item, i) => (
          <div key={`hire-${i}`} className="flex gap-2 items-start">
            <ThumbsUp className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#0F6E56" }} />
            <p className="text-sm font-[family-name:var(--font-dm-sans)] text-gray-700">
              <span className="font-semibold" style={{ color: "#0F6E56" }}>
                Hire if:
              </span>{" "}
              {item}
            </p>
          </div>
        ))}
        {decision.caution_if.map((item, i) => (
          <div key={`caution-${i}`} className="flex gap-2 items-start">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#BA7517" }} />
            <p className="text-sm font-[family-name:var(--font-dm-sans)] text-gray-700">
              <span className="font-semibold" style={{ color: "#BA7517" }}>
                Caution if:
              </span>{" "}
              {item}
            </p>
          </div>
        ))}
      </div>

      {/* Evidence quotes (collapsible) */}
      {evidenceQuotes && evidenceQuotes.length > 0 && (
        <EvidenceToggle quotes={evidenceQuotes} />
      )}
    </section>
  );
}
