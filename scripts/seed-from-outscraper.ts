/**
 * Seed Firestore from Outscraper CSV export.
 *
 * Usage:
 *   npx ts-node scripts/seed-from-outscraper.ts --dry-run
 *   npx ts-node scripts/seed-from-outscraper.ts
 *
 * Prerequisites:
 *   - CSV at data/outscraper-plumbers.csv
 *   - Firebase credentials in .env.local (loaded via dotenv or set in env)
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const CSV_PATH = path.resolve(__dirname, "../data/outscraper-plumbers.csv");
const BATCH_LIMIT = 500;

// Load .env.local manually (ts-node doesn't load Next.js env)
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("ERROR: .env.local not found. Create it from .env.local.example");
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
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

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// County lookup
// ---------------------------------------------------------------------------

const COUNTY_MAP: Record<string, string> = {
  Naperville: "DuPage",
  Aurora: "Kane",
  Bolingbrook: "Will",
  Plainfield: "Will",
  Joliet: "Will",
  Oswego: "Kendall",
  "Downers Grove": "DuPage",
  Wheaton: "DuPage",
  Lombard: "DuPage",
  Lisle: "DuPage",
  "Glen Ellyn": "DuPage",
  Batavia: "Kane",
  "St. Charles": "Kane",
  "North Aurora": "Kane",
  Montgomery: "Kane",
  Warrenville: "DuPage",
  Woodridge: "DuPage",
  Lemont: "Cook/Will",
  Lockport: "Will",
  "Villa Park": "DuPage",
  Westmont: "DuPage",
  "Glendale Heights": "DuPage",
  "Clarendon Hills": "DuPage",
  Shorewood: "Will",
  "Highland Park": "Lake",
  Lyons: "Cook",
  "Elk Grove Village": "Cook",
};

// Nearby cities (geographic proximity)
const NEARBY_MAP: Record<string, string[]> = {
  Naperville: ["Aurora", "Wheaton", "Lisle", "Bolingbrook", "Downers Grove", "Warrenville", "Plainfield"],
  Aurora: ["Naperville", "North Aurora", "Batavia", "Montgomery", "Oswego", "Plainfield"],
  Bolingbrook: ["Naperville", "Woodridge", "Plainfield", "Lockport", "Lemont", "Downers Grove"],
  Plainfield: ["Naperville", "Joliet", "Bolingbrook", "Oswego", "Aurora", "Shorewood"],
  Joliet: ["Plainfield", "Lockport", "Shorewood", "Bolingbrook"],
  Oswego: ["Aurora", "Plainfield", "Montgomery", "Naperville"],
  "Downers Grove": ["Naperville", "Lombard", "Lisle", "Westmont", "Woodridge", "Wheaton"],
  Wheaton: ["Naperville", "Glen Ellyn", "Lombard", "Warrenville", "Lisle", "Downers Grove"],
  Lombard: ["Downers Grove", "Glen Ellyn", "Villa Park", "Wheaton", "Glendale Heights"],
  Lisle: ["Naperville", "Downers Grove", "Wheaton", "Warrenville", "Woodridge"],
  "Glen Ellyn": ["Wheaton", "Lombard", "Glendale Heights", "Downers Grove"],
  Batavia: ["Aurora", "St. Charles", "Geneva", "North Aurora", "Warrenville"],
  "St. Charles": ["Batavia", "Geneva", "North Aurora", "Wheaton"],
  "North Aurora": ["Aurora", "Batavia", "Montgomery", "Oswego"],
  Montgomery: ["Aurora", "Oswego", "North Aurora", "Plainfield"],
  Warrenville: ["Naperville", "Wheaton", "Lisle", "Batavia"],
  Woodridge: ["Bolingbrook", "Downers Grove", "Lisle", "Naperville"],
  Lemont: ["Bolingbrook", "Lockport", "Downers Grove"],
  Lockport: ["Joliet", "Plainfield", "Bolingbrook", "Lemont", "Shorewood"],
  "Villa Park": ["Lombard", "Downers Grove", "Glendale Heights", "Elk Grove Village"],
  Westmont: ["Downers Grove", "Clarendon Hills", "Lombard"],
  "Glendale Heights": ["Glen Ellyn", "Lombard", "Villa Park", "Elk Grove Village"],
  "Clarendon Hills": ["Westmont", "Downers Grove", "Lombard"],
  Shorewood: ["Joliet", "Plainfield", "Lockport"],
  "Highland Park": [],
  Lyons: [],
  "Elk Grove Village": ["Glendale Heights", "Villa Park", "Lombard"],
};

// City hero content
const HERO_CONTENT: Record<string, string> = {
  Naperville:
    "Naperville is consistently ranked as one of the best places to live in Illinois, but even great cities have plumbing emergencies. From the historic downtown to newer communities along Route 59, water heater failures, burst pipes, and drain backups can happen anytime. Our directory connects you with verified plumbers ready to respond.",
  Aurora:
    "Aurora is the second-largest city in Illinois, spanning four counties with a vast range of housing. From older east-side homes to new construction on the far west side, plumbing emergencies are a constant. Find verified emergency plumbers in Aurora who will actually answer your call.",
  Bolingbrook:
    "Bolingbrook is a large suburb in Will County with homes ranging from the 1960s to brand new construction. Aging pipes, sump pump failures, and water heater emergencies are common issues. Our verified plumbers serving Bolingbrook are ready to respond around the clock.",
  Plainfield:
    "Plainfield has exploded with growth over the past two decades, bringing thousands of new homes that are now aging into their first major plumbing issues. From water heater replacements to sewer line problems, our verified plumbers in Plainfield are a call away.",
  Joliet:
    "Joliet is the largest city in Will County, with a diverse housing stock that includes everything from historic stone homes to modern subdivisions. Plumbing emergencies don't wait — find a verified emergency plumber in Joliet who will actually pick up the phone.",
  Oswego:
    "Oswego has grown rapidly along the Fox River, with many newer homes that are starting to experience their first plumbing issues. Whether it's a water heater failure or a frozen pipe in winter, our verified Oswego plumbers are confirmed responsive.",
  "Downers Grove":
    "Downers Grove is a classic DuPage County suburb with tree-lined streets and homes dating from the early 1900s to present day. Older plumbing systems mean more emergencies — burst pipes, sewer backups, and water heater failures. Our verified plumbers are ready.",
  Wheaton:
    "Wheaton is the DuPage County seat, home to beautiful neighborhoods and a vibrant downtown. Many homes have older plumbing prone to emergencies, especially during winter freezes. Find verified plumbers confirmed responsive to emergency calls in Wheaton.",
  Lombard:
    "Lombard is a well-established DuPage County village with housing stock spanning several decades. Aging pipes, drain issues, and water heater problems are everyday realities. Our verified Lombard plumbers are tested for responsiveness.",
  Lisle:
    "Lisle is a charming village along the East Branch of the DuPage River. With a mix of older homes and corporate campuses, plumbing emergencies can strike residential and commercial properties alike. Our verified plumbers in Lisle are ready to respond.",
  "Glen Ellyn":
    "Glen Ellyn is a sought-after DuPage County village with many historic homes and mature neighborhoods. Older plumbing systems mean burst pipes, drain backups, and water heater failures are common concerns. Find verified emergency plumbers ready to help.",
  Batavia:
    "Batavia is the oldest city in Kane County, with homes spanning over a century of construction. This means a wide variety of plumbing systems and potential emergencies. Our verified plumbers serving Batavia are ready to handle anything from burst pipes to sewer failures.",
  "St. Charles":
    "St. Charles is a picturesque Fox River community with historic homes and modern developments alike. Plumbing emergencies from frozen pipes to sewer backups don't wait for business hours. Our verified St. Charles plumbers are confirmed available for emergency service.",
  "North Aurora":
    "North Aurora is a growing Kane County village with a mix of established and new construction. As homes age, plumbing issues become more common. Our verified emergency plumbers serving North Aurora are tested for fast response times.",
  Montgomery:
    "Montgomery straddles the Fox River in Kane and Kendall counties with a growing residential base. Water heater failures, frozen pipes, and drain emergencies require fast response. Our verified Montgomery plumbers are ready to help.",
  Warrenville:
    "Warrenville is a small but vibrant DuPage County city surrounded by forest preserves. Residential plumbing emergencies here need reliable, responsive service. Our verified plumbers serving Warrenville are confirmed to answer emergency calls.",
  Woodridge:
    "Woodridge is a friendly village in DuPage and Will counties with homes from the 1970s-2000s that are now experiencing aging plumbing issues. Our verified emergency plumbers in Woodridge are tested for responsiveness and availability.",
  Lemont:
    "Lemont sits along the Des Plaines River and the historic Illinois & Michigan Canal, with homes ranging from historic limestone buildings to modern developments. Plumbing emergencies here need fast, reliable response. Our verified plumbers are ready.",
  Lockport:
    "Lockport is a historic Will County city along the Des Plaines River with charming older homes and newer subdivisions. Aging plumbing in older neighborhoods means emergency calls are common. Find verified plumbers in Lockport ready to respond.",
  "Villa Park":
    "Villa Park is a welcoming DuPage County village with affordable housing and established neighborhoods. Older plumbing systems can lead to unexpected emergencies. Our verified plumbers serving Villa Park are confirmed responsive.",
  Westmont:
    "Westmont is a compact DuPage County village known for its dining scene and convenient location. Residential plumbing emergencies here need quick, reliable service. Our verified Westmont plumbers are tested for availability.",
  "Glendale Heights":
    "Glendale Heights is a diverse DuPage County village with a range of housing types. From apartment complexes to single-family homes, plumbing emergencies can happen anywhere. Our verified plumbers are ready to respond.",
  "Clarendon Hills":
    "Clarendon Hills is a charming, tight-knit DuPage County village with beautiful older homes. Historic plumbing systems mean emergencies like burst pipes and sewer backups are a real concern. Our verified plumbers are confirmed available.",
  Shorewood:
    "Shorewood is a growing Will County village near Joliet with many newer homes along the DuPage River. Even newer construction can experience plumbing emergencies. Our verified plumbers serving Shorewood are ready 24/7.",
  "Highland Park":
    "Highland Park is an affluent North Shore community in Lake County with a mix of historic estates and modern homes. Premium properties deserve premium plumbing service. Our verified emergency plumbers are confirmed responsive.",
  Lyons:
    "Lyons is a village in Cook County's western suburbs with a mix of residential and commercial properties. Plumbing emergencies in older buildings here need fast professional response. Our verified plumbers are ready.",
  "Elk Grove Village":
    "Elk Grove Village is one of the largest industrial parks in the US, but it also has thriving residential neighborhoods. Whether residential or commercial, plumbing emergencies need fast response. Our verified plumbers are ready to help.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(city: string, state: string = "il"): string {
  return (
    city
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    state.toLowerCase()
  );
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Handle +1 prefix
  const d = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw; // Return as-is if unexpected format
}

function stripUtmParams(url: string | null | undefined): string | null {
  if (!url || url.trim() === "") return null;
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_")) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function parseWorkingHours(raw: string): Record<string, string> | null {
  if (!raw || raw.trim() === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function checkIs24Hour(hours: Record<string, string> | null): boolean {
  if (!hours) return false;
  return Object.values(hours).some((v) =>
    v.toLowerCase().includes("open 24 hours")
  );
}

function parseServices(subtypes: string): string[] {
  if (!subtypes || subtypes.trim() === "") return ["plumber"];
  return subtypes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-")
    );
}

function stateAbbrev(state: string): string {
  const map: Record<string, string> = {
    illinois: "IL",
    indiana: "IN",
    wisconsin: "WI",
    iowa: "IA",
    michigan: "MI",
  };
  const lower = state.toLowerCase().trim();
  return map[lower] || (state.length === 2 ? state.toUpperCase() : state);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== SEEDING FIRESTORE ===");
  console.log(`Reading CSV: ${CSV_PATH}\n`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  console.log(`Parsed ${records.length} rows from CSV\n`);

  // Deduplicate by place_id, skip rows without phone
  const seen = new Set<string>();
  const plumbers: Record<string, string>[] = [];
  let skippedNoPhone = 0;
  let skippedDuplicate = 0;

  for (const row of records) {
    const phone = (row.phone || "").trim();
    if (!phone) {
      skippedNoPhone++;
      continue;
    }
    const placeId = (row.place_id || "").trim();
    if (placeId && seen.has(placeId)) {
      skippedDuplicate++;
      continue;
    }
    if (placeId) seen.add(placeId);
    plumbers.push(row);
  }

  console.log(`  ${plumbers.length} plumbers to seed`);
  console.log(`  ${skippedNoPhone} skipped (no phone)`);
  console.log(`  ${skippedDuplicate} skipped (duplicate place_id)\n`);

  // Collect unique cities
  const cityMap = new Map<string, { name: string; count: number }>();
  for (const row of plumbers) {
    const cityName = (row.city || "").trim();
    if (!cityName) continue;
    const slug = slugify(cityName);
    const existing = cityMap.get(slug);
    if (existing) {
      existing.count++;
    } else {
      cityMap.set(slug, { name: cityName, count: 1 });
    }
  }

  console.log(`  ${cityMap.size} unique cities found\n`);

  // ---------------------------------------------------------------------------
  // Build Firestore documents
  // ---------------------------------------------------------------------------

  const plumberDocs: { id: string; data: Record<string, unknown> }[] = [];

  for (const row of plumbers) {
    const placeId = (row.place_id || "").trim();
    const docId = placeId || slugify(row.name || "unknown");
    const cityName = (row.city || "").trim();
    const stateStr = stateAbbrev(row.state || row.us_state || "");
    const workingHours = parseWorkingHours(row.working_hours || "");

    plumberDocs.push({
      id: docId,
      data: {
        businessName: (row.name || "").trim(),
        ownerName: "",
        phone: formatPhone(row.phone || ""),
        website: stripUtmParams(row.site),
        email: (row.email_1 || "").trim() || null,
        address: {
          full: (row.full_address || "").trim(),
          street: (row.street || "").trim(),
          city: cityName,
          state: stateStr,
          zip: (row.postal_code || "").trim(),
          lat: parseFloat(row.latitude) || 0,
          lng: parseFloat(row.longitude) || 0,
        },
        serviceCities: cityName ? [slugify(cityName)] : [],
        services: parseServices(row.subtypes || ""),
        is24Hour: checkIs24Hour(workingHours),
        licenseNumber: null,
        insured: false,
        yearsInBusiness: null,

        // Verification defaults
        verificationStatus: "unverified",
        reliabilityScore: 0,
        lastVerifiedAt: null,
        totalCallAttempts: 0,
        totalCallAnswered: 0,
        answerRate: 0,
        avgResponseTime: 0,

        listingTier: "free",

        // Google data
        googleRating: parseFloat(row.rating) || null,
        googleReviewCount: parseInt(row.reviews, 10) || null,
        googlePlaceId: placeId || null,
        googleId: (row.google_id || "").trim() || null,
        googleVerified: (row.verified || "").toUpperCase() === "TRUE",
        workingHours,
        category: (row.category || "").trim() || null,
        isAreaService: (row.area_service || "").toUpperCase() === "TRUE",
        photoUrl: (row.photo || "").trim() || null,
        logoUrl: (row.logo || "").trim() || null,
        description: (row.description || "").trim() || null,
        businessStatus: (row.business_status || "").trim() || null,
        bookingLink: (row.booking_appointment_link || "").trim() || null,

        // Social
        social: {
          facebook: (row.facebook || "").trim() || null,
          instagram: (row.instagram || "").trim() || null,
        },

        yelpRating: null,

        // Meta
        isActive:
          (row.business_status || "").toUpperCase() === "OPERATIONAL" ||
          (row.business_status || "").trim() === "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notes: "",
      },
    });
  }

  // Build city documents
  const cityDocs: { id: string; data: Record<string, unknown> }[] = [];

  for (const [slug, { name, count }] of cityMap) {
    const nearby = (NEARBY_MAP[name] || []).map((n) => slugify(n));
    cityDocs.push({
      id: slug,
      data: {
        name,
        state: "IL",
        county: COUNTY_MAP[name] || "Unknown",
        population: null,
        slug,
        metaTitle: `Emergency Plumbers in ${name}, IL — 24/7 Service`,
        metaDescription: `Find verified emergency plumbers in ${name}, Illinois. 24/7 service, reliability-scored, licensed & insured. Call now for immediate help.`,
        heroContent:
          HERO_CONTENT[name] ||
          `Find verified emergency plumbers in ${name}, Illinois. Our directory features plumbers who are tested for responsiveness — so you know they'll actually pick up when you call. Available 24/7 for burst pipes, water heater failures, sewer backups, and drain emergencies.`,
        isPublished: true,
        publishedAt: serverTimestamp(),
        plumberCount: count,
        nearbyCities: nearby,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Print summary
  // ---------------------------------------------------------------------------

  console.log("--- PLUMBER SUMMARY ---");
  for (const p of plumberDocs.slice(0, 5)) {
    const d = p.data as Record<string, unknown>;
    const addr = d.address as Record<string, unknown>;
    console.log(
      `  ${d.businessName} | ${d.phone} | ${addr.city}, ${addr.state} | Rating: ${d.googleRating || "n/a"} (${d.googleReviewCount || 0}) | 24/7: ${d.is24Hour} | Verified: ${d.googleVerified}`
    );
  }
  if (plumberDocs.length > 5) console.log(`  ... and ${plumberDocs.length - 5} more\n`);

  console.log("--- CITY SUMMARY ---");
  for (const c of cityDocs) {
    const d = c.data;
    console.log(`  ${d.name}, ${d.state} (${d.county}) — ${d.plumberCount} plumber(s) | slug: ${c.id}`);
  }

  if (DRY_RUN) {
    console.log(`\n=== DRY RUN COMPLETE ===`);
    console.log(`Would seed ${plumberDocs.length} plumbers and ${cityDocs.length} cities.`);
    process.exit(0);
  }

  // ---------------------------------------------------------------------------
  // Write to Firestore in batches
  // ---------------------------------------------------------------------------

  console.log("\nWriting to Firestore...");

  // Combine all writes, respecting 500 per batch
  const allWrites: { collection: string; id: string; data: Record<string, unknown> }[] = [
    ...plumberDocs.map((p) => ({ collection: "plumbers", id: p.id, data: p.data })),
    ...cityDocs.map((c) => ({ collection: "cities", id: c.id, data: c.data })),
  ];

  let written = 0;
  for (let i = 0; i < allWrites.length; i += BATCH_LIMIT) {
    const chunk = allWrites.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(doc(db, item.collection, item.id), item.data);
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  Batch committed: ${written}/${allWrites.length}`);
  }

  console.log(
    `\n✓ Seeded ${plumberDocs.length} plumbers across ${cityDocs.length} cities.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
