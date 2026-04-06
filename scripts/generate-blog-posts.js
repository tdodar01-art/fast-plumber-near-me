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
// Helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
  content += `Our rankings are based on a composite score that blends Google rating, review volume, emergency response signals, earned badges, and reliability data. We also check BBB complaint history and cross-reference ratings across Yelp and Angi. No plumber can pay to rank higher.\n\n`;
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
  const postsByType = { rankings: 0, service: 0, "red-flags": 0 };
  const postSlugs = [];

  for (const [key, plumbers] of cityMap) {
    const [city, state] = key.split("|");
    if (plumbers.length < minPlumbers) continue;
    if (cityFilter && slugify(city) !== cityFilter) continue;

    totalCities++;
    const cityPosts = [];

    // 1. Rankings post (always)
    const rankingsPost = generateRankingsPost(city, state, plumbers);
    if (rankingsPost) {
      cityPosts.push(rankingsPost);
      postsByType.rankings++;
    }

    // 2. Service-specific posts (only for services with 2+ plumbers mentioning them)
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

    // 3. Red flags post (if 2+ plumbers have red flags)
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
            service: postsByType.service,
            redFlags: postsByType["red-flags"],
            postSlugs: postSlugs.slice(0, 50), // cap to avoid huge docs
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
