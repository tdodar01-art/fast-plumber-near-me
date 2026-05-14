#!/usr/bin/env node

/**
 * Local synthesis paste-flow CLI.
 *
 * Mirrors the Operator Console's `synthesisPrompt.ts` / `synthesisReader.ts`
 * but skips the UI — drives the same paste-flow directly from Claude Code.
 * NO Anthropic SDK calls. Firestore-only via firebase-admin.
 *
 * Three modes:
 *   --prep --city <citySlug> [--limit N]
 *     Read plumbers from Firestore whose `reviewSynthesis.summary` is empty.
 *     Build the synthesis prompt for each. Write tasks to
 *     `data/synth-tasks.json`. Claude reads the tasks and produces
 *     synthesis JSONs into `data/synth-results.json`.
 *
 *   --writeback
 *     Read `data/synth-results.json` and persist each synthesis into
 *     Firestore under `reviewSynthesis.*`. The next
 *     `export-firestore-to-json.js` run picks them up.
 *
 *   --status [--city <citySlug>]
 *     Report counts: how many plumbers have synthesis vs. need it.
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { COLLECTIONS } = require("./config/plumbing-directory.cjs");

const SA_PATH = path.join(__dirname, "..", "service-account.json");
const TASKS_PATH = path.join(__dirname, "..", "data", "synth-tasks.json");
const RESULTS_PATH = path.join(__dirname, "..", "data", "synth-results.json");
const MAX_REVIEWS_IN_PROMPT = 30;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag) => {
    const i = a.indexOf(flag);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : undefined;
  };
  return {
    prep: a.includes("--prep"),
    writeback: a.includes("--writeback"),
    status: a.includes("--status"),
    allPending: a.includes("--all-pending"),
    city: get("--city"),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Firestore init
// ---------------------------------------------------------------------------

function initDb() {
  if (!fs.existsSync(SA_PATH)) {
    console.error("ERROR: service-account.json not found.");
    process.exit(1);
  }
  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

// ---------------------------------------------------------------------------
// Prompt builder — mirrors apps/operator/src/lib/synthesisPrompt.ts
// ---------------------------------------------------------------------------

function buildSynthesisPrompt(plumber) {
  const sorted = [...plumber.reviews]
    .sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return String(b.publishedAt).localeCompare(String(a.publishedAt));
    })
    .slice(0, MAX_REVIEWS_IN_PROMPT);

  const reviewBlock =
    sorted
      .map(
        (r) =>
          `[${r.rating ?? "?"}/5${r.publishedAt ? ` — ${String(r.publishedAt).slice(0, 10)}` : ""}] ${r.text ?? ""}`,
      )
      .join("\n\n---\n\n") || "(no reviews)";

  return `You are synthesizing reviews for an emergency plumber directory. Your output helps homeowners decide who to call at 2am with a burst pipe.

Plumber: ${plumber.name}
Location: ${plumber.city}, ${plumber.state}
Google rating: ${plumber.googleRating ?? "N/A"}/5 (${plumber.googleReviewCount ?? 0} reviews on Google)
Reviews cached for synthesis: ${sorted.length} of ${plumber.reviews.length}

QUALITY BAR — non-negotiable:
- Be SPECIFIC and PUNCHY. Reference actual review patterns with counts ("4 of 12 reviews mention…").
- BANNED phrases: "reliable and professional", "highly recommended", "satisfied customers", any generic praise that could apply to any plumber.
- Good: "Answers calls fast but books out 2-3 days — not ideal for true emergencies"
- Good: "Multiple reviews mention surprise fees after the initial quote"
- Good: "Highly rated for water heater installs, but no reviews mention after-hours work"
- For <25 reviews, even 1-2 mentions of the same complaint = a pattern worth flagging.
- Emergency-specific signals matter most: response time, after-hours mentions, weekend availability, burst-pipe experience.

Reviews:
${reviewBlock}

Respond in JSON only. No markdown, no preamble, no backticks.
{
  "summary": "One specific, punchy sentence a friend would say. ≤140 chars.",
  "strengths": ["2-3 specific strengths with evidence counts."],
  "weaknesses": ["1-2 specific weaknesses from reviews. 'Not enough data to identify weaknesses' is acceptable ONLY if every review is positive."],
  "redFlags": ["Concerning patterns with specifics. Empty array [] if genuinely none."],
  "emergencyNotes": "One sentence about emergency capability signals. If reviews mention fast response even during business hours, note it.",
  "emergencyReadiness": "ready | partial | unknown",
  "bestFor": ["Specific service categories where reviews praise this plumber, e.g. 'water-heater', 'sewer', 'after-hours'. Empty array if no clear pattern."],
  "topQuote": "The most useful direct quote from reviews (≤200 chars). Empty string if no standout quote.",
  "worstQuote": "The most damning direct quote, if any (≤200 chars). Empty string if reviews are uniformly positive.",
  "trustLevel": "high | medium | low",
  "priceSignal": "transparent | premium | mixed | complaints | unknown"
}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function citySlugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function plumberInCity(data, citySlug) {
  const slugs = new Set();
  if (Array.isArray(data.serviceCities)) {
    for (const s of data.serviceCities) {
      if (typeof s === "string") slugs.add(s.toLowerCase());
      else if (s && s.citySlug) slugs.add(String(s.citySlug).toLowerCase());
    }
  }
  if (data.city) slugs.add(citySlugify(data.city));
  return slugs.has(citySlug.toLowerCase());
}

function hasSynthesis(data) {
  // Some plumbers have `synthesis.summary` (older field), newer ones have
  // `reviewSynthesis.summary`. Either counts as "synthesized".
  const a = data.reviewSynthesis;
  const b = data.synthesis;
  if (a && typeof a.summary === "string" && a.summary.trim().length > 0) return true;
  if (b && typeof b.summary === "string" && b.summary.trim().length > 0) return true;
  return false;
}

function hasUsableReviewData(data) {
  // Score-plumbers stamps zero-review plumbers with `scores.last_scored_at`
  // but never writes synthesis — there's nothing to summarize. Skip them
  // here too so we don't hand Claude an empty review block.
  return (data.googleReviewCount || 0) > 0;
}

async function loadReviews(db, plumberId) {
  const snap = await db
    .collection(COLLECTIONS.reviews)
    .where("plumberId", "==", plumberId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      rating: typeof data.rating === "number" ? data.rating : null,
      text: typeof data.text === "string" ? data.text : "",
      publishedAt: typeof data.publishedAt === "string" ? data.publishedAt : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Mode: --prep
// ---------------------------------------------------------------------------

async function runPrep(args) {
  if (!args.city && !args.allPending) {
    console.error("ERROR: --prep requires --city <citySlug> OR --all-pending");
    process.exit(1);
  }
  const db = initDb();
  const snap = await db.collection(COLLECTIONS.businesses).get();
  const matching = args.city
    ? snap.docs.filter((d) => plumberInCity(d.data(), args.city))
    : snap.docs;
  const needing = matching.filter(
    (d) => !hasSynthesis(d.data()) && hasUsableReviewData(d.data()),
  );
  const skippedNoReviews = matching.filter(
    (d) => !hasSynthesis(d.data()) && !hasUsableReviewData(d.data()),
  );

  const scope = args.city ? `City "${args.city}"` : "All plumbers";
  console.log(
    `${scope}: ${matching.length} plumbers, ${needing.length} need synthesis, ${skippedNoReviews.length} skipped (no review data)`,
  );
  if (needing.length === 0) {
    console.log("Nothing to do.");
    fs.writeFileSync(
      TASKS_PATH,
      JSON.stringify({ scope: args.city || "all-pending", generatedAt: new Date().toISOString(), count: 0, tasks: [] }, null, 2),
    );
    return;
  }

  const limit = args.limit ?? needing.length;
  const slice = needing.slice(0, limit);

  const tasks = [];
  for (const d of slice) {
    const data = d.data();
    const reviews = await loadReviews(db, d.id);
    const cityDisplay =
      data.city ||
      (Array.isArray(data.serviceCities) && data.serviceCities[0]) ||
      args.city;
    const plumber = {
      placeId: d.id,
      name: data.businessName || data.name || "(unnamed)",
      city: cityDisplay,
      state: data.state || "",
      googleRating: data.googleRating ?? null,
      googleReviewCount: data.googleReviewCount ?? null,
      reviews,
    };
    tasks.push({
      placeId: d.id,
      name: plumber.name,
      city: plumber.city,
      state: plumber.state,
      googleReviewCount: plumber.googleReviewCount,
      reviewCount: reviews.length,
      prompt: buildSynthesisPrompt(plumber),
    });
  }

  const out = {
    scope: args.city || "all-pending",
    generatedAt: new Date().toISOString(),
    count: tasks.length,
    tasks,
  };
  fs.writeFileSync(TASKS_PATH, JSON.stringify(out, null, 2));
  console.log(`Wrote ${tasks.length} tasks → ${TASKS_PATH}`);
  console.log(`Next: Claude reads ${TASKS_PATH}, writes results to ${RESULTS_PATH}, then run --writeback`);
}

// ---------------------------------------------------------------------------
// Mode: --writeback
// ---------------------------------------------------------------------------

const FIELD_MAP_TO_FIRESTORE = {
  summary: "summary",
  strengths: "strengths",
  weaknesses: "weaknesses",
  redFlags: "redFlags",
  emergencyNotes: "emergencyNotes",
  emergencyReadiness: "emergencyReadiness",
  bestFor: "bestFor",
  topQuote: "topQuote",
  worstQuote: "worstQuote",
  trustLevel: "trustLevel",
  priceSignal: "pricingTier", // schema rename
};

async function runWriteback() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error(`ERROR: ${RESULTS_PATH} not found. Claude needs to write results first.`);
    process.exit(1);
  }
  const file = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
  const results = file.results || [];
  if (results.length === 0) {
    console.log("No results to write.");
    return;
  }

  const db = initDb();
  const now = admin.firestore.Timestamp.now();
  let ok = 0;
  let failed = 0;

  for (const r of results) {
    if (!r.placeId || !r.synthesis) {
      console.error(`  Skipping result with missing placeId or synthesis: ${JSON.stringify(r).slice(0, 100)}`);
      failed++;
      continue;
    }
    const payload = {};
    for (const [src, dst] of Object.entries(FIELD_MAP_TO_FIRESTORE)) {
      if (r.synthesis[src] !== undefined) {
        payload[`reviewSynthesis.${dst}`] = r.synthesis[src];
      }
    }
    payload["reviewSynthesis.synthesizedAt"] = now;
    payload["reviewSynthesis.aiSynthesizedAt"] = now; // export trigger
    payload["reviewSynthesis.synthesisVersion"] = "claude-code-local-v1";
    payload["reviewSynthesis.reviewCount"] = Array.isArray(r.synthesis.strengths)
      ? r.synthesis.strengths.length // proxy; actual count is informational
      : 0;

    try {
      await db.collection(COLLECTIONS.businesses).doc(r.placeId).update(payload);
      console.log(`  ✓ ${r.placeId}: synthesis written`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${r.placeId}: ${e.message || e}`);
      failed++;
    }
  }
  console.log(`\nDone: ${ok} written, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Mode: --status
// ---------------------------------------------------------------------------

async function runStatus(args) {
  const db = initDb();
  const snap = await db.collection(COLLECTIONS.businesses).get();
  let total = 0;
  let withSynth = 0;
  let withoutSynth = 0;
  let skippedNoReviews = 0;
  const byCity = new Map();

  for (const d of snap.docs) {
    const data = d.data();
    if (args.city && !plumberInCity(data, args.city)) continue;
    total++;
    const has = hasSynthesis(data);
    const usable = hasUsableReviewData(data);
    if (has) withSynth++;
    else if (!usable) skippedNoReviews++;
    else withoutSynth++;
    const slugs = new Set();
    if (Array.isArray(data.serviceCities)) {
      for (const s of data.serviceCities) {
        if (typeof s === "string") slugs.add(s.toLowerCase());
        else if (s && s.citySlug) slugs.add(String(s.citySlug).toLowerCase());
      }
    }
    if (data.city) slugs.add(citySlugify(data.city));
    for (const slug of slugs) {
      if (!byCity.has(slug)) byCity.set(slug, { total: 0, withSynth: 0 });
      const c = byCity.get(slug);
      c.total++;
      if (has) c.withSynth++;
    }
  }

  console.log(
    `Total: ${total} plumbers (${withSynth} with synthesis, ${withoutSynth} pending synthesis, ${skippedNoReviews} no-review-data)`,
  );
  if (args.city) {
    const c = byCity.get(args.city);
    if (c) console.log(`  ${args.city}: ${c.total} plumbers, ${c.withSynth} synthesized, ${c.total - c.withSynth} pending`);
  } else {
    const sorted = [...byCity.entries()].sort((a, b) => (b[1].total - b[1].withSynth) - (a[1].total - a[1].withSynth));
    console.log("\nTop 15 cities by pending synthesis:");
    console.log(["city", "total", "withSynth", "pending"].join("\t"));
    for (const [slug, c] of sorted.slice(0, 15)) {
      console.log([slug, c.total, c.withSynth, c.total - c.withSynth].join("\t"));
    }
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  if (args.prep) return runPrep(args);
  if (args.writeback) return runWriteback();
  if (args.status) return runStatus(args);
  console.log("Usage:");
  console.log("  node scripts/synth-local.js --prep --city <slug> [--limit N]");
  console.log("  node scripts/synth-local.js --writeback");
  console.log("  node scripts/synth-local.js --status [--city <slug>]");
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
