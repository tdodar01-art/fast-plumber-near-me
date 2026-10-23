"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  JOBS,
  getJob,
  confidence,
  selectShortlist,
  type ShortlistCandidate,
} from "@/lib/shortlist";
export default function CuratedShortlist({
  candidates,
  city,
  state,
}: {
  candidates: ShortlistCandidate[];
  city: string;
  state: string;
}) {
  const [job, setJob] = useState("any");
  const [afterHours, setAfterHours] = useState(false);
  const [compare, setCompare] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      setJob(getJob(params.get("job") ?? "any").id);
      setAfterHours(params.get("urgency") === "after-hours");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const picks = useMemo(
    () => selectShortlist(candidates, job, afterHours),
    [candidates, job, afterHours],
  );
  const selected = getJob(job);
  function resetFilters() {
    setJob("any");
    setAfterHours(false);
    setCompare(false);
    setCopied(false);
    window.history.replaceState(null, "", "#job=any&urgency=planned");
  }
  function changeJob(value: string) {
    setJob(value);
    setCompare(false);
    setCopied(false);
    const params = new URLSearchParams({
      job: value,
      urgency: afterHours ? "after-hours" : "planned",
    });
    window.history.replaceState(null, "", `#${params}`);
  }
  function track(p: ShortlistCandidate) {
    fetch("/api/track-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plumberId: p.id,
        plumberName: p.name,
        plumberPhone: p.phone,
        city,
        state,
        clickType: "call",
        source: "curated-shortlist",
        pageUrl: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section
      className="curation"
      id="shortlist"
      aria-labelledby="shortlist-heading"
    >
      <div className="curation-heading">
        <div>
          <span className="eyebrow">FEWER TABS. A BETTER NEXT STEP.</span>
          <h2 id="shortlist-heading">Our shortlist in {city}.</h2>
          <p>
            Fair dealing and reliable work come first. We require at least 10
            analyzed reviews and 3 supporting quotes, including repeated
            evidence of fair dealing; repeated, cited sales-pressure concerns or
            unresolved red flags hold a business back.
          </p>
        </div>
        <span className="editorial-stamp">
          Independent
          <br />
          <b>by design.</b>
        </span>
      </div>
      <div className="job-tabs" aria-label="Choose your plumbing job">
        {JOBS.map((j) => (
          <button
            key={j.id}
            aria-pressed={job === j.id}
            onClick={() => changeJob(j.id)}
          >
            {j.label}
          </button>
        ))}
      </div>
      <div className="shortlist-controls">
        <label>
          <input
            type="checkbox"
            checked={afterHours}
            onChange={(e) => {
              setAfterHours(e.target.checked);
              setCompare(false);
              setCopied(false);
              const params = new URLSearchParams({
                job,
                urgency: e.target.checked ? "after-hours" : "planned",
              });
              window.history.replaceState(null, "", `#${params}`);
            }}
          />{" "}
          Only businesses that list 24-hour service
        </label>
        <span>
          {picks.length} option{picks.length === 1 ? "" : "s"} · Confirm
          availability directly
        </span>
      </div>
      {!picks.length ? (
        <div className="shortlist-empty">
          <h3>No business currently meets this shortlist’s evidence bar.</h3>
          <p>
            We won’t fill the list just to give you three names. Try another job
            or turn off the 24-hour filter. The full directory below includes
            more businesses; call to confirm their services.
          </p>
          <button onClick={resetFilters}>Show general suggestions →</button>
          <a
            className="directory-fallback"
            href="#full-directory"
            onClick={() => {
              const directory = document.getElementById("full-directory");
              if (directory instanceof HTMLDetailsElement)
                directory.open = true;
            }}
          >
            Or research the full directory →
          </a>
        </div>
      ) : (
        <>
          <div className="pick-grid">
            {picks.map((p, index) => (
              <article className="curated-pick" key={p.id}>
                <div className="pick-top">
                  <span className="pick-number">0{index + 1}</span>
                  <span className="pick-evidence">
                    {p.analyzed < 10
                      ? "LIMITED SAMPLE"
                      : "REVIEW-BACKED OPTION"}
                  </span>
                </div>
                <h3>
                  <Link href={`/plumber/${p.slug}`}>{p.name}</Link>
                </h3>
                <div className="pick-rating">
                  <span>★ {p.rating ?? "—"}</span>
                  <span>{p.googleCount.toLocaleString()} on Google</span>
                </div>
                <div className="pick-reason">
                  <span className="eyebrow">WHY CONSIDER THEM</span>
                  <p>
                    {p.fairDealing[0] ??
                      (selected.category
                        ? `${p.services[selected.category]} review mentions of ${selected.label.toLowerCase()}.`
                        : `${p.analyzed} reviews analyzed, with ${p.quotes} supporting quotes to explore.`)}
                  </p>
                </div>
                <p className="pick-confidence">
                  {confidence(p)}
                  {p.updated ? ` · newest available evidence ${p.updated}` : ""}
                </p>
                <div className="pick-caution">
                  <b>Before you call</b>
                  <p>
                    {p.concern ??
                      "Our evidence cannot confirm today’s availability, fees, or service coverage. Ask before booking."}
                  </p>
                </div>
                <div className="pick-actions">
                  <a
                    className="curated-call"
                    href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}
                    onClick={() => track(p)}
                  >
                    Call this plumber ↗
                  </a>
                  <Link href={`/plumber/${p.slug}`}>Read the evidence →</Link>
                </div>
              </article>
            ))}
          </div>
          <div className="shortlist-footer">
            <p>
              Suggestions prioritize cited fair-dealing evidence, pricing
              fairness, reliability, and job fit. Payment does not change this
              shortlist. Location proximity does not establish service coverage.
            </p>
            <div>
              <button
                onClick={() => setCompare(!compare)}
                aria-expanded={compare}
              >
                {compare ? "Close comparison" : "Compare these options"} ↗
              </button>
              <button onClick={share}>
                {copied ? "Link copied ✓" : "Copy shortlist link"}
              </button>
            </div>
          </div>
          {compare && (
            <div className="comparison-scroll">
              <table className="curated-comparison">
                <caption>Compare the evidence before you call</caption>
                <thead>
                  <tr>
                    <th scope="col">What to compare</th>
                    {picks.map((p) => (
                      <th scope="col" key={p.id}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Analysis depth</th>
                    {picks.map((p) => (
                      <td key={p.id}>
                        {p.analyzed} reviews · {p.quotes} quotes
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">24-hour service</th>
                    {picks.map((p) => (
                      <td key={p.id}>
                        {p.is24Hour
                          ? "Listed by business; call to confirm"
                          : "Not established"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Job evidence</th>
                    {picks.map((p) => (
                      <td key={p.id}>
                        {selected.category
                          ? `${p.services[selected.category]} mentions`
                          : "Choose a job above"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Current price & availability</th>
                    {picks.map((p) => (
                      <td key={p.id}>Ask directly</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className="call-prep">
        <span className="prep-icon">↳</span>
        <div>
          <span className="eyebrow">MAKE THE FIRST CALL COUNT</span>
          <h3>One good question before you book.</h3>
          <p>“{selected.question}”</p>
          <span>
            Also confirm your address is covered, the arrival window, and the
            total fee before work begins.
          </span>
        </div>
      </div>
    </section>
  );
}
