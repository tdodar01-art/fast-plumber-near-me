/**
 * Step 2 detail — synthesize ONE plumber via paste-flow.
 *
 * Server component shows everything you need to do (and reason about)
 * a synthesis without leaving the page:
 *   1. Reviews on file — the input Claude sees
 *   2. Existing synthesis fragments — what an earlier run already filled
 *      in (servicesMentioned, scores, etc.) so you can compare against
 *      the new narrative.
 *   3. The synthesis prompt + paste-flow.
 *
 * No Anthropic API call from this app. Operator pastes the prompt into
 * their Claude.ai tab, gets a JSON response back, pastes it here. The
 * parser validates shape; save-to-Firestore is a follow-up.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadCandidate,
  type PlumberReview,
  type PlumberSynthesis,
} from "@/lib/synthesisReader";
import { buildSynthesisPrompt } from "@/lib/synthesisPrompt";
import SynthesisPasteFlow from "@/components/SynthesisPasteFlow";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export default async function PlumberSynthesisPage({
  params,
}: {
  params: Promise<{ plumberId: string }>;
}) {
  const { plumberId } = await params;
  const candidate = await loadCandidate(decodeURIComponent(plumberId));
  if (!candidate) notFound();

  const prompt = buildSynthesisPrompt(candidate);
  const sortedReviews = [...candidate.reviews].sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/daily-workflow/step-2"
          className="hover:opacity-80"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          ← back to step 2
        </Link>
        <p
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          synthesize via paste-flow
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-editorial)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          {candidate.name}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          {candidate.city}
          {candidate.state ? `, ${candidate.state}` : ""}
          {typeof candidate.googleRating === "number" &&
            ` · ${candidate.googleRating.toFixed(1)}★ (${candidate.googleReviewCount ?? 0} on Google)`}
          {" · "}
          {candidate.reviewsCachedCount} reviews cached for synthesis
        </p>
        {candidate.pageUrl && (
          <a
            href={candidate.pageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono hover:underline"
            style={{
              fontSize: "var(--text-ambient)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            {candidate.pageUrl} ↗
          </a>
        )}
      </header>

      <ReviewsSection reviews={sortedReviews} />

      {candidate.synthesis && hasAnyExisting(candidate.synthesis) && (
        <ExistingSynthesisSection synthesis={candidate.synthesis} />
      )}

      <SynthesisPasteFlow prompt={prompt} plumberName={candidate.name} />

      <section className="flex flex-col gap-3">
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-heading)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          How this works
        </h2>
        <ol
          className="flex flex-col gap-2 list-decimal pl-5"
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-ink-secondary)",
          }}
        >
          <li>
            Read the reviews above — that&rsquo;s exactly what Claude sees
            (we send up to the 30 most recent).
          </li>
          <li>
            Click <strong>Copy prompt</strong>. Paste into your Claude.ai
            tab. No Anthropic API spend; you&rsquo;re using your own
            session.
          </li>
          <li>Claude returns a JSON block. Copy it.</li>
          <li>
            Paste into the response box. We validate the shape and render
            the parsed synthesis inline so you can compare against the
            reviews + the existing fragments above.
          </li>
          <li>
            (Phase 2) save the validated synthesis to Firestore. For now,
            copy the clean JSON and run a CLI script against placeId{" "}
            <code className="font-mono">{candidate.placeId}</code>.
          </li>
        </ol>
      </section>
    </div>
  );
}

// ---------- Reviews ----------

function formatReviewDate(iso: string | undefined): string {
  if (!iso) return "(no date)";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReviewsSection({ reviews }: { reviews: PlumberReview[] }) {
  if (reviews.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-heading)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          Reviews on file
        </h2>
        <p
          className="italic"
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          No reviews cached for this plumber. Synthesis will be empty.
        </p>
      </section>
    );
  }

  const includedInPrompt = reviews.slice(0, 30);
  const overflow = reviews.length - includedInPrompt.length;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-heading)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          Reviews on file
        </h2>
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          {reviews.length} cached
          {overflow > 0 && ` · top 30 in prompt (${overflow} excluded)`}
        </span>
      </header>
      <ol className="flex flex-col">
        {reviews.map((r, i) => (
          <li
            key={i}
            className="border-b last:border-b-0 py-3"
            style={{ borderColor: "var(--color-border-tertiary)" }}
          >
            <div
              className="flex items-baseline justify-between gap-4"
              style={{
                fontSize: "var(--text-label)",
                letterSpacing: "0.04em",
                color: "var(--color-ink-tertiary)",
              }}
            >
              <span className="font-mono tabular-nums">
                {String(i + 1).padStart(2, "0")} ·{" "}
                <span
                  style={{
                    color:
                      (r.rating ?? 0) >= 4
                        ? "var(--color-accent-strong)"
                        : (r.rating ?? 0) <= 2
                          ? "var(--color-danger-ink)"
                          : "var(--color-ink-secondary)",
                  }}
                >
                  {r.rating ?? "?"}/5
                </span>
                {r.authorName && ` · ${r.authorName}`}
              </span>
              <span className="font-mono">{formatReviewDate(r.publishedAt)}</span>
            </div>
            <p
              className="mt-1"
              style={{
                fontSize: "var(--text-body)",
                color: "var(--color-ink-primary)",
                whiteSpace: "pre-wrap",
              }}
            >
              {r.text || "(empty review text)"}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- Existing synthesis fragments ----------

function hasAnyExisting(s: PlumberSynthesis): boolean {
  if (s.summary && s.summary.trim()) return true;
  if (s.strengths && s.strengths.length) return true;
  if (s.weaknesses && s.weaknesses.length) return true;
  if (s.redFlags && s.redFlags.length) return true;
  if (s.bestFor && s.bestFor.length) return true;
  if (s.emergencyNotes && s.emergencyNotes.trim()) return true;
  if (s.emergencyReadiness && s.emergencyReadiness.trim()) return true;
  if (s.topQuote && s.topQuote.trim()) return true;
  if (s.worstQuote && s.worstQuote.trim()) return true;
  if (s.trustLevel && s.trustLevel.trim()) return true;
  if (s.priceSignal && s.priceSignal.trim()) return true;
  if (s.score) return true;
  if (s.servicesMentioned) return true;
  return false;
}

function ExistingSynthesisSection({
  synthesis,
}: {
  synthesis: PlumberSynthesis;
}) {
  const Row = ({
    label,
    value,
    empty,
  }: {
    label: string;
    value: React.ReactNode;
    empty: boolean;
  }) => (
    <div
      className="flex flex-col gap-1 border-b py-2 last:border-b-0"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <span
        style={{
          fontSize: "var(--text-label)",
          letterSpacing: "0.04em",
          color: "var(--color-ink-tertiary)",
        }}
      >
        {label.toLowerCase()}
      </span>
      <div
        style={{
          fontSize: "var(--text-body)",
          color: empty
            ? "var(--color-ink-tertiary)"
            : "var(--color-ink-primary)",
          fontStyle: empty ? "italic" : "normal",
        }}
      >
        {empty ? "(empty — paste-flow will fill this in)" : value}
      </div>
    </div>
  );

  const renderList = (items: string[] | undefined) =>
    !items || items.length === 0 ? null : (
      <ul className="list-disc pl-5 flex flex-col gap-1">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    );

  // Cast to unknown for inspection of unknown-shape fields
  const score = synthesis.score as unknown;
  const services = synthesis.servicesMentioned as unknown;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-heading)",
            color: "var(--color-ink-primary)",
            lineHeight: 1.2,
          }}
        >
          Existing synthesis fragments
        </h2>
        <span
          className="font-mono"
          style={{
            fontSize: "var(--text-label)",
            letterSpacing: "0.04em",
            color: "var(--color-ink-tertiary)",
          }}
        >
          from earlier runs
        </span>
      </header>
      <p
        style={{
          fontSize: "var(--text-body)",
          color: "var(--color-ink-secondary)",
        }}
      >
        What&rsquo;s already on this plumber&rsquo;s record. Compare to the
        narrative the new paste-flow generates — that&rsquo;s how you
        sanity-check whether the synthesis is doing useful work.
      </p>
      <div
        className="border rounded p-4"
        style={{
          borderColor: "var(--color-border-tertiary)",
          backgroundColor: "var(--color-surface-muted)",
        }}
      >
        <Row
          label="Summary (the missing piece)"
          value={synthesis.summary}
          empty={!synthesis.summary || !synthesis.summary.trim()}
        />
        <Row
          label="Strengths"
          value={renderList(synthesis.strengths)}
          empty={!synthesis.strengths || synthesis.strengths.length === 0}
        />
        <Row
          label="Weaknesses"
          value={renderList(synthesis.weaknesses)}
          empty={!synthesis.weaknesses || synthesis.weaknesses.length === 0}
        />
        <Row
          label="Red flags"
          value={renderList(synthesis.redFlags)}
          empty={!synthesis.redFlags || synthesis.redFlags.length === 0}
        />
        <Row
          label="Best for"
          value={renderList(synthesis.bestFor)}
          empty={!synthesis.bestFor || synthesis.bestFor.length === 0}
        />
        <Row
          label="Emergency notes"
          value={synthesis.emergencyNotes}
          empty={
            !synthesis.emergencyNotes || !synthesis.emergencyNotes.trim()
          }
        />
        <Row
          label="Emergency readiness"
          value={synthesis.emergencyReadiness}
          empty={
            !synthesis.emergencyReadiness ||
            !synthesis.emergencyReadiness.trim()
          }
        />
        <Row
          label="Top quote"
          value={
            synthesis.topQuote ? (
              <span
                className="italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                &ldquo;{synthesis.topQuote}&rdquo;
              </span>
            ) : null
          }
          empty={!synthesis.topQuote || !synthesis.topQuote.trim()}
        />
        <Row
          label="Worst quote"
          value={
            synthesis.worstQuote ? (
              <span
                className="italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                &ldquo;{synthesis.worstQuote}&rdquo;
              </span>
            ) : null
          }
          empty={!synthesis.worstQuote || !synthesis.worstQuote.trim()}
        />
        <Row
          label="Trust level"
          value={synthesis.trustLevel}
          empty={!synthesis.trustLevel || !synthesis.trustLevel.trim()}
        />
        <Row
          label="Price signal"
          value={synthesis.priceSignal}
          empty={!synthesis.priceSignal || !synthesis.priceSignal.trim()}
        />
        <Row
          label="Score (numeric, from earlier scoring pass)"
          value={
            <pre
              className="font-mono whitespace-pre-wrap"
              style={{ fontSize: "var(--text-ambient)" }}
            >
              {score ? JSON.stringify(score, null, 2) : ""}
            </pre>
          }
          empty={!score}
        />
        <Row
          label="Services mentioned (from keyword extraction)"
          value={
            <pre
              className="font-mono whitespace-pre-wrap"
              style={{ fontSize: "var(--text-ambient)" }}
            >
              {services ? JSON.stringify(services, null, 2) : ""}
            </pre>
          }
          empty={!services}
        />
      </div>
    </section>
  );
}
