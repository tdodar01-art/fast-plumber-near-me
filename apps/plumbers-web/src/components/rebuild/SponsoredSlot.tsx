import Link from "next/link";
import type { SynthesizedPlumber } from "@/lib/plumber-data";
import { cardTier } from "@/lib/report-card";
import PlumberReportCard, { type CardCenter } from "./PlumberReportCard";

/** Mirror of the Firestore-side sponsorship floor (src/lib/firestore.ts). */
const SPONSORED_QUALITY_THRESHOLD = 65;

/**
 * Sponsored slot (02 §3.3) — slate treatment, never gold. Renders NOTHING
 * when no sponsor is set: the crawl path is fully static (hard rule 4), so
 * the runtime Firestore lookup (getSponsoredPlumberForCity) cannot run here.
 * When sponsorship sales resume, the export step must persist the sponsor's
 * placeId into markets.json and the page passes the resolved record in.
 *
 * Quality gate mirrors the existing rules: score >= 65 and never an
 * "avoid" verdict — you can pay to be seen, not to be trusted.
 */
export default function SponsoredSlot({
  sponsor,
  center,
}: {
  sponsor: SynthesizedPlumber | null | undefined;
  center: CardCenter;
}) {
  if (!sponsor) return null;
  if ((sponsor.synthesis?.score ?? 0) < SPONSORED_QUALITY_THRESHOLD) return null;
  if (cardTier(sponsor).tier === "avoid") return null;

  return (
    <section className="spon-slot" aria-label="Sponsored listing">
      <div className="spon-head">
        <span className="spon-tag">Sponsored</span>
        <span className="spon-note">
          {sponsor.name} paid for this placement. The ranking below is <b>not for sale</b>, and
          this review summary is the same one we&apos;d publish if they hadn&apos;t paid.{" "}
          <Link href="/methodology#sponsored" rel="sponsored">
            How sponsorship works →
          </Link>
        </span>
      </div>
      {/* Identical component, identical honesty — no rank numeral (outside the ranking). */}
      <PlumberReportCard plumber={sponsor} rank={null} center={center} sponsored />
    </section>
  );
}
