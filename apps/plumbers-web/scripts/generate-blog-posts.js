#!/usr/bin/env node

/**
 * Generate targeted blog posts for cities using plumber synthesis data.
 *
 * Reads plumbers-synthesized.json and generates blog posts for each qualifying
 * city based on service mentions, plumber data, and review evidence.
 *
 * Post types:
 * 1. "Best Emergency Plumbers in [City], [State] ([Year])" — city rankings
 * 2. Service-specific: "Best [Service] Plumbers in [City]" — filtered by servicesMentioned
 * 3. "Red Flags When Hiring a Plumber in [City]" — powered by red flags data
 *
 * Usage:
 *   node scripts/generate-blog-posts.js                      # all qualifying cities
 *   node scripts/generate-blog-posts.js --city crystal-lake   # specific city
 *   node scripts/generate-blog-posts.js --dry-run             # preview without writing
 *   node scripts/generate-blog-posts.js --min-plumbers 5      # minimum plumbers per city (default 3)
 *
 * Output: data/blog-posts/ directory with JSON files per post
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const JSON_PATH = path.join(__dirname, "..", "data", "synthesized", "plumbers-synthesized.json");
const OUTPUT_DIR = path.join(__dirname, "..", "data", "blog-posts");
const YEAR = new Date().getFullYear();

const SERVICE_LABELS = {
  "burst-pipe": { title: "Burst & Frozen Pipe Repair", slug: "burst-pipe-repair", emergency: true },
  "flooding": { title: "Flood & Water Damage Emergency", slug: "flooding-emergency", emergency: true },
  "sewer": { title: "Sewer Line Repair & Cleaning", slug: "sewer-repair", emergency: true },
  "gas-leak": { title: "Gas Leak Detection & Repair", slug: "gas-leak-repair", emergency: true },
  "water-heater": { title: "Water Heater Repair & Replacement", slug: "water-heater", emergency: true },
  "toilet": { title: "Toilet Repair & Installation", slug: "toilet-repair", emergency: false },
  "sump-pump": { title: "Sump Pump Repair & Installation", slug: "sump-pump", emergency: true },
  "drain-cleaning": { title: "Drain Cleaning & Unclogging", slug: "drain-cleaning", emergency: true },
  "water-line": { title: "Water Line Repair & Replacement", slug: "water-line-repair", emergency: true },
  "slab-leak": { title: "Slab Leak Detection & Repair", slug: "slab-leak-repair", emergency: false },
  "garbage-disposal": { title: "Garbage Disposal Repair", slug: "garbage-disposal", emergency: false },
  "faucet-fixture": { title: "Faucet & Fixture Repair", slug: "faucet-fixture-repair", emergency: false },
  "backflow": { title: "Backflow Prevention & Testing", slug: "backflow-testing", emergency: false },
  "repiping": { title: "Whole-House Repiping", slug: "repiping", emergency: false },
  "water-softener": { title: "Water Softener & Filtration", slug: "water-softener", emergency: false },
  "bathroom-remodel": { title: "Bathroom & Kitchen Plumbing Remodel", slug: "bathroom-remodel", emergency: false },
};

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const CLAUDE_RATE_LIMIT_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function slugify(text) {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Region detection
// ---------------------------------------------------------------------------

function getRegionTags(stateAbbr) {
  const tags = [];
  const northern = new Set(["IL","OH","MI","WI","MN","NY","MA","PA","NJ","CT","RI","NH","VT","ME","MD","IA","ND","SD","IN"]);
  const southern = new Set(["TX","FL","GA","AL","MS","LA","SC","NC","TN","AR","OK"]);
  const desert = new Set(["AZ","NM","NV","UT"]);
  const coastalHurricane = new Set(["FL","NC","SC","GA","LA","TX","AL","MS"]);

  if (northern.has(stateAbbr)) tags.push("northern");
  if (southern.has(stateAbbr)) tags.push("southern");
  if (desert.has(stateAbbr)) tags.push("desert");
  if (stateAbbr === "CA") tags.push("california");
  if (coastalHurricane.has(stateAbbr)) tags.push("coastal-hurricane");
  if (tags.length === 0) tags.push("default");
  return tags;
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

async function callClaude(prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set — needed for guide/tips posts");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || "";
}

function stateSlug(abbr) {
  const map = {AL:"alabama",AK:"alaska",AZ:"arizona",AR:"arkansas",CA:"california",CO:"colorado",CT:"connecticut",DE:"delaware",FL:"florida",GA:"georgia",HI:"hawaii",ID:"idaho",IL:"illinois",IN:"indiana",IA:"iowa",KS:"kansas",KY:"kentucky",LA:"louisiana",ME:"maine",MD:"maryland",MA:"massachusetts",MI:"michigan",MN:"minnesota",MS:"mississippi",MO:"missouri",MT:"montana",NE:"nebraska",NV:"nevada",NH:"new-hampshire",NJ:"new-jersey",NM:"new-mexico",NY:"new-york",NC:"north-carolina",ND:"north-dakota",OH:"ohio",OK:"oklahoma",OR:"oregon",PA:"pennsylvania",RI:"rhode-island",SC:"south-carolina",SD:"south-dakota",TN:"tennessee",TX:"texas",UT:"utah",VT:"vermont",VA:"virginia",WA:"washington",WV:"west-virginia",WI:"wisconsin",WY:"wyoming",DC:"district-of-columbia"};
  return map[abbr] || abbr.toLowerCase();
}

function stateName(abbr) {
  const map = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia"};
  return map[abbr] || abbr;
}

// ---------------------------------------------------------------------------
// Post generators
// ---------------------------------------------------------------------------

function generateRankingsPost(city, state, plumbers) {
  const ranked = [...plumbers].sort((a, b) => (b.synthesis?.score || 0) - (a.synthesis?.score || 0));
  const cityUrl = `/emergency-plumbers/${stateSlug(state)}/${slugify(city)}`;
  const fullState = stateName(state);

  let content = `Looking for a reliable emergency plumber in ${city}, ${fullState}? We analyzed ${plumbers.length} plumbing companies using real Google, Yelp, and BBB data to rank the best options for ${YEAR}.\n\n`;
  content += `Every ranking below is based on verified review data — not paid placements. We show you the good AND the bad.\n\n`;

  for (let i = 0; i < Math.min(ranked.length, 10); i++) {
    const p = ranked[i];
    const s = p.synthesis;
    if (!s) continue;

    content += `## ${i + 1}. ${p.name}\n\n`;
    content += `**Trust Score: ${s.score}/100** | Google: ${p.googleRating || "N/A"}/5 (${p.googleReviewCount} reviews)`;
    if (p.bbb) content += ` | BBB: ${p.bbb.rating || "N/A"}${p.bbb.accredited ? " (Accredited)" : ""}`;
    content += `\n\n`;

    if (s.summary) content += `${s.summary}\n\n`;

    if (s.strengths?.length > 0) {
      content += `**Strengths:**\n`;
      s.strengths.forEach((str) => content += `- ${str}\n`);
      content += `\n`;
    }

    if (s.weaknesses?.length > 0) {
      content += `**Watch out for:**\n`;
      s.weaknesses.forEach((w) => content += `- ${w}\n`);
      content += `\n`;
    }

    if (s.emergencyReadiness) {
      content += `**Emergency readiness:** ${s.emergencyReadiness}`;
      if (s.emergencyNotes) content += ` — ${s.emergencyNotes}`;
      content += `\n\n`;
    }

    content += `[See full profile and reviews](/plumber/${p.slug})\n\n`;
    content += `---\n\n`;
  }

  content += `## How We Rank Plumbers\n\n`;
  content += `Our rankings are based on a composite score that blends Google rating, review volume, emergency response signals, earned badges, and reliability data. We also check BBB complaint history and cross-reference ratings across Yelp. No plumber can pay to rank higher.\n\n`;
  content += `[See all emergency plumbers in ${city}](${cityUrl})\n`;

  return {
    slug: `best-emergency-plumbers-${slugify(city)}-${state.toLowerCase()}-${YEAR}`,
    title: `Best Emergency Plumbers in ${city}, ${fullState} (${YEAR} Rankings)`,
    description: `${plumbers.length} plumbers ranked by trust score. Real Google, Yelp & BBB data — strengths, weaknesses, and red flags for every plumber in ${city}.`,
    publishedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    readTime: `${Math.max(5, Math.ceil(ranked.length * 0.8))} min read`,
    city,
    state,
    type: "rankings",
    content,
    plumberSlugs: ranked.slice(0, 10).map((p) => p.slug),
    cityPageUrl: cityUrl,
  };
}

function generateServicePost(city, state, serviceKey, plumbers) {
  const serviceInfo = SERVICE_LABELS[serviceKey];
  if (!serviceInfo) return null;

  // Filter to plumbers that have this service mentioned
  const withService = plumbers.filter((p) => p.synthesis?.servicesMentioned?.[serviceKey]);
  if (withService.length < 2) return null;

  // Sort by the service-specific average rating
  withService.sort((a, b) => {
    const aRating = a.synthesis.servicesMentioned[serviceKey].avgRating || 0;
    const bRating = b.synthesis.servicesMentioned[serviceKey].avgRating || 0;
    return bRating - aRating;
  });

  const cityUrl = `/emergency-plumbers/${stateSlug(state)}/${slugify(city)}`;
  const fullState = stateName(state);

  let content = `Need ${serviceInfo.title.toLowerCase()} in ${city}, ${fullState}? We found ${withService.length} plumbers with verified experience in this service, ranked by customer review data.\n\n`;

  for (let i = 0; i < Math.min(withService.length, 8); i++) {
    const p = withService[i];
    const svc = p.synthesis.servicesMentioned[serviceKey];
    const s = p.synthesis;

    content += `## ${i + 1}. ${p.name}\n\n`;
    content += `**${serviceInfo.title} rating: ${svc.avgRating}/5** (${svc.count} review${svc.count !== 1 ? "s" : ""} mention this service) | Overall: ${p.googleRating || "N/A"}/5\n\n`;

    if (svc.topQuote) {
      content += `> "${svc.topQuote}"\n\n`;
    }

    if (s.summary) content += `${s.summary}\n\n`;
    content += `[See full profile](/plumber/${p.slug})\n\n---\n\n`;
  }

  content += `[See all plumbers in ${city}](${cityUrl})\n`;

  return {
    slug: `best-${serviceInfo.slug}-plumbers-${slugify(city)}-${state.toLowerCase()}`,
    title: `Best ${serviceInfo.title} Plumbers in ${city}, ${fullState}`,
    description: `${withService.length} plumbers in ${city} with verified ${serviceInfo.title.toLowerCase()} experience. Ranked by service-specific review ratings.`,
    publishedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    readTime: `${Math.max(4, Math.ceil(withService.length * 0.6))} min read`,
    city,
    state,
    type: "service",
    serviceKey,
    content,
    plumberSlugs: withService.slice(0, 8).map((p) => p.slug),
    cityPageUrl: cityUrl,
  };
}

function generateRedFlagsPost(city, state, plumbers) {
  const withFlags = plumbers.filter((p) => p.synthesis?.redFlags?.length > 0);
  if (withFlags.length < 2) return null;

  const fullState = stateName(state);
  const cityUrl = `/emergency-plumbers/${stateSlug(state)}/${slugify(city)}`;
  const allFlags = [];

  for (const p of withFlags) {
    for (const flag of p.synthesis.redFlags) {
      allFlags.push({ plumber: p.name, slug: p.slug, flag });
    }
  }

  let content = `Before hiring a plumber in ${city}, ${fullState}, check for these warning signs we found in real review data. We analyzed ${plumbers.length} plumbing companies and flagged ${allFlags.length} concerns across ${withFlags.length} businesses.\n\n`;
  content += `These red flags come from actual customer reviews on Google and Yelp — not opinions.\n\n`;

  // Group by theme
  const themes = {
    "Response Time & Reliability": allFlags.filter((f) => /late|delay|response|callback|show up|no.show/i.test(f.flag)),
    "Pricing & Billing": allFlags.filter((f) => /price|pricing|charge|bill|cost|fee|quote|upsell/i.test(f.flag)),
    "Work Quality": allFlags.filter((f) => /quality|damage|incomplete|botch|broken|leak/i.test(f.flag)),
    "Communication": allFlags.filter((f) => /communicat|rude|unprofessional|ghost|answer/i.test(f.flag)),
  };

  for (const [theme, flags] of Object.entries(themes)) {
    if (flags.length === 0) continue;
    content += `## ${theme}\n\n`;
    for (const f of flags) {
      content += `- **${f.plumber}:** ${f.flag} — [See full profile](/plumber/${f.slug})\n`;
    }
    content += `\n`;
  }

  // Remaining flags not in any theme
  const themed = new Set(Object.values(themes).flat().map((f) => f.flag));
  const other = allFlags.filter((f) => !themed.has(f.flag));
  if (other.length > 0) {
    content += `## Other Concerns\n\n`;
    for (const f of other) {
      content += `- **${f.plumber}:** ${f.flag} — [See full profile](/plumber/${f.slug})\n`;
    }
    content += `\n`;
  }

  content += `## How to Protect Yourself\n\n`;
  content += `- Always get a written estimate before work begins\n`;
  content += `- Ask for license and insurance verification\n`;
  content += `- Check multiple review platforms (Google, Yelp, BBB)\n`;
  content += `- Be wary of plumbers who refuse to provide estimates over the phone\n`;
  content += `- Document everything — photos before and after work\n\n`;
  content += `[See all rated plumbers in ${city}](${cityUrl})\n`;

  return {
    slug: `red-flags-hiring-plumber-${slugify(city)}-${state.toLowerCase()}`,
    title: `Red Flags to Watch For When Hiring a Plumber in ${city}, ${fullState}`,
    description: `${allFlags.length} warning signs found across ${withFlags.length} plumbers in ${city}. Real data from Google and Yelp reviews.`,
    publishedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    readTime: `${Math.max(4, Math.ceil(allFlags.length * 0.3))} min read`,
    city,
    state,
    type: "red-flags",
    content,
    plumberSlugs: withFlags.map((p) => p.slug),
    cityPageUrl: cityUrl,
  };
}

// ---------------------------------------------------------------------------
// Post Type 4: Local Emergency Plumbing Guide (Claude-generated)
// ---------------------------------------------------------------------------

async function generateGuidePost(city, state, plumbers, dryRun) {
  if (plumbers.length < 5) return null;

  const fullState = stateName(state);
  const cityUrl = `/emergency-plumbers/${stateSlug(state)}/${slugify(city)}`;
  const regions = getRegionTags(state);
  const ranked = [...plumbers].sort((a, b) => (b.synthesis?.score || 0) - (a.synthesis?.score || 0));
  const top3 = ranked.slice(0, 3);

  // Compute city stats
  const ratings = plumbers.filter((p) => p.googleRating).map((p) => p.googleRating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : "N/A";
  const totalReviews = plumbers.reduce((s, p) => s + (p.googleReviewCount || 0), 0);
  const highEmergency = plumbers.filter((p) => p.synthesis?.emergencyReadiness === "high").length;
  const pricingDist = {};
  plumbers.forEach((p) => { const t = p.synthesis?.priceSignal || "unknown"; pricingDist[t] = (pricingDist[t] || 0) + 1; });
  const bbbAccredited = plumbers.filter((p) => p.bbb?.accredited).length;

  const meta = {
    slug: `emergency-plumber-${slugify(city)}-${state.toLowerCase()}`,
    title: `Emergency Plumber in ${city}, ${fullState}: What to Know Before You Call`,
    description: `${plumbers.length} emergency plumbers in ${city} analyzed. Average ${avgRating}/5 rating, ${totalReviews.toLocaleString()} reviews studied. Response times, pricing, and what to look for.`,
    publishedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    readTime: "8 min read",
    city,
    state,
    citySlug: slugify(city),
    stateSlug: stateSlug(state),
    type: "guide",
    category: "guide",
    plumberSlugs: top3.map((p) => p.slug),
    cityPageUrl: cityUrl,
    plumberCount: plumbers.length,
    reviewsAnalyzed: totalReviews,
    generatedAt: new Date().toISOString(),
  };

  if (dryRun) return meta;

  if (!ANTHROPIC_API_KEY) {
    meta.content = `[Content generation requires ANTHROPIC_API_KEY]`;
    return meta;
  }

  const prompt = `Write a local emergency plumbing guide for ${city}, ${fullState}. 800-1200 words in markdown.

DATA TO USE (real numbers — reference them):
- ${plumbers.length} emergency plumbers serve ${city}
- Average Google rating: ${avgRating}/5 across ${totalReviews.toLocaleString()} total reviews
- ${highEmergency} plumbers have confirmed high emergency readiness
- Pricing distribution: ${Object.entries(pricingDist).map(([k,v]) => `${v} ${k}`).join(", ")}
- BBB accredited: ${bbbAccredited} of ${plumbers.length}
- Region tags: ${regions.join(", ")}

TOP 3 PLUMBERS (link to their profiles):
${top3.map((p, i) => `${i+1}. ${p.name} — ${p.googleRating}/5 (${p.googleReviewCount} reviews), Score: ${p.synthesis?.score}/100, Badges: ${(p.synthesis?.badges || []).join(", ") || "none"} — link: /plumber/${p.slug}`).join("\n")}

CITY PAGE LINK: ${cityUrl}

STRUCTURE:
1. Open with local context — how many plumbers, average rating, total reviews analyzed
2. Average response time signals (${highEmergency} of ${plumbers.length} have high emergency readiness)
3. Price range section based on pricing tier distribution
4. Region-specific emergency context for ${regions.join("/")} region:${regions.includes("northern") ? " frozen pipes, winter prep, pipe insulation" : ""}${regions.includes("southern") || regions.includes("desert") ? " slab leaks, heat stress on water heaters" : ""}${regions.includes("california") ? " earthquake gas/water shutoff procedures" : ""}${regions.includes("coastal-hurricane") ? " hurricane plumbing prep, post-storm contamination" : ""}
5. What to look for when choosing (licensing, BBB, 24/7, transparent pricing)
6. Link to top 3 plumbers by name with /plumber/[slug] links
7. CTA linking to ${cityUrl}

Write in a helpful, authoritative tone. Use the real data. Do NOT make up statistics.
Output ONLY the markdown content — no frontmatter, no code fences.`;

  await sleep(CLAUDE_RATE_LIMIT_MS);
  const content = await callClaude(prompt);
  meta.content = content;
  return meta;
}

// ---------------------------------------------------------------------------
// Post Type 5: Emergency Tips While You Wait (Claude-generated)
// ---------------------------------------------------------------------------

async function generateTipsPost(city, state, plumbers, dryRun) {
  if (plumbers.length < 5) return null;

  const fullState = stateName(state);
  const cityUrl = `/emergency-plumbers/${stateSlug(state)}/${slugify(city)}`;
  const regions = getRegionTags(state);
  const ranked = [...plumbers].sort((a, b) => (b.synthesis?.score || 0) - (a.synthesis?.score || 0));
  const top2 = ranked.slice(0, 2);

  const meta = {
    slug: `plumbing-emergency-tips-${slugify(city)}-${state.toLowerCase()}`,
    title: `${city}, ${fullState} Plumbing Emergency? Here's How to Stop Water Damage While You Wait`,
    description: `Step-by-step emergency plumbing guide for ${city} homeowners. Stop water damage, protect your home, and know when to call a pro.`,
    publishedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    readTime: "5 min read",
    city,
    state,
    citySlug: slugify(city),
    stateSlug: stateSlug(state),
    type: "emergency-tips",
    category: "emergency-tips",
    plumberSlugs: top2.map((p) => p.slug),
    cityPageUrl: cityUrl,
    plumberCount: plumbers.length,
    reviewsAnalyzed: plumbers.reduce((s, p) => s + (p.googleReviewCount || 0), 0),
    generatedAt: new Date().toISOString(),
  };

  if (dryRun) return meta;

  if (!ANTHROPIC_API_KEY) {
    meta.content = `[Content generation requires ANTHROPIC_API_KEY]`;
    return meta;
  }

  const prompt = `Write an emergency plumbing tips article for homeowners in ${city}, ${fullState}. 600-900 words in markdown.

Open with urgency: "If you're searching for an emergency plumber in ${city} right now, you probably have water somewhere it shouldn't be."

STRUCTURE:
1. Step 1: Find your main shutoff valve (where it usually is, what it looks like)
2. Step 2: Stop the water at the source (toilet shutoff, sink shutoff, water heater shutoff)
3. Step 3: Document damage for insurance (photos, video, keep receipts)
4. Step 4: Mitigate further damage (towels, buckets, move belongings, open windows if needed)
5. Step 5: When to call a plumber vs when you can wait

REGION-SPECIFIC TIPS for ${regions.join("/")} region:
${regions.includes("northern") ? "- Frozen pipe thawing technique (hair dryer, warm towels — NEVER open flame)\n- How to keep pipes from refreezing (drip faucets, open cabinet doors, heat tape)" : ""}${regions.includes("southern") || regions.includes("desert") ? "- Slab leak warning signs (hot spots on floor, unexplained water bill spike, foundation cracking)\n- Heat stress on water heaters in summer" : ""}${regions.includes("california") ? "- Earthquake gas and water shutoff procedure\n- Where the gas valve is and how to turn it off\n- Post-earthquake plumbing inspection checklist" : ""}${regions.includes("coastal-hurricane") ? "- Pre-storm plumbing prep (turn off water heater, know shutoff locations)\n- After-storm water contamination checks (don't drink tap water until cleared)" : ""}${regions.length === 1 && regions[0] === "default" ? "- General seasonal tips for your area" : ""}

END WITH CTA: "When you're ready, here are ${city}'s top-rated emergency plumbers" linking to ${cityUrl}
Also mention these top plumbers inline:
- ${top2[0]?.name || "Top local plumber"} — /plumber/${top2[0]?.slug || ""}
${top2[1] ? `- ${top2[1].name} — /plumber/${top2[1].slug}` : ""}

Write in an urgent but calm tone — the reader might be standing in water right now.
Output ONLY the markdown content — no frontmatter, no code fences.`;

  await sleep(CLAUDE_RATE_LIMIT_MS);
  const content = await callClaude(prompt);
  meta.content = content;
  return meta;
}

// ---------------------------------------------------------------------------
// Firebase (optional — for pipelineRuns logging)
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

function getDb() {
  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) return null;
    const admin = require("firebase-admin");
    const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
    return admin.firestore();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cityFilter = args.includes("--city") ? args[args.indexOf("--city") + 1] : null;
  const minPlumbers = args.includes("--min-plumbers") ? parseInt(args[args.indexOf("--min-plumbers") + 1]) : 3;
  const startedAt = new Date();

  console.log("=== Blog Post Generator ===\n");
  if (dryRun) console.log("[DRY RUN]\n");

  // Load plumber data
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  console.log(`Loaded ${data.plumbers.length} plumbers\n`);

  // Group plumbers by city+state
  const cityMap = new Map();
  for (const p of data.plumbers) {
    if (!p.city || !p.state || !p.synthesis) continue;
    const key = `${p.city}|${p.state}`;
    if (!cityMap.has(key)) cityMap.set(key, []);
    cityMap.get(key).push(p);
  }

  // Ensure output directory
  if (!dryRun && !fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let totalPosts = 0;
  let totalCities = 0;
  const postsByType = { rankings: 0, guide: 0, "emergency-tips": 0, service: 0, "red-flags": 0 };
  const postSlugs = [];

  for (const [key, plumbers] of cityMap) {
    const [city, state] = key.split("|");
    if (plumbers.length < minPlumbers) continue;
    if (cityFilter && slugify(city) !== cityFilter) continue;

    totalCities++;
    const cityPosts = [];

    // 1. Rankings post (always, >= 3 plumbers)
    const rankingsPost = generateRankingsPost(city, state, plumbers);
    if (rankingsPost) {
      cityPosts.push(rankingsPost);
      postsByType.rankings++;
    }

    // 2. Local emergency plumbing guide (>= 5 plumbers, Claude-generated)
    try {
      const guidePost = await generateGuidePost(city, state, plumbers, dryRun);
      if (guidePost) {
        cityPosts.push(guidePost);
        postsByType.guide++;
      }
    } catch (err) {
      console.error(`  Guide error for ${city}: ${err.message}`);
    }

    // 3. Emergency tips while you wait (>= 5 plumbers, Claude-generated)
    try {
      const tipsPost = await generateTipsPost(city, state, plumbers, dryRun);
      if (tipsPost) {
        cityPosts.push(tipsPost);
        postsByType["emergency-tips"]++;
      }
    } catch (err) {
      console.error(`  Tips error for ${city}: ${err.message}`);
    }

    // 4. Service-specific posts (only for services with 2+ plumbers mentioning them)
    const serviceCounts = {};
    for (const p of plumbers) {
      for (const svc of Object.keys(p.synthesis?.servicesMentioned || {})) {
        serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
      }
    }

    for (const [svc, count] of Object.entries(serviceCounts)) {
      if (count < 2) continue;
      const post = generateServicePost(city, state, svc, plumbers);
      if (post) {
        cityPosts.push(post);
        postsByType.service++;
      }
    }

    // 5. Red flags post (if 2+ plumbers have red flags)
    const redFlagsPost = generateRedFlagsPost(city, state, plumbers);
    if (redFlagsPost) {
      cityPosts.push(redFlagsPost);
      postsByType["red-flags"]++;
    }

    totalPosts += cityPosts.length;

    if (cityPosts.length > 0) {
      console.log(`${city}, ${state}: ${cityPosts.length} posts`);
      cityPosts.forEach((p) => {
        console.log(`  - ${p.type}: ${p.slug}`);
        postSlugs.push(p.slug);
      });
    }

    // Write posts
    if (!dryRun) {
      for (const post of cityPosts) {
        const outPath = path.join(OUTPUT_DIR, `${post.slug}.json`);
        fs.writeFileSync(outPath, JSON.stringify(post, null, 2));
      }
    }
  }

  const elapsed = Math.round((Date.now() - startedAt.getTime()) / 1000);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 Summary:`);
  console.log(`  Cities: ${totalCities}`);
  console.log(`  Total posts: ${totalPosts}`);
  console.log(`    Rankings: ${postsByType.rankings}`);
  console.log(`    Local Guides: ${postsByType.guide}`);
  console.log(`    Emergency Tips: ${postsByType["emergency-tips"]}`);
  console.log(`    Service-specific: ${postsByType.service}`);
  console.log(`    Red flags: ${postsByType["red-flags"]}`);
  console.log(`  Duration: ${elapsed}s`);

  if (!dryRun && totalPosts > 0) {
    console.log(`\nPosts written to: ${OUTPUT_DIR}`);
  }

  // Log to pipelineRuns
  if (!dryRun) {
    try {
      const db = getDb();
      if (db) {
        const admin = require("firebase-admin");
        await db.collection("pipelineRuns").add({
          script: "generate-blog",
          startedAt: admin.firestore.Timestamp.fromDate(startedAt),
          completedAt: admin.firestore.Timestamp.now(),
          durationSeconds: elapsed,
          status: "success",
          summary: {
            totalPosts,
            cities: totalCities,
            rankings: postsByType.rankings,
            guides: postsByType.guide,
            emergencyTips: postsByType["emergency-tips"],
            service: postsByType.service,
            redFlags: postsByType["red-flags"],
            postSlugs: postSlugs.slice(0, 50),
          },
          triggeredBy: process.env.GITHUB_ACTIONS ? "github-actions" : "manual",
        });
      }
    } catch { /* non-fatal */ }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
