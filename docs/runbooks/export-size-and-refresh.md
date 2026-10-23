# Export size and refresh safety

October 23, 2026.

Firestore remains the source of truth. export-firestore-to-json.js remains the only entry point that writes the business and leaderboard artifacts. JSON whitespace is not evidence; compact serialization retains all values and fields.

- Initial business artifact: 97.45 MiB; lossless compact result: 76.83 MiB. After integrating newer main data, the current compact artifact is 78.57 MiB with 6,437 businesses; every upstream field was retained.
- The previous failed August publishing run exceeded GitHub's 100 MiB hard limit.
- Export preparation rejects artifacts over 90 MiB before replacing existing files. Both business and leaderboard serializations are validated before either is written; individual replacement uses a same-directory temporary file and rename.
- CI preflight checks compact size against 80 MiB before paid ingestion (10 MiB reserve below the export ceiling). A second actual-file size check precedes commits in daily/safety workflows. Deep-review publishing runs the exporter's size checks before its internal commit.
- This is bounded headroom, not unlimited growth. At the reserve threshold, split the build artifact by stable IDs/source-owned shards or move build artifacts to suitable storage. Do not discard reviews to make a push pass; do not rewrite published Git history as a side effect.

Offline checks from apps/plumbers-web:

```
node scripts/check-artifact-sizes.js --preflight
node scripts/export-firestore-to-json.js --compact-local
node scripts/check-artifact-sizes.js
```

--compact-local reads only existing JSON and writes equivalent compact JSON. No credentials, network, scoring, database writes, commit or push. Normal export retains --dry-run and --no-push. A normal dry run validates projected business-artifact size without writing it.

All GitHub workflows remain manually disabled. These code changes do not restart or dispatch them. Before resuming refresh, verify current Firestore inventory/export size, ingestion priorities, budget guards, credentials and production behavior. Keep email reports and broad GSC-driven expansion paused while the new curation plan is being validated.

Validation: semantic comparison of each migrated artifact with HEAD confirms every field preserved; tests exercise Unicode/multiline text and oversized-export rejection without overwriting existing data. Production build accepts the compact artifact.
