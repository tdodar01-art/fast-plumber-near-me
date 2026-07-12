import type { QuotePairData, AttributedQuote } from "@/lib/report-card";

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  return <span className="rstars">{"★".repeat(Math.max(1, Math.min(5, Math.round(rating))))}</span>;
}

function QuoteFigure({
  quote,
  tone,
  label,
}: {
  quote: AttributedQuote;
  tone: "pos" | "neg";
  label: string;
}) {
  return (
    <figure className={`q ${tone}`}>
      <div className="q-label">{label}</div>
      <blockquote>&ldquo;{quote.text}&rdquo;</blockquote>
      <figcaption>
        <b>{quote.author}</b> · <Stars rating={quote.rating} /> · {quote.sourceLabel}
        {quote.dateLabel ? ` · ${quote.dateLabel}` : ""}
      </figcaption>
    </figure>
  );
}

/**
 * Quote pair (02 §3.2 zone F): one positive + one negative verbatim quote,
 * each fully attributed (author · star rating given · platform · date).
 * The negative quote is never optional when one exists; when none exists in
 * the analyzed set, the honest absence renders instead.
 */
export default function QuotePair({ pair }: { pair: QuotePairData }) {
  const { positive, negative, absenceNote } = pair;
  if (!positive && !negative) return null;

  const negFirst = negative != null && positive == null;
  const positiveEl = positive && (
    <QuoteFigure key="pos" quote={positive} tone="pos" label="What reviewers praise" />
  );
  const negativeEl = negative ? (
    <QuoteFigure key="neg" quote={negative} tone="neg" label="The most critical take we found" />
  ) : (
    <figure className="q none" key="neg">
      <div className="q-label">The most critical take we found</div>
      <p>{absenceNote}</p>
    </figure>
  );

  return <div className="quotes">{negFirst ? [negativeEl, positiveEl] : [positiveEl, negativeEl]}</div>;
}
