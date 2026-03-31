/**
 * Fetch emergency plumbers from Google Places API and upsert to Firestore.
 *
 * Usage:
 *   npx ts-node scripts/fetch-plumbers.ts --cities naperville-il aurora-il --dry-run
 *   npx ts-node scripts/fetch-plumbers.ts --cities naperville-il
 *   npx ts-node scripts/fetch-plumbers.ts --state IL --dry-run
 *
 * Prerequisites:
 *   - GOOGLE_PLACES_API_KEY in .env.local
 *   - Firebase credentials in .env.local
 */

import * as fs from "fs";
import * as path from "path";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const RATE_LIMIT_MS = 200; // 200ms between API calls

// Parse args
function getArg(flag: string): string[] {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return [];
  const values: string[] = [];
  for (let i = idx + 1; i < process.argv.length; i++) {
    if (process.argv[i].startsWith("--")) break;
    values.push(process.argv[i]);
  }
  return values;
}

const argCities = getArg("--cities");
const argState = getArg("--state")[0] || "";

// Load .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("ERROR: .env.local not found");
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

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error("ERROR: GOOGLE_PLACES_API_KEY not set in .env.local");
  process.exit(1);
}

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
// State name lookup
// ---------------------------------------------------------------------------

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

// ---------------------------------------------------------------------------
// Google Places API helpers
// ---------------------------------------------------------------------------

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  opening_hours?: { weekday_text?: string[]; periods?: unknown[] };
  business_status?: string;
  types?: string[];
  photos?: { photo_reference: string }[];
}

async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", GOOGLE_API_KEY!);
  url.searchParams.set("type", "plumber");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error(`  Places API error: ${data.status} — ${data.error_message || ""}`);
    return [];
  }

  return data.results || [];
}

async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", GOOGLE_API_KEY!);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,geometry,rating,user_ratings_total,formatted_phone_number,international_phone_number,website,opening_hours,business_status,types,photos"
  );

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    console.error(`  Place details error for ${placeId}: ${data.status}`);
    return null;
  }

  return data.result || null;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseIs24Hour(hours?: string[]): boolean {
  if (!hours) return false;
  return hours.some((h) => h.toLowerCase().includes("open 24 hours"));
}

function parseCityState(address: string): { city: string; state: string } {
  // Try to extract city and state from formatted address like "123 Main St, Naperville, IL 60540, USA"
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const city = parts[parts.length - 3];
    const stateZip = parts[parts.length - 2];
    const stateMatch = stateZip.match(/^([A-Z]{2})\s/);
    if (stateMatch) {
      return { city, state: stateMatch[1] };
    }
  }
  return { city: "", state: "" };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== FETCHING PLUMBERS ===\n");

  // Build list of cities to search
  type CityQuery = { slug: string; city: string; state: string };
  const citiesToSearch: CityQuery[] = [];

  if (argCities.length > 0) {
    for (const slug of argCities) {
      // Parse slug like "naperville-il"
      const match = slug.match(/^(.+)-([a-z]{2})$/);
      if (match) {
        const cityName = match[1].split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
        const state = match[2].toUpperCase();
        citiesToSearch.push({ slug, city: cityName, state });
      } else {
        console.warn(`  Skipping invalid slug: ${slug}`);
      }
    }
  } else if (argState) {
    const state = argState.toUpperCase();
    const stateName = STATE_NAMES[state];
    if (!stateName) {
      console.error(`Unknown state: ${state}`);
      process.exit(1);
    }
    console.log(`Fetching all cities for state: ${stateName} (${state})`);
    console.log("NOTE: This will use the state-level search. For specific cities, use --cities.\n");
    citiesToSearch.push({
      slug: `state-${state.toLowerCase()}`,
      city: stateName,
      state,
    });
  } else {
    console.error("Usage: --cities <slug1> <slug2> ... OR --state <XX>");
    process.exit(1);
  }

  let totalFetched = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const cityQuery of citiesToSearch) {
    const query = `emergency plumber in ${cityQuery.city}, ${cityQuery.state}`;
    console.log(`\nSearching: "${query}"`);

    const results = await searchPlaces(query);
    console.log(`  Found ${results.length} results`);

    for (const result of results) {
      await sleep(RATE_LIMIT_MS);

      // Get details for phone number and hours
      const details = await getPlaceDetails(result.place_id);
      if (!details) continue;

      const phone = details.formatted_phone_number || details.international_phone_number || "";
      if (!phone) {
        console.log(`  Skipping ${details.name} — no phone number`);
        totalSkipped++;
        continue;
      }

      totalFetched++;

      const { city, state } = parseCityState(details.formatted_address);
      const citySlug = city ? `${slugify(city)}-${state.toLowerCase()}` : cityQuery.slug;

      const plumberData = {
        businessName: details.name,
        ownerName: "",
        phone: formatPhone(phone),
        website: details.website || null,
        email: null,
        address: {
          full: details.formatted_address,
          street: "",
          city: city || cityQuery.city,
          state: state || cityQuery.state,
          zip: "",
          lat: details.geometry?.location?.lat || 0,
          lng: details.geometry?.location?.lng || 0,
        },
        serviceCities: [citySlug],
        services: (details.types || [])
          .filter((t: string) => !["point_of_interest", "establishment"].includes(t))
          .map((t: string) => t.replace(/_/g, "-")),
        is24Hour: parseIs24Hour(details.opening_hours?.weekday_text),
        licenseNumber: null,
        insured: false,
        yearsInBusiness: null,
        verificationStatus: "unverified",
        reliabilityScore: 0,
        lastVerifiedAt: null,
        totalCallAttempts: 0,
        totalCallAnswered: 0,
        answerRate: 0,
        avgResponseTime: 0,
        listingTier: "free",
        googleRating: details.rating || null,
        googleReviewCount: details.user_ratings_total || null,
        googlePlaceId: details.place_id,
        googleId: null,
        googleVerified: true,
        workingHours: null,
        category: "Plumber",
        isAreaService: false,
        photoUrl: details.photos?.[0]
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${details.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
          : null,
        logoUrl: null,
        description: null,
        businessStatus: details.business_status || "OPERATIONAL",
        bookingLink: null,
        social: { facebook: null, instagram: null },
        yelpRating: null,
        isActive: details.business_status === "OPERATIONAL" || !details.business_status,
        updatedAt: serverTimestamp(),
        notes: "Imported from Google Places API",
      };

      if (DRY_RUN) {
        console.log(`  [DRY] Would upsert: ${details.name} | ${formatPhone(phone)} | ${city}, ${state}`);
        continue;
      }

      // Check if exists
      const docRef = doc(db, "plumbers", details.place_id);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        // Update only certain fields
        await setDoc(docRef, {
          ...existing.data(),
          googleRating: plumberData.googleRating,
          googleReviewCount: plumberData.googleReviewCount,
          businessStatus: plumberData.businessStatus,
          isActive: plumberData.isActive,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        totalUpdated++;
        console.log(`  Updated: ${details.name}`);
      } else {
        await setDoc(docRef, {
          ...plumberData,
          createdAt: serverTimestamp(),
        });
        totalNew++;
        console.log(`  Created: ${details.name}`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fetched: ${totalFetched} plumbers`);
  console.log(`New: ${totalNew}`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Skipped (no phone): ${totalSkipped}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
