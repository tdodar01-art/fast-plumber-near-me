/**
 * One-time repair: normalize reviewSynthesis flat fields back to string[].
 *
 * Some plumber docs had `reviewSynthesis.{strengths,weaknesses,redFlags}`
 * written as cited-form objects `{text, supporting_review_ids[]}` (e.g. by
 * scripts/apply-manual-synthesis.js, which wrote input shapes through raw).
 * The canonical writeback (scripts/synth/writeback.js) keeps these flat fields
 * as string[] and stores the structured form in `*Evidence`. The object shape
 * in the flat fields crashed static prerender (truncateClause -> .lastIndexOf
 * on a non-string), failing every Vercel production build.
 *
 * This script coerces every non-string element in those three flat arrays to
 * its `.text` (falling back to String()). The structured `*Evidence` fields
 * are left untouched. Idempotent.
 *
 * Usage:
 *   node scripts/fix-synthesis-flat-fields.js          # dry run (default)
 *   node scripts/fix-synthesis-flat-fields.js --apply  # write changes
 */
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("service-account.json not found — aborting.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const FIELDS = ["strengths", "weaknesses", "redFlags"];

function toText(item) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && typeof item.text === "string") return item.text;
  return String(item);
}

admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection("plumbers").get();
  const toFix = [];

  snap.forEach((doc) => {
    const p = doc.data();
    const syn = p.reviewSynthesis || {};
    const update = {};
    let dirty = false;

    for (const f of FIELDS) {
      const v = syn[f];
      if (Array.isArray(v) && v.some((el) => typeof el !== "string")) {
        update[`reviewSynthesis.${f}`] = v.map(toText);
        dirty = true;
      }
    }

    if (dirty) toFix.push({ id: doc.id, name: p.businessName, update });
  });

  console.log(`Scanned ${snap.size} docs; ${toFix.length} need normalization.`);
  for (const { id, name, update } of toFix) {
    const fields = Object.keys(update).map((k) => k.split(".").pop()).join(", ");
    console.log(`  ${APPLY ? "FIX " : "DRY "} ${id}  ${name}  [${fields}]`);
  }

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write.");
    process.exit(0);
  }

  let written = 0;
  for (const { id, update } of toFix) {
    await db.collection("plumbers").doc(id).update(update);
    written++;
  }
  console.log(`\nWrote ${written} docs.`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
