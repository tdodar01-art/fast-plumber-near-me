/**
 * Seed script for plumber data.
 *
 * Usage:
 *   npx ts-node --esm scripts/seed-plumbers.ts
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

const plumbers = [
  {
    id: "crystal-lake-emergency-plumbing",
    businessName: "Crystal Lake Emergency Plumbing",
    ownerName: "John Smith",
    phone: "(815) 555-0101",
    website: "https://crystallakeplumbing.example.com",
    email: "john@crystallakeplumbing.com",
    address: {
      street: "100 W Virginia St",
      city: "Crystal Lake",
      state: "IL",
      zip: "60014",
      lat: 42.2411,
      lng: -88.3162,
    },
    serviceCities: ["crystal-lake-il", "cary-il", "lake-in-the-hills-il", "algonquin-il"],
    services: ["emergency", "water-heater", "sewer", "drain", "pipe-repair"],
    is24Hour: true,
    licenseNumber: "055-012345",
    insured: true,
    yearsInBusiness: 15,
    verificationStatus: "verified",
    reliabilityScore: 94,
    totalCallAttempts: 12,
    totalCallAnswered: 11,
    answerRate: 92,
    avgResponseTime: 8,
    listingTier: "featured",
    googleRating: 4.8,
    googleReviewCount: 127,
    yelpRating: 4.5,
    isActive: true,
    notes: "Top performer in Crystal Lake area",
  },
  {
    id: "fox-valley-plumbing-drain",
    businessName: "Fox Valley Plumbing & Drain",
    ownerName: "Mike Johnson",
    phone: "(815) 555-0102",
    website: "https://foxvalleyplumbing.example.com",
    email: "mike@foxvalleyplumbing.com",
    address: {
      street: "250 N Green St",
      city: "McHenry",
      state: "IL",
      zip: "60050",
      lat: 42.3334,
      lng: -88.2668,
    },
    serviceCities: [
      "mchenry-il",
      "crystal-lake-il",
      "woodstock-il",
      "huntley-il",
      "lake-in-the-hills-il",
    ],
    services: ["emergency", "drain", "sewer", "leak-detection"],
    is24Hour: true,
    licenseNumber: "055-067890",
    insured: true,
    yearsInBusiness: 8,
    verificationStatus: "verified",
    reliabilityScore: 87,
    totalCallAttempts: 8,
    totalCallAnswered: 7,
    answerRate: 88,
    avgResponseTime: 12,
    listingTier: "premium",
    googleRating: 4.6,
    googleReviewCount: 89,
    yelpRating: 4.0,
    isActive: true,
    notes: "Serves wide area across McHenry County",
  },
  {
    id: "rapid-response-plumbing",
    businessName: "Rapid Response Plumbing",
    ownerName: "Dave Williams",
    phone: "(847) 555-0103",
    website: null,
    email: "dave@rapidresponseplumbing.com",
    address: {
      street: "500 E Algonquin Rd",
      city: "Algonquin",
      state: "IL",
      zip: "60102",
      lat: 42.1656,
      lng: -88.2943,
    },
    serviceCities: [
      "algonquin-il",
      "carpentersville-il",
      "lake-in-the-hills-il",
      "huntley-il",
    ],
    services: ["emergency", "water-heater", "drain", "toilet-repair"],
    is24Hour: false,
    licenseNumber: null,
    insured: true,
    yearsInBusiness: 5,
    verificationStatus: "unverified",
    reliabilityScore: 0,
    totalCallAttempts: 0,
    totalCallAnswered: 0,
    answerRate: 0,
    avgResponseTime: 0,
    listingTier: "free",
    googleRating: 4.2,
    googleReviewCount: 34,
    yelpRating: null,
    isActive: true,
    notes: "Submitted via public form",
  },
  {
    id: "all-hours-plumbing",
    businessName: "All Hours Plumbing Co.",
    ownerName: "Sarah Chen",
    phone: "(815) 555-0104",
    website: "https://allhoursplumbing.example.com",
    email: "sarah@allhoursplumbing.com",
    address: {
      street: "325 S Route 31",
      city: "Crystal Lake",
      state: "IL",
      zip: "60014",
      lat: 42.2335,
      lng: -88.3284,
    },
    serviceCities: [
      "crystal-lake-il",
      "mchenry-il",
      "woodstock-il",
      "cary-il",
      "algonquin-il",
      "lake-in-the-hills-il",
      "huntley-il",
    ],
    services: ["emergency", "water-heater", "sewer", "drain", "gas-line", "pipe-repair"],
    is24Hour: true,
    licenseNumber: "055-111222",
    insured: true,
    yearsInBusiness: 20,
    verificationStatus: "verified",
    reliabilityScore: 91,
    totalCallAttempts: 10,
    totalCallAnswered: 9,
    answerRate: 90,
    avgResponseTime: 10,
    listingTier: "premium",
    googleRating: 4.7,
    googleReviewCount: 203,
    yelpRating: 4.5,
    isActive: true,
    notes: "20 year veteran, serves wide area",
  },
  {
    id: "elgin-emergency-plumbers",
    businessName: "Elgin Emergency Plumbers",
    ownerName: "Tom Martinez",
    phone: "(847) 555-0105",
    website: "https://elginemergency.example.com",
    email: "tom@elginemergency.com",
    address: {
      street: "100 N State St",
      city: "Elgin",
      state: "IL",
      zip: "60120",
      lat: 42.0354,
      lng: -88.2826,
    },
    serviceCities: [
      "elgin-il",
      "south-elgin-il",
      "carpentersville-il",
      "st-charles-il",
      "schaumburg-il",
    ],
    services: ["emergency", "water-heater", "sewer", "drain", "gas-line"],
    is24Hour: true,
    licenseNumber: "055-333444",
    insured: true,
    yearsInBusiness: 12,
    verificationStatus: "verified",
    reliabilityScore: 88,
    totalCallAttempts: 9,
    totalCallAnswered: 8,
    answerRate: 89,
    avgResponseTime: 11,
    listingTier: "featured",
    googleRating: 4.5,
    googleReviewCount: 156,
    yelpRating: 4.0,
    isActive: true,
    notes: "Covers Elgin/Kane County area",
  },
];

async function seed() {
  console.log("Seeding plumbers...");

  for (const plumber of plumbers) {
    const { id, ...data } = plumber;
    await setDoc(doc(db, "plumbers", id), {
      ...data,
      lastVerifiedAt: data.verificationStatus === "verified" ? Timestamp.now() : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`  ✓ ${data.businessName}`);
  }

  console.log(`\nSeeded ${plumbers.length} plumbers.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
