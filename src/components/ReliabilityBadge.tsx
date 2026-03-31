import { getScoreBgColor, getScoreLabel } from "@/lib/scoring";

export default function ReliabilityBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${getScoreBgColor(
        score
      )}`}
    >
      {score}/100 — {getScoreLabel(score)}
    </span>
  );
}
