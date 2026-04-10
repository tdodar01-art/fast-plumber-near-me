@ROADMAP.md

## Deploys To
- **Platform:** Vercel
- **Production URL:** https://fastplumbernearme.com
- **Auto-deploy branch:** `main` (assumed Vercel default — needs Tim to confirm if different)
- **Vercel root directory:** `apps/plumbers-web/` (this is a monorepo; `vercel.json` at `apps/plumbers-web/vercel.json` is a minimal `{"framework": "nextjs"}`)
- **Admin panel:** `/admin` — Firebase Auth with Google login (the canonical pattern being ported to `geteasyexit.com/admin`)

Separately, two GitHub Actions workflows run daily and push JSON updates back to the repo, which triggers a fresh Vercel rebuild:
- **`daily-scrape.yml`** (6 AM Central) — GSC expansion → Places scrape → Firestore upload → review refresh → Claude synthesis → commit → Vercel rebuild
- **`deep-review-pull.yml`** (7 AM Central) — BBB lookup → Outscraper multi-source reviews (Google + Yelp + Angi) → Claude synthesis → JSON export → commit → Vercel rebuild

See ROADMAP.md → "Automated Pipeline Architecture" for the full flow and tier thresholds.

## Known Issues / Gotchas

**Pre-launch gaps (as of ROADMAP April 6, 2026):**
- Mobile QA pass not done
- Favicon / PWA icons missing (`/icon-192.png`, `/icon-512.png`)
- Firestore security rules not deployed (`firebase deploy --only firestore:rules`)
- GA4 firing not yet verified
- Places API (New) not yet enabled on the Firebase GCP project — required for `refresh-reviews` to call Google directly

**Structural risks (from ROADMAP "Known Risks"):**
- **Google dependency is the biggest existential risk.** All review/rating data flows from Google Places API. Mitigation is the Firestore cache: once a plumber is scraped, their record + reviews are cached permanently. Firestore is the source of truth; Google is the intake pipe. Never build logic that assumes Google will still answer tomorrow.
- **Review synthesis quality bar is hard.** Generic copy like "reliable and professional" is banned. Synthesized blurbs must be specific and punchy — "Multiple reviewers mention surprise fees after the initial quote" not "Customers say they are professional." See ROADMAP → "Review Synthesis Can Become Generic Fast".
- **Yelp coverage gap:** Outscraper returns 0 reviews for businesses with <20 Yelp reviews. Needs an alternative scraping path.
- **SEO is a grind.** Emergency plumbing is one of the most competitive local SEO verticals — our edge must be speed, UX, trust signals (we show weaknesses, not just stars), and honest review synthesis.

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
