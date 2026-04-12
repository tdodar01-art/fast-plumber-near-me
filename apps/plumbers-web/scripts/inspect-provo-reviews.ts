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

async function main() {
  const db = initFirebase();
  const snap = await db.collection("plumbers").get();
  const provo = snap.docs.filter((d) => {
    const sc = d.data().serviceCities;
    return Array.isArray(sc) && sc.includes("provo");
  });

  console.log(`Provo plumbers: ${provo.length}\n`);

  for (const doc of provo) {
    const data = doc.data();
    const reviewSnap = await db.collection("reviews").where("plumberId", "==", doc.id).get();
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
