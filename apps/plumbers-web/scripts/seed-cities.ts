/**
 * Seed script for city data.
 *
 * Usage:
 *   npx ts-node --esm scripts/seed-cities.ts
 *
 * Prerequisites:
 *   - Set up Firebase credentials in .env.local
 *   - Install ts-node: npm install -D ts-node
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";

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

const cities = [
  {
    id: "crystal-lake-il",
    name: "Crystal Lake",
    state: "IL",
    county: "McHenry",
    population: 40743,
    slug: "crystal-lake-il",
    metaTitle: "Emergency Plumbers in Crystal Lake, IL — 24/7 Verified",
    metaDescription:
      "Find verified 24/7 emergency plumbers in Crystal Lake, IL. AI-verified for responsiveness. Burst pipes, water heaters, sewers & drains. Call now.",
    heroContent:
      "Crystal Lake is the largest city in McHenry County, with older homes and aging plumbing infrastructure that can lead to emergencies — especially during harsh Illinois winters. Frozen pipes, water heater failures, and sewer backups are common issues for Crystal Lake homeowners.",
    isPublished: true,
    plumberCount: 3,
    nearbyCities: ["mchenry-il", "algonquin-il", "lake-in-the-hills-il", "cary-il", "woodstock-il"],
  },
  {
    id: "mchenry-il",
    name: "McHenry",
    state: "IL",
    county: "McHenry",
    population: 26992,
    slug: "mchenry-il",
    metaTitle: "Emergency Plumbers in McHenry, IL — 24/7 Verified",
    metaDescription:
      "Find verified 24/7 emergency plumbers in McHenry, IL. AI-verified for responsiveness. Burst pipes, water heaters, sewers & drains. Call now.",
    heroContent:
      "McHenry residents know that plumbing emergencies don't wait for business hours. With the Fox River running through town and seasonal temperature swings, pipes can freeze, burst, or back up at any time.",
    isPublished: true,
    plumberCount: 2,
    nearbyCities: ["crystal-lake-il", "woodstock-il", "huntley-il", "lake-in-the-hills-il"],
  },
  {
    id: "algonquin-il",
    name: "Algonquin",
    state: "IL",
    county: "McHenry",
    population: 30046,
    slug: "algonquin-il",
    metaTitle: "Emergency Plumbers in Algonquin, IL — 24/7 Verified",
    metaDescription:
      "Find verified 24/7 emergency plumbers in Algonquin, IL. AI-verified for responsiveness. Burst pipes, water heaters, sewers & drains. Call now.",
    heroContent:
      "Algonquin is a rapidly growing community straddling McHenry and Kane counties. With a mix of newer construction and established neighborhoods, plumbing emergencies range from slab leaks to water heater failures.",
    isPublished: true,
    plumberCount: 2,
    nearbyCities: ["crystal-lake-il", "lake-in-the-hills-il", "carpentersville-il", "huntley-il"],
  },
  {
    id: "lake-in-the-hills-il",
    name: "Lake in the Hills",
    state: "IL",
    county: "McHenry",
    population: 28965,
    slug: "lake-in-the-hills-il",
    metaTitle: "Emergency Plumbers in Lake in the Hills, IL — 24/7 Verified",
    metaDescription:
      "Find verified 24/7 emergency plumbers in Lake in the Hills, IL. AI-verified for responsiveness. Call now.",
    heroContent:
      "Lake in the Hills is a vibrant community in McHenry County with many homes built in the 1990s and 2000s. As these homes age, plumbing issues become more common.",
    isPublished: true,
    plumberCount: 2,
    nearbyCities: ["crystal-lake-il", "algonquin-il", "huntley-il", "cary-il"],
  },
  {
    id: "huntley-il",
    name: "Huntley",
    state: "IL",
    county: "McHenry",
    population: 27740,
    slug: "huntley-il",
    metaTitle: "Emergency Plumbers in Huntley, IL — 24/7 Verified",
    metaDescription:
      "Find verified 24/7 emergency plumbers in Huntley, IL. AI-verified for responsiveness. Call now.",
    heroContent:
      "Huntley has been one of the fastest-growing communities in the Chicago suburbs. With rapid development comes a need for reliable emergency plumbing services.",
    isPublished: true,
    plumberCount: 2,
    nearbyCities: ["crystal-lake-il", "lake-in-the-hills-il", "algonquin-il", "woodstock-il"],
  },
];

async function seed() {
  console.log("Seeding cities...");

  for (const city of cities) {
    const { id, ...data } = city;
    await setDoc(doc(db, "cities", id), {
      ...data,
      publishedAt: data.isPublished ? Timestamp.now() : null,
    });
    console.log(`  ✓ ${data.name}, ${data.state}`);
  }

  console.log(`\nSeeded ${cities.length} cities.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
