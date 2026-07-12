import Link from "next/link";

/**
 * Own this business? (03 §3.9) — correction/dispute affordance on every
 * profile. Routes through the existing /contact form (no new mailboxes,
 * SHARED rule 5); the slug rides along as a query param for context.
 */
export default function OwnerPanel({ name, slug }: { name: string; slug: string }) {
  const contactHref = `/contact?about=${encodeURIComponent(slug)}`;
  return (
    <section aria-labelledby="owner-h" className="pf-section">
      <div className="owner">
        <h2 id="owner-h">Own {name}?</h2>
        <p>
          You can respond to our analysis, correct business facts, or dispute the accuracy of a
          quoted review. Responses that check out get published on this page, and factual errors
          get corrected — see{" "}
          <Link href="/methodology#corrections">our corrections policy</Link>. We don&apos;t
          remove accurate quotes, but we&apos;ll re-run your assessment as your reviews change.
        </p>
        <div className="acts">
          <Link className="btn-sm btn-dark" href={contactHref}>
            Respond or dispute →
          </Link>
          <Link className="btn-sm btn-ghost" href={contactHref}>
            Update business info →
          </Link>
        </div>
      </div>
    </section>
  );
}
