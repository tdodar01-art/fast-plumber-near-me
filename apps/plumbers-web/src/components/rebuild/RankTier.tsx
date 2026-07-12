import type { CardTier } from "@/lib/report-card";
import { TIER_HEADINGS } from "@/lib/report-card";

/**
 * Tier section wrapper (02 §3.4): editorial tier header with a colored
 * micro-rule, grouping the ranked cards passed as children. "We'd keep
 * looking" businesses STAY on the page, ranked last, with full synthesis.
 */
export default function RankTier({
  tier,
  children,
}: {
  tier: CardTier;
  children: React.ReactNode;
}) {
  const { heading, sub, tone } = TIER_HEADINGS[tier];
  return (
    <section className="tier">
      <div className={`tier-head ${tone}`}>
        <h2>{heading}</h2>
        <span className="tier-sub">{sub}</span>
      </div>
      {children}
    </section>
  );
}
