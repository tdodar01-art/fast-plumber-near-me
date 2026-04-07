@ROADMAP.md

## Data pipeline invariants

These rules are non-negotiable. If you feel the urge to violate them, the architecture is being misused.

1. **Firestore is the single source of truth for plumber data.** All enrichment (BBB, Yelp, Angi, Outscraper deep reviews, AI synthesis) lives in Firestore. Local JSON files are derived artifacts.

2. **`plumbers-synthesized.json` has exactly one writer: `export-firestore-to-json.js`.** No other script may write to this file. The same applies to `leaderboard.json`. If you need to add a new derived JSON file that the website reads at build time, it must follow the same pattern: one export script, Firestore as source.

3. **Every Firestore-mutating workflow ends with a JSON rebuild.** The daily-scrape workflow, deep-review-pull workflow, and the 6-hour safety net all call `export-firestore-to-json.js` as their final data step. This ensures the committed JSON always reflects Firestore truth.

4. **Never add merge logic to ingestion scripts to "preserve" enrichment fields.** If daily-scrape or any other ingestion script appears to be wiping enrichment data from the JSON, the fix is NOT to make that script "merge-aware." The fix is to ensure the JSON rebuild step runs after it. The single-writer invariant prevents the class of bug where two scripts fight over the same file.

5. **Ingestion scripts write to Firestore or to staging files in `data/raw/`.** They never write to `data/synthesized/`. The staging file `data/raw/plumbers-with-synthesis.json` is an intermediate working file used by `upload-to-firestore.js` — it is gitignored and never committed.

## Recheck data pipeline integrity

Verify periodically (weekly or after pipeline changes):

- [ ] Grep the repo for writes to `plumbers-synthesized.json` — confirm only `export-firestore-to-json.js` appears
- [ ] Confirm Firestore plumber count matches JSON row count
- [ ] Confirm the 6-hour safety rebuild GitHub Action (`rebuild-json.yml`) is still scheduled and its last 5 runs succeeded
- [ ] Confirm every Firestore-mutating workflow still ends with a rebuild step
- [ ] Spot-check 3 random plumbers: BBB fields, Yelp rating, and deep review data all present in JSON
