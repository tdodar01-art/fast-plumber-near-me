#!/usr/bin/env npx tsx
/**
 * Dump scored plumber data for audit. Accepts --city SLUG.
 */
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length) return admin.firestore();
  const sa = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "service-account.json"), "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function effectiveServiceCities(data: admin.firestore.DocumentData): string[] {
  const state = data.address?.state?.toLowerCase();
  if (Array.isArray(data.serviceCities) && data.serviceCities.length > 0) {
    if (!state) return data.serviceCities;
    const out = new Set<string>(data.serviceCities);
    for (const slug of data.serviceCities) {
      const suffixed = `${slug}-${state}`;
      if (slug !== suffixed) out.add(suffixed);
    }
    return Array.from(out);
  }
  const city = data.address?.city;
  if (!city || !state) return [];
  return [`${slugify(city)}-${state}`];
}

async function main() {
  const args = process.argv.slice(2);
  const cityIdx = args.indexOf("--city");
  const citySlug = cityIdx !== -1 ? args[cityIdx + 1] : null;
  if (!citySlug) {
    console.error("Usage: npx tsx scripts/dump-scored-plumbers.ts --city SLUG");
    process.exit(1);
  }

  const db = initFirebase();
  const snap = await db.collection("plumbers").get();
  const matched = snap.docs.filter((d) =>
    effectiveServiceCities(d.data()).includes(citySlug)
  );

  console.log(`\n========== DUMP: ${citySlug} (${matched.length} plumbers) ==========\n`);

  const scored = matched.filter((d) => d.data().scores);
  const unscored = matched.filter((d) => !d.data().scores);

  // Sort scored by overall percentile desc
  scored.sort((a, b) => {
    const aRank = a.data().city_rank?.[citySlug]?.overall_percentile ?? -1;
    const bRank = b.data().city_rank?.[citySlug]?.overall_percentile ?? -1;
    return bRank - aRank;
  });

  for (const doc of scored) {
    const data = doc.data();
    const name = data.businessName ?? doc.id;
    const scores = data.scores;
    const cityRank = data.city_rank?.[citySlug];
    const decision = data.decision;
    const evidence = data.evidence_quotes;

    console.log(`--- ${name} ---`);
    console.log(`  id: ${doc.id}`);
    console.log(`  serviceCities: ${JSON.stringify(data.serviceCities)}`);
    console.log(`  Google rating: ${data.googleRating ?? "?"} (${data.googleReviewCount ?? "?"} reviews)`);
    console.log();

    if (scores) {
      console.log(`  SCORES:`);
      console.log(`    reliability:      ${scores.reliability}`);
      console.log(`    pricing_fairness: ${scores.pricing_fairness}`);
      console.log(`    workmanship:      ${scores.workmanship}`);
      console.log(`    responsiveness:   ${scores.responsiveness}`);
      console.log(`    communication:    ${scores.communication}`);
      console.log(`    variance:         ${scores.variance}`);
      console.log(`    review_count_used: ${scores.review_count_used}`);
      console.log(`    last_scored_at:   ${scores.last_scored_at}`);
      if (scores.specialty_strength) {
        console.log(`    specialty_strength:`);
        for (const [k, v] of Object.entries(scores.specialty_strength)) {
          if (v as number > 0) console.log(`      ${k}: ${v}`);
        }
        const allZero = Object.values(scores.specialty_strength).every((v) => v === 0);
        if (allZero) console.log(`      (all zero)`);
      }
    }

    if (cityRank) {
      console.log(`  CITY_RANK[${citySlug}]:`);
      console.log(`    rank:               ${cityRank.rank}`);
      console.log(`    overall_percentile: ${cityRank.overall_percentile}`);
      console.log(`    best_dimension:    ${cityRank.best_dimension}`);
      console.log(`    worst_dimension:   ${cityRank.worst_dimension}`);
    } else {
      console.log(`  CITY_RANK[${citySlug}]: (missing)`);
    }

    if (decision) {
      console.log(`  DECISION:`);
      console.log(`    verdict:     ${decision.verdict}`);
      console.log(`    best_for:    ${JSON.stringify(decision.best_for)}`);
      console.log(`    avoid_if:    ${JSON.stringify(decision.avoid_if)}`);
      console.log(`    hire_if:     ${JSON.stringify(decision.hire_if)}`);
      console.log(`    caution_if:  ${JSON.stringify(decision.caution_if)}`);
      console.log(`    primary_city_slug: ${decision.primary_city_slug}`);
    } else {
      console.log(`  DECISION: (missing)`);
    }

    if (Array.isArray(evidence) && evidence.length > 0) {
      console.log(`  EVIDENCE_QUOTES:`);
      for (const eq of evidence) {
        console.log(`    [${eq.dimension}] "${eq.quote}" (review: ${eq.review_id})`);
      }
    } else {
      console.log(`  EVIDENCE_QUOTES: (none)`);
    }

    console.log();
  }

  if (unscored.length > 0) {
    console.log(`--- UNSCORED (${unscored.length} plumbers, no reviews in reviews/) ---`);
    for (const doc of unscored) {
      const data = doc.data();
      console.log(`  ${data.businessName ?? doc.id} — Google ${data.googleRating ?? "?"}★ (${data.googleReviewCount ?? "?"} reviews)`);
    }
    console.log();
  }

  console.log(`========== END ${citySlug} ==========\n`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
