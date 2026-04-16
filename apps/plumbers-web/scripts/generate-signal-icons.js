#!/usr/bin/env node
/**
 * Generate signal icons via the nano-banana CLI (Gemini 2.5 Flash Image).
 *
 * Reads signal-icons-manifest.json, iterates over each entry, and invokes the
 * nano-banana CLI at ~/code/control-center/tools/nano-banana/nano-banana.js
 * to produce a PNG at public/icons/signals/<filename>.
 *
 * Idempotent: skips icons that already exist on disk unless --force is passed.
 * Pulls GEMINI_API_KEY from ~/code/control-center/secrets/.env.shared if it's
 * not already set in the environment. Respect the shared env so any teammate
 * running this picks up the same key without copy-paste.
 *
 * Usage:
 *   node scripts/generate-signal-icons.js              # generate missing
 *   node scripts/generate-signal-icons.js --force      # regenerate all
 *   node scripts/generate-signal-icons.js --only <name>  # single icon
 *   node scripts/generate-signal-icons.js --list       # print manifest
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const HERE = __dirname;
const MANIFEST_PATH = path.join(HERE, "signal-icons-manifest.json");
const OUT_DIR = path.join(HERE, "..", "public", "icons", "signals");
const NANO_BANANA = path.join(
  os.homedir(),
  "code",
  "control-center",
  "tools",
  "nano-banana",
  "nano-banana.js",
);
const SHARED_ENV = path.join(
  os.homedir(),
  "code",
  "control-center",
  "secrets",
  ".env.shared",
);

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) return;
  if (!fs.existsSync(SHARED_ENV)) return;
  const lines = fs.readFileSync(SHARED_ENV, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "GEMINI_API_KEY" && val && !process.env.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = val;
    }
  }
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { force: false, only: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--list") args.list = true;
    else if (a === "--only") {
      args.only = argv[++i] || null;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  loadGeminiKey();
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("ERROR: manifest not found:", MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const { styleGuide, icons } = manifest;

  if (args.list) {
    console.log("Signal icon manifest:");
    console.log(`  style: ${styleGuide.slice(0, 80)}...`);
    for (const icon of icons) {
      const outPath = path.join(OUT_DIR, icon.filename);
      const exists = fs.existsSync(outPath) ? "✓" : " ";
      console.log(`  [${exists}] ${icon.name.padEnd(25)} → ${icon.filename}`);
    }
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error(
      "ERROR: GEMINI_API_KEY not set. Expected in env or in ~/code/control-center/secrets/.env.shared",
    );
    process.exit(1);
  }

  if (!fs.existsSync(NANO_BANANA)) {
    console.error("ERROR: nano-banana CLI not found at:", NANO_BANANA);
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const targets = args.only
    ? icons.filter((i) => i.name === args.only)
    : icons;
  if (targets.length === 0) {
    console.error(`ERROR: no matching icon "${args.only}"`);
    process.exit(1);
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const icon of targets) {
    const outPath = path.join(OUT_DIR, icon.filename);
    if (!args.force && fs.existsSync(outPath)) {
      console.log(`  skip  ${icon.name} (exists)`);
      skipped++;
      continue;
    }

    // Prepend style guide to every prompt so the whole set stays cohesive.
    const fullPrompt = `${styleGuide}\n\n${icon.prompt}`;
    console.log(`  gen   ${icon.name}...`);

    try {
      execSync(
        `node ${JSON.stringify(NANO_BANANA)} generate --prompt ${JSON.stringify(fullPrompt)} --out ${JSON.stringify(outPath)} --aspect ${icon.aspect || "square"}`,
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
          timeout: 120000,
        },
      );
      const stat = fs.existsSync(outPath) ? fs.statSync(outPath) : null;
      if (stat && stat.size > 1000) {
        console.log(`        ✓ ${icon.filename} (${Math.round(stat.size / 1024)}KB)`);
        generated++;
      } else {
        console.error(`        ✗ ${icon.filename} — output missing or tiny`);
        failed++;
      }
    } catch (err) {
      console.error(`        ✗ ${icon.name}: ${err.message.split("\n")[0]}`);
      failed++;
    }
  }

  console.log("\nSummary:");
  console.log(`  generated: ${generated}`);
  console.log(`  skipped (exists): ${skipped}`);
  console.log(`  failed: ${failed}`);
  console.log(`  estimated cost: ~$${(generated * 0.05).toFixed(2)}`);
}

main();
