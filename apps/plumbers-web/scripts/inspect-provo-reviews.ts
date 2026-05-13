#!/usr/bin/env npx tsx
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
const { COLLECTIONS } = require("./config/plumbing-directory.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length) return admin.firestore();
  const sa = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "service-account.json"), "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  return admin.firestore();
}

async function main() {
  const db = initFirebase();
  const snap = await db.collection(COLLECTIONS.businesses).get();
  const provo = snap.docs.filter((d) => {
    const sc = d.data().serviceCities;
    return Array.isArray(sc) && sc.includes("provo");
  });

  console.log(`Provo plumbers: ${provo.length}\n`);

  for (const doc of provo) {
    const data = doc.data();
    const reviewSnap = await db.collection(COLLECTIONS.reviews).where("plumberId", "==", doc.id).get();
    const googleRating = data.googleRating ?? data.rating ?? "?";
    const googleReviewCount = data.googleReviewCount ?? data.reviewCount ?? "?";
    console.log(`${data.businessName}`);
    console.log(`  id: ${doc.id}`);
    console.log(`  Google rating: ${googleRating} (${googleReviewCount} reviews on Google)`);
    console.log(`  reviews in reviews/: ${reviewSnap.size}`);
    console.log();
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
