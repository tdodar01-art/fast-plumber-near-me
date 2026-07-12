import Link from "next/link";

/**
 * Full "How we rank" block at list end (02 §3.1 item 7) + the verbatim-quote
 * disclosure line. Anchored so the byline / triage / 60-second version can
 * deep-link to it. Links to /methodology for the complete policy.
 */
export default function MethodologyBlock({
  cityName,
  reviewsReadTotal,
  businessesRead,
}: {
  cityName: string;
  reviewsReadTotal: number;
  businessesRead: number;
}) {
  return (
    <section className="method-full anchor-target" id="how-we-rank">
      <h2>How we rank the plumbers on this page</h2>
      <ol>
        <li>
          <b>We read the reviews — all of them we can get.</b> For each plumber serving {cityName}{" "}
          we pulled up to 100 recent reviews from Google, Yelp and BBB and read the full text. For
          this page: {reviewsReadTotal.toLocaleString()} reviews across {businessesRead}{" "}
          businesses.
        </li>
        <li>
          <b>Patterns beat anecdotes.</b> A plumber moves up when independent reviewers keep
          describing the same behavior: showing up when promised, quoting before working, work
          that holds. One rave changes nothing.
        </li>
        <li>
          <b>Complaints count double when they repeat.</b> Surprise fees, missed appointments,
          pressure sales — when the same complaint appears across reviewers (or across platforms),
          it caps how high we&apos;ll rank a business regardless of its star average.
        </li>
        <li>
          <b>Money never moves the ranking.</b> A plumber can buy the clearly-labeled sponsored
          slot at the top of the page — visibility, not endorsement. A business we wouldn&apos;t
          recommend can&apos;t buy the slot at all, and no payment changes the ranked order.
        </li>
        <li>
          <b>Our take is our opinion.</b> It&apos;s grounded in the reviews we quote and count on
          this page — check our evidence and disagree with us if you like. That&apos;s the point
          of showing it.
        </li>
      </ol>
      <div className="disclosure">
        Every quotation on this page is reproduced <b>verbatim</b> from a publicly posted review
        and attributed to its author, star rating, platform and date. Star averages and review
        counts are Google&apos;s (or Yelp&apos;s) as of our last data pull. &ldquo;Rating
        mix&rdquo; charts describe only the set of reviews we analyzed, which we state on every
        card. Read the full policy — including what we do <b>not</b> do — on{" "}
        <Link href="/methodology">our methodology page</Link>.
      </div>
    </section>
  );
}
