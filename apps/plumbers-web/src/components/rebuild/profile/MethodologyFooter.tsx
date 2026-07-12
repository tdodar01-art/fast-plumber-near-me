import Link from "next/link";

/**
 * Methodology footer (03 §3.11) — verbatim template on every profile: what we
 * do, what we do NOT do (the one permitted "verification calls" mention lives
 * on /methodology, not here — this footer only points at it), how paid
 * placement works, dispute path, dates.
 */
export default function MethodologyFooter({
  scrapedLabel,
  analysisLabel,
  contactHref,
}: {
  scrapedLabel: string | null;
  analysisLabel: string | null;
  contactHref: string;
}) {
  return (
    <footer className="pf-method">
      <p>
        <b>How this page is made.</b> We read and synthesize published customer reviews from
        Google, Yelp and the BBB, then publish our honest opinion — including the negative
        reviews other directories bury. We do <b>not</b> call, test, or inspect plumbers, and we
        don&apos;t check licenses unless a source is stated. Business facts come from the
        plumber&apos;s Google listing. Sponsored placement exists only on city list pages, is
        always labeled, and never changes an assessment or ranking — this profile is never
        pay-influenced. Every quote is reproduced verbatim from a public review and attributed;
        we choose which quotes to feature, and that selection is our editorial judgment.{" "}
        <Link href="/methodology">Full methodology</Link> ·{" "}
        <Link href="/methodology#sponsored">How we make money</Link> ·{" "}
        <Link href={contactHref}>Corrections &amp; disputes</Link>
      </p>
      {(scrapedLabel || analysisLabel) && (
        <p style={{ marginTop: 8 }} className="num">
          {scrapedLabel ? `Business data pulled ${scrapedLabel}` : ""}
          {scrapedLabel && analysisLabel ? " · " : ""}
          {analysisLabel ? `Review analysis updated ${analysisLabel}` : ""}.
        </p>
      )}
    </footer>
  );
}
