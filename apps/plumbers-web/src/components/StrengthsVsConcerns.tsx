import Image from "next/image";
import type { Plumber } from "@/lib/types";
import { resolveSignals, groupByKind, type PlumberLike } from "@/lib/plumber-signals";

/**
 * StrengthsVsConcerns — the side-by-side comparison Tim explicitly called
 * out as important: "Strengths" on the left, "Concerns" on the right, each
 * a list of plain-language bullets with an icon per line.
 *
 * This is the narrative version of the signals — it uses the synthesized
 * strengths/weaknesses/redFlags text rather than the structured signal
 * chips. Complementary to SignalRow: SignalRow is icons + labels, this is
 * full sentences with evidence.
 *
 * Accepts a limit to cap each side (cards want ~3 each, detail page all).
 */

function strengthIcon(line: string): string {
  const l = line.toLowerCase();
  if (/respond|same.?day|fast|quick|prompt|24|emergency/.test(l)) {
    return "/icons/signals/responsiveness-excel.png";
  }
  if (/communic|explain|walk.?through|upfront|clear/.test(l)) {
    return "/icons/signals/communication-excel.png";
  }
  if (/price|fair|reasonable|transparent|quote|no.?surpris/.test(l)) {
    return "/icons/signals/pricing-excel.png";
  }
  if (/workmanship|quality|craft|fix|repair|instal|warrant/.test(l)) {
    return "/icons/signals/workmanship-excel.png";
  }
  if (/show.?up|on.?time|reliab|schedul/.test(l)) {
    return "/icons/signals/reliability-excel.png";
  }
  if (/consist|every visit|predict/.test(l)) {
    return "/icons/signals/consistency-excel.png";
  }
  return "/icons/signals/verdict-conditional.png"; // neutral-positive fallback
}

function concernIcon(line: string): string {
  const l = line.toLowerCase();
  if (/late|slow|delay|wait|respond/.test(l)) {
    return "/icons/signals/responsiveness-flag.png";
  }
  if (/communic|rude|unclear|evasive|yell/.test(l)) {
    return "/icons/signals/communication-flag.png";
  }
  if (/price|pric|quote|estimate|upsell|surpris|charge|fee|inflat/.test(l)) {
    return "/icons/signals/pricing-flag.png";
  }
  if (/workmanship|qualit|broken|redo|failure|crack|leak/.test(l)) {
    return "/icons/signals/workmanship-flag.png";
  }
  if (/show|no.?show|cancel|miss/.test(l)) {
    return "/icons/signals/reliability-flag.png";
  }
  if (/bbb|complaint/.test(l)) {
    return "/icons/signals/bbb-concerns.png";
  }
  if (/yelp|platform|discrep|rating/.test(l)) {
    return "/icons/signals/platform-mismatch.png";
  }
  if (/variance|hit.?or.?miss|inconsist/.test(l)) {
    return "/icons/signals/variance-flag.png";
  }
  return "/icons/signals/verdict-caution.png"; // neutral-negative fallback
}

export default function StrengthsVsConcerns({
  plumber,
  limit = 3,
  showAll = false,
}: {
  plumber: PlumberLike;
  limit?: number;
  showAll?: boolean;
}) {
  const rs = (plumber.reviewSynthesis ?? plumber.synthesis ?? null) as
    | Plumber["reviewSynthesis"]
    | null;
  if (!rs) return null;

  const strengths = Array.isArray(rs.strengths) ? rs.strengths : [];
  const weaknesses = Array.isArray(rs.weaknesses) ? rs.weaknesses : [];
  const redFlags = Array.isArray(rs.redFlags) ? rs.redFlags : [];

  // Concerns = red flags + weaknesses, deduped.
  const concerns: { text: string; severe: boolean }[] = [
    ...redFlags.map((t) => ({ text: t, severe: true })),
    ...weaknesses
      .filter(
        (w) => !redFlags.some((r) => r.toLowerCase().includes(w.toLowerCase().slice(0, 20))),
      )
      .map((t) => ({ text: t, severe: false })),
  ];

  // Filter meaningless placeholder weaknesses like "Not enough data..."
  const meaningfulConcerns = concerns.filter(
    (c) => !/not enough data/i.test(c.text),
  );

  // Also pull signal-based excels (badges etc.) from the resolver, if we want
  // to augment the card view beyond synthesis strengths. For now we stick to
  // synthesis text for consistency with the user's "side by side comp"
  // vision.
  // (Unused but keeps the import useful if we iterate later.)
  void groupByKind;
  void resolveSignals;

  const displayStrengths = showAll ? strengths : strengths.slice(0, limit);
  const displayConcerns = showAll
    ? meaningfulConcerns
    : meaningfulConcerns.slice(0, limit);

  if (displayStrengths.length === 0 && displayConcerns.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      {/* STRENGTHS — left column */}
      <div className="bg-green-50/50 border border-green-100 rounded-lg p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-green-700 mb-2">
          What customers love
          {!showAll && strengths.length > displayStrengths.length && (
            <span className="font-normal text-green-600 ml-1">
              ({strengths.length})
            </span>
          )}
        </p>
        {displayStrengths.length > 0 ? (
          <ul className="space-y-1.5">
            {displayStrengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 leading-snug">
                <Image
                  src={strengthIcon(s)}
                  alt=""
                  width={14}
                  height={14}
                  style={{ width: 14, height: 14, marginTop: 2 }}
                  className="flex-shrink-0"
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400 italic">
            No standout strengths from reviews.
          </p>
        )}
      </div>

      {/* CONCERNS — right column */}
      <div className="bg-red-50/50 border border-red-100 rounded-lg p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 mb-2">
          What customers flag
          {!showAll && meaningfulConcerns.length > displayConcerns.length && (
            <span className="font-normal text-red-600 ml-1">
              ({meaningfulConcerns.length})
            </span>
          )}
        </p>
        {displayConcerns.length > 0 ? (
          <ul className="space-y-1.5">
            {displayConcerns.map((c, i) => (
              <li
                key={i}
                className={`flex items-start gap-1.5 text-xs leading-snug ${
                  c.severe ? "text-gray-800 font-medium" : "text-gray-600"
                }`}
              >
                <Image
                  src={concernIcon(c.text)}
                  alt=""
                  width={14}
                  height={14}
                  style={{ width: 14, height: 14, marginTop: 2 }}
                  className="flex-shrink-0"
                />
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400 italic">
            No significant concerns in reviews.
          </p>
        )}
      </div>
    </div>
  );
}
