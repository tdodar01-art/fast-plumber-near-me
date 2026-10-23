#!/usr/bin/env node
/** Offline guard; run before paid ingestion and again before committing. */
const fs = require("fs");
const path = require("path");
const {
  MAX_ARTIFACT_BYTES,
  prepareJsonArtifact,
} = require("./lib/json-artifact");
const root = path.join(__dirname, "..");
const files = [
  "data/synthesized/plumbers-synthesized.json",
  "data/synthesized/leaderboard.json",
  "data/raw/plumbers-latest.json",
];
const preflight = process.argv.includes("--preflight");
let failed = false;
for (const file of files) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  try {
    const bytes = preflight
      ? prepareJsonArtifact(
          fullPath,
          JSON.parse(fs.readFileSync(fullPath, "utf8")),
          80 * 1024 * 1024,
        ).bytes
      : fs.statSync(fullPath).size;
    if (bytes > MAX_ARTIFACT_BYTES)
      throw new Error(`${file} exceeds the 90 MiB publish ceiling.`);
    console.log(
      `${file}: ${(bytes / 1048576).toFixed(2)} MiB${preflight ? " compact; 10 MiB export growth reserve" : ""}`,
    );
  } catch (error) {
    console.error(`Artifact guard: ${error.message}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
