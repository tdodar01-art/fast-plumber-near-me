#!/usr/bin/env node

/**
 * Upload city data to Firestore from the TypeScript city data files.
 * Parses the TS files to extract city info and uploads to 'cities' collection.
 *
 * Usage: node scripts/upload-cities-to-firestore.js
 */

const fs = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "service-account.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.log("service-account.json not found — skipping.");
  process.exit(0);
}

let admin;
try {
  admin = require("firebase-admin");
} catch {
  console.error("firebase-admin not installed. Run: npm install firebase-admin");
  process.exit(1);
}

// Initialize Firebase if not already
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Parse city data from TypeScript source files
// ---------------------------------------------------------------------------

function parseCitiesFromTS() {
  const cities = [];

  // Read both city data files
  const files = [
    path.join(__dirname, "..", "src", "lib", "cities-data.ts"),
    path.join(__dirname, "..", "src", "lib", "cities-generated.ts"),
  ];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");

    // Match pattern: "city-slug": { name: "City Name", state: "XX", county: "County", ...}
    const cityRegex = /"([a-z0-9-]+)":\s*\{\s*name:\s*"([^"]+)",\s*state:\s*"([^"]+)",\s*county:\s*"([^"]+)",\s*heroContent:\s*"([^"]*(?:\\.[^"]*)*)",\s*nearbyCities:\s*\[([^\]]*)\]/g;

    let match;
    while ((match = cityRegex.exec(content)) !== null) {
      const [, slug, name, state, county, heroContent, nearbyCitiesRaw] = match;

      // Parse nearby city slugs
      const nearbyMatches = [...nearbyCitiesRaw.matchAll(/nc\("[^"]+","([^"]+)","([^"]+)"\)/g)];
      const nearbyCities = nearbyMatches.map((m) => `${m[1]}-${m[2]}`);

      cities.push({ slug, name, state, county, heroContent, nearbyCities });
    }
  }

  return cities;
}

// ---------------------------------------------------------------------------
// Get plumber counts per city from the synthesized data
// ---------------------------------------------------------------------------

function getPlumberCountsByCity() {
  const counts = {};
  const synthPath = path.join(__dirname, "..", "data", "synthesized", "plumbers-synthesized.json");

  if (!fs.existsSync(synthPath)) return counts;

  const data = JSON.parse(fs.readFileSync(synthPath, "utf-8"));
  for (const p of data.plumbers || []) {
    if (p.city) {
      const citySlug = p.city.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      counts[citySlug] = (counts[citySlug] || 0) + 1;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cities = parseCitiesFromTS();
  const plumberCounts = getPlumberCountsByCity();

  console.log(`\nCities Firestore Uploader`);
  console.log(`  Cities found: ${cities.length}`);
  console.log();

  let created = 0;
  let updated = 0;
  let failed = 0;

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const city of cities) {
    const docId = `${city.slug}-${city.state.toLowerCase()}`;
    const docRef = db.collection("cities").doc(docId);

    const stateNames = {
      AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
      CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
      HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",
      KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",
      MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",
      NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",
      NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
      OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
      SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
      VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
      DC:"District of Columbia"
    };

    const stateName = stateNames[city.state] || city.state;
    const plumberCount = plumberCounts[city.slug] || 0;

    const data = {
      name: city.name,
      state: city.state,
      county: city.county,
      population: null,
      slug: docId,
      metaTitle: `Emergency Plumber in ${city.name}, ${stateName} | Fast Plumber Near Me`,
      metaDescription: `Find trusted emergency plumbers in ${city.name}, ${city.state}. 24/7 service for burst pipes, water heaters, and drain emergencies.`,
      heroContent: city.heroContent,
      isPublished: true,
      plumberCount,
      nearbyCities: city.nearbyCities,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const existing = await docRef.get();
      if (existing.exists) {
        batch.set(docRef, data, { merge: true });
        updated++;
      } else {
        batch.set(docRef, {
          ...data,
          publishedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
      }

      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`  Committed batch (${created + updated} so far)`);
        batch = db.batch();
        batchCount = 0;
      }
    } catch (err) {
      console.error(`  Failed: ${city.name}, ${city.state} — ${err.message}`);
      failed++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Cities upload complete`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log();
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
