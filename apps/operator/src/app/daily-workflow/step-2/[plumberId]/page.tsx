/**
 * Step 2 detail — synthesize ONE plumber via paste-flow.
 *
 * Server component renders the plumber + the pre-built prompt, then
 * mounts the client paste-flow component for the textarea + parse step.
 *
 * No Anthropic API call from this app. The operator pastes the prompt
 * into their Claude.ai tab, gets a JSON response back, pastes it here.
 * The parser validates shape — saving to Firestore is a follow-up
 * (operator-console doesn't yet have firebase-admin wired).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCandidate } from "@/lib/synthesisReader";
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
            Click <strong>Copy prompt</strong> below. Paste into your
            Claude.ai tab.
          </li>
          <li>Claude returns a JSON block. Copy it.</li>
          <li>
            Paste into the response box. We&rsquo;ll validate the shape
            and show the parsed result.
          </li>
          <li>
            (Phase 2) save the parsed result back to Firestore. For now,
            copy the validated JSON to clipboard and run a CLI script
            against the placeId{" "}
            <code className="font-mono">{candidate.placeId}</code>.
          </li>
        </ol>
      </section>
    </div>
  );
}
