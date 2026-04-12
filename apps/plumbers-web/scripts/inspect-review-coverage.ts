#!/usr/bin/env npx tsx
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length) return admin.firestore();
  const sa = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "service-account.json"), "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  const db = initFirebase();

  // Load all reviews, index by plumberId
  const reviewSnap = await db.collection("reviews").get();
  const reviewsByPlumber = new Map<string, number>();
  for (const doc of reviewSnap.docs) {
    const pid = doc.data().plumberId;
    if (pid) reviewsByPlumber.set(pid, (reviewsByPlumber.get(pid) || 0) + 1);
  }
  console.log(`Total reviews in reviews/: ${reviewSnap.size}`);
  console.log(`Plumbers with ≥1 review: ${reviewsByPlumber.size}\n`);

  // Load plumbers, group by city
  const plumberSnap = await db.collection("plumbers").get();
  const cityStats = new Map<string, { total: number; withReviews: number; totalReviews: number }>();

  for (const doc of plumberSnap.docs) {
    const data = doc.data();
    const sc = Array.isArray(data.serviceCities) ? data.serviceCities : [];
    const state = data.address?.state?.toLowerCase() || "";
    const cities = sc.length > 0 ? sc.map((s: string) => `${s}-${state}`) : [];
    const revCount = reviewsByPlumber.get(doc.id) || 0;

    for (const city of cities) {
      const existing = cityStats.get(city) || { total: 0, withReviews: 0, totalReviews: 0 };
      existing.total++;
      if (revCount >= 3) existing.withReviews++;
      existing.totalReviews += revCount;
      cityStats.set(city, existing);
    }
  }

  // Sort by withReviews desc, then totalReviews desc
  const sorted = [...cityStats.entries()]
    .filter(([, s]) => s.withReviews > 0)
    .sort((a, b) => b[1].withReviews - a[1].withReviews || b[1].totalReviews - a[1].totalReviews);

  console.log("Cities with scoreable plumbers (≥3 reviews):\n");
  console.log("City Slug".padEnd(30) + "Plumbers".padEnd(12) + "Scoreable".padEnd(12) + "Total Reviews");
  console.log("-".repeat(66));
  for (const [slug, stats] of sorted.slice(0, 25)) {
    console.log(
      slug.padEnd(30) +
      String(stats.total).padEnd(12) +
      String(stats.withReviews).padEnd(12) +
      String(stats.totalReviews)
    );
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
