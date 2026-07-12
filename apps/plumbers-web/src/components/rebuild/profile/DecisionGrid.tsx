import Link from "next/link";
import type { DecisionCore } from "@/lib/decision-engine";

/**
 * Should you hire them? (03 §3.7) — four advice lists in a 2×2, sourced 1:1
 * from the decision engine. No page-side invention; empty lists don't render.
 */
export default function DecisionGrid({
  decision,
  name,
}: {
  decision: DecisionCore;
  name: string;
}) {
  const allCells: { title: string; items: string[]; tone: "good" | "warn" | "bad"; mark: string }[] = [
    { title: "Best for", items: decision.best_for, tone: "good", mark: "✓" },
    { title: "Hire if", items: decision.hire_if, tone: "good", mark: "✓" },
    { title: "Think twice if", items: decision.caution_if, tone: "warn", mark: "!" },
    { title: "Look elsewhere if", items: decision.avoid_if, tone: "bad", mark: "✕" },
  ];
  const cells = allCells.filter((c) => c.items.length > 0);
  if (cells.length === 0) return null;

  return (
    <section aria-labelledby="hire-h" className="pf-section">
      <h2 id="hire-h">Should you hire {name}?</h2>
      <div className="dg">
        {cells.map((c) => (
          <div key={c.title} className={`cell ${c.tone}`}>
            <h3>{c.title}</h3>
            <ul>
              {c.items.map((item, i) => (
                <li key={i} data-mark={c.mark}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="pf-footnote">
        Advice derived from the review analysis above — <Link href="/methodology">how we decide</Link>.
      </p>
    </section>
  );
}
