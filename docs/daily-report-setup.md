# Daily report — setup checklist

The daily activity report runs as a GitHub Actions cron at 9:30 AM Central
(14:30 UTC) and emails Tim via Brevo. To make it actually send, four GitHub
secrets must exist on this repo.

## GitHub secrets to add

Open https://github.com/tdodar01-art/fast-plumber-near-me/settings/secrets/actions
and add the following four secrets:

| Secret name           | Value                                                                                   |
|-----------------------|-----------------------------------------------------------------------------------------|
| `BREVO_API_KEY`       | Tim's existing AOK Brevo transactional API key (xkeysib-…). Same key used by other AOK products. |
| `BREVO_SENDER_EMAIL`  | A sender already verified on the Brevo account. For v0, an AOK address like `info@aokquickdry.com` is fine (per control-center playbook-delta 023 — the "borrow the existing verified sender" pattern). Migrate to a verified `fastplumbernearme.com` sender when convenient. |
| `BREVO_SENDER_NAME`   | Display name in the inbox preview. Recommend: `Fast Plumber Pipeline`. |
| `REPORT_TO_EMAIL`     | `tim@aokchemdry.net` |

`FIREBASE_SERVICE_ACCOUNT` should already exist (it's used by the other
workflows). The daily-report workflow reuses that same secret to read
`pipelineRuns` and the `plumbers` / `cities` collections.

## Verify locally first

Before relying on the cron, run the report once locally to confirm the
queue counts look right and the email body reads cleanly:

```bash
cd apps/plumbers-web
# Dry-run — prints the text body to stdout, no email sent
node scripts/daily-report.js --dry-run --window-hours 24

# Send a real email (loads BREVO_* from .env.local if present)
node scripts/daily-report.js --to tim@aokchemdry.net
```

## Verify the workflow

Once the secrets are in place, trigger one manual run from the Actions UI:

1. Go to https://github.com/tdodar01-art/fast-plumber-near-me/actions
2. Pick "Daily Activity Report" from the left sidebar
3. Click "Run workflow" → "Run workflow"
4. Watch the run; if it succeeds you'll get an email within a minute

After that, the cron runs every morning at 9:30 AM Central.

## What the email contains

- **Today at a glance** — count of pipeline runs in each of five buckets:
  scrape, level 1 synthesis, level 2 synthesis (decision), city page reorg
  (rank), publish. Plus an errors row.
- **Queue depths** — current snapshot of five queues:
  - A. **Scrape queue** — cities tagged by GSC but not yet scraped
  - B. **Deep-review queue** — plumbers with ≥20 Google reviews and no/stale
    Outscraper pull (eligible for the deep multi-source review pull)
  - C. **Level 1 synthesis queue** — plumbers whose `scores.method` is not
    on the canonical cited set, OR with `pendingRescoreSince` set, OR
    missing a synthesis summary
  - D. **City page reorg queue** — plumbers with scores but no city_rank
    entries (Pass 2 hasn't run for them yet)
  - E. **Level 2 decision queue** — plumbers whose scores are newer than
    their `decision.decided_at` (Pass 3 hasn't caught up)
- **Errors** — every `pipelineRuns` entry with `status="error"` in the
  past 24h, with the error message and timestamp
- **Activity log** — full chronological list of each pipeline run grouped
  by activity class, with script name, status, timestamp, and a short
  summary line built from the `summary` keys on each run

## Adjusting the cadence

The cron is in `.github/workflows/daily-report.yml`:

```yaml
- cron: '30 14 * * *'  # 14:30 UTC = 9:30 AM CDT / 8:30 AM CST
```

Edit and commit to change. To temporarily disable, comment out the
`schedule:` block; the workflow still supports manual `workflow_dispatch`.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| No email arrives | Check the workflow run log on GitHub Actions. If the run failed at "Send daily report via Brevo," the Brevo secrets are misconfigured. If the run succeeded but no email arrived, check the Brevo dashboard for the sent log (Brevo will show a delivery event or bounce). |
| Email arrives but counts look wrong | Run `node scripts/daily-report.js --dry-run --window-hours 168` locally and compare. If queue counts disagree with what you see in `/admin`, the field names in `measureQueues()` may have drifted from the Firestore schema — open `scripts/daily-report.js` and re-check. |
| "Brevo not configured" in the workflow log | One of the three Brevo secrets is missing. Re-add. |
| "FIREBASE_SERVICE_ACCOUNT secret is not configured" | The Firebase secret is missing. This same secret powers the other workflows, so if it's missing those would also be failing — check secret list. |
