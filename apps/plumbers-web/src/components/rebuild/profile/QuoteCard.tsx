import type { ProfileQuote } from "@/lib/profile-dossier";

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  const n = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <span className="rstars" aria-label={`${n} star review`}>
      {"★".repeat(n)}
      <span className="rstars-off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/**
 * The single quote renderer (03 §3.6): verbatim text, machine-populated
 * attribution (author · stars given · platform · date), optional neutral
 * dimension chip. Tone follows the star rating the reviewer gave.
 */
export default function QuoteCard({ quote }: { quote: ProfileQuote }) {
  const tone = quote.rating != null && quote.rating <= 3 ? "neg" : "pos";
  return (
    <figure className={`q ${tone}`}>
      <blockquote>&ldquo;{quote.text}&rdquo;</blockquote>
      <figcaption>
        <b>{quote.author}</b> · <Stars rating={quote.rating} /> · {quote.sourceLabel}
        {quote.dateLabel ? ` · ${quote.dateLabel}` : ""}
        {quote.dimension ? (
          <>
            {" "}
            <span className="dim-chip">{quote.dimension}</span>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}
