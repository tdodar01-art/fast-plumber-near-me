import Link from "next/link";
import type { EvidenceLedger as LedgerData } from "@/lib/profile-dossier";
import QuoteCard from "./QuoteCard";

/**
 * The evidence ledger (03 §3.6): verbatim attributed quotes from the analyzed
 * sample, grouped Positive / Critical — the critical group never hidden.
 * Renders quotes NOT already shown inside claims (dedupe upstream). Footer is
 * the Section-230 disclosure + report affordance.
 */
export default function EvidenceLedger({
  ledger,
  contactHref,
}: {
  ledger: LedgerData;
  contactHref: string;
}) {
  if (ledger.positive.length === 0 && ledger.critical.length === 0) return null;
  return (
    <section aria-labelledby="ledger-h" className="pf-section">
      <h2 id="ledger-h">The evidence — in reviewers&apos; own words</h2>
      <div className="rp-grid">
        {ledger.critical.length > 0 && (
          <div>
            <h3 className="cap" style={{ color: "var(--bad)", marginBottom: 8 }}>
              Critical
            </h3>
            <div className="evbody">
              {ledger.critical.map((q, i) => (
                <QuoteCard key={i} quote={q} />
              ))}
            </div>
          </div>
        )}
        {ledger.positive.length > 0 && (
          <div>
            <h3 className="cap" style={{ color: "var(--good)", marginBottom: 8 }}>
              Positive
            </h3>
            <div className="evbody">
              {ledger.positive.map((q, i) => (
                <QuoteCard key={i} quote={q} />
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="pf-footnote">
        Quotes are reproduced <b>verbatim</b> from public reviews on the platforms shown; we
        select which to feature, and selection reflects our editorial judgment.{" "}
        <Link href={contactHref}>Report a quote that doesn&apos;t match its source ↗</Link>
      </p>
    </section>
  );
}
