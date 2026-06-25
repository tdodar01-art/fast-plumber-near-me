import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from "firebase/firestore";
import { db, isConfigured } from "./firebase";
import type { Plumber, City, Lead, CachedReview, RatingSnapshot, ApiUsageRecord, ReviewSynthesis, PlumberReport } from "./types";
import { COLLECTIONS } from "@/config/plumbing-collections";
import { businessProfileSlug } from "./business-slug";

// --- Plumber helpers ---

export async function getPlumbersByCity(citySlug: string): Promise<Plumber[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, COLLECTIONS.businesses),
    where("serviceCities", "array-contains", citySlug),
    where("isActive", "==", true),
    orderBy("listingTier", "desc"),
    orderBy("reliabilityScore", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Plumber);
}

export async function getPlumberById(id: string): Promise<Plumber | null> {
  if (!isConfigured || !db) return null;
  const docRef = doc(db, COLLECTIONS.businesses, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Plumber;
}

export async function getActivePlumbersByState(state: string): Promise<Plumber[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, COLLECTIONS.businesses),
    where("address.state", "==", state),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Plumber);
}

export async function getAllPlumbers(): Promise<Plumber[]> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, COLLECTIONS.businesses), orderBy("businessName"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Plumber);
}

/**
 * Resolve plumbers for a city page from Firestore: a 20-mile radius sweep
 * keyed off the BUSINESS ADDRESS (address.lat/lng) only. Self-reported
 * service-area claims (serviceCities) are deliberately NOT an eligibility
 * path — a plumber appears on a city page iff their address is within
 * RADIUS_MILES of the city. Plumbers without geocoded coords never match.
 * Both the /emergency-plumbers/[state]/[city] page and the
 * /[service]/[state]/[city] page call this so they render from the same
 * source.
 *
 * Returns [] if Firestore is unconfigured, empty, or throws — callers should
 * fall back to getPlumbersNearCity() (static synthesized JSON) in that case.
 *
 * NOTE: must receive a cityCoord; without one we can't run the radius sweep.
 * The coord contract is enforced upstream in scripts/generate-cities-data.mjs
 * and scripts/gsc-prepend-queue.js.
 */
const RADIUS_MILES = 20;
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function resolvePlumbersForCity(
  state: string,
  citySlug: string,
  cityCoord: [number, number] | null,
): Promise<(Plumber & { distanceMiles?: number })[]> {
  if (!isConfigured || !db) return [];
  if (!cityCoord) return [];
  const [cityLat, cityLng] = cityCoord;
  const plumbers: (Plumber & { distanceMiles: number })[] = [];

  try {
    const statePlumbers = await getActivePlumbersByState(state);
    for (const p of statePlumbers) {
      if (!p.address?.lat || !p.address?.lng) continue;
      const dist = haversineMiles(cityLat, cityLng, p.address.lat, p.address.lng);
      if (dist <= RADIUS_MILES) {
        // Attach the canonical profile slug (Firestore doc id === placeId).
        // Same inputs the export script uses, so the slug matches the JSON
        // record getPlumberBySlug() resolves the profile link to.
        const slug = businessProfileSlug({
          name: p.businessName,
          city: p.address?.city,
          state: p.address?.state,
          placeId: p.id,
        });
        plumbers.push({ ...p, slug, distanceMiles: dist });
      }
    }
  } catch {
    return [];
  }
  return plumbers;
}

// --- City helpers ---

export async function getCityBySlug(slug: string): Promise<City | null> {
  if (!isConfigured || !db) return null;
  const docRef = doc(db, COLLECTIONS.cities, slug);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as City;
}

export async function getPublishedCities(): Promise<City[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, COLLECTIONS.cities),
    where("isPublished", "==", true),
    orderBy("name")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as City);
}

export async function getAllCities(): Promise<City[]> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, COLLECTIONS.cities), orderBy("name"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as City);
}

export async function createPlumber(data: Omit<Plumber, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, COLLECTIONS.businesses), data);
  return docRef.id;
}

export async function updatePlumber(id: string, data: Partial<Plumber>): Promise<void> {
  if (!isConfigured || !db) return;
  const { id: _id, ...fields } = data as Plumber;
  await updateDoc(doc(db, COLLECTIONS.businesses, id), fields);
}

export async function deletePlumber(id: string): Promise<void> {
  if (!isConfigured || !db) return;
  await deleteDoc(doc(db, COLLECTIONS.businesses, id));
}

// --- City helpers (write) ---

export async function createCity(id: string, data: Omit<City, "id">): Promise<void> {
  if (!isConfigured || !db) return;
  await setDoc(doc(db, COLLECTIONS.cities, id), data);
}

export async function updateCity(id: string, data: Partial<City>): Promise<void> {
  if (!isConfigured || !db) return;
  const { id: _id, ...fields } = data as City;
  await updateDoc(doc(db, COLLECTIONS.cities, id), fields);
}

export async function deleteCity(id: string): Promise<void> {
  if (!isConfigured || !db) return;
  await deleteDoc(doc(db, COLLECTIONS.cities, id));
}

// --- Lead helpers ---

export async function trackLead(lead: Omit<Lead, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, COLLECTIONS.leads), lead);
  return docRef.id;
}

export async function getLeads(max: number = 200): Promise<Lead[]> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, COLLECTIONS.leads), orderBy("createdAt", "desc"), firestoreLimit(max));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead);
}

// --- Reviews (caching) ---

export async function cacheReview(review: Omit<CachedReview, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  // Check for duplicate by googleReviewId
  const q = query(
    collection(db, COLLECTIONS.reviews),
    where("plumberId", "==", review.plumberId),
    where("googleReviewId", "==", review.googleReviewId),
    firestoreLimit(1)
  );
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;
  const docRef = await addDoc(collection(db, COLLECTIONS.reviews), review);
  return docRef.id;
}

export async function getReviewsForPlumber(plumberId: string): Promise<CachedReview[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, COLLECTIONS.reviews),
    where("plumberId", "==", plumberId),
    orderBy("cachedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CachedReview);
}

export async function getLatestReviewForPlumber(plumberId: string): Promise<CachedReview | null> {
  if (!isConfigured || !db) return null;
  const q = query(
    collection(db, COLLECTIONS.reviews),
    where("plumberId", "==", plumberId),
    orderBy("cachedAt", "desc"),
    firestoreLimit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CachedReview;
}

// --- Rating snapshots ---

export async function saveRatingSnapshot(snapshot: Omit<RatingSnapshot, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, COLLECTIONS.ratingSnapshots), snapshot);
  return docRef.id;
}

// --- API usage tracking ---

export async function trackApiUsage(type: "textSearch" | "placeDetails", count: number = 1): Promise<void> {
  if (!isConfigured || !db) return;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docRef = doc(db, COLLECTIONS.apiUsage, monthKey);
  const existing = await getDoc(docRef);

  const costPer1000 = type === "textSearch" ? 32 : 17;
  const addedCost = (count / 1000) * costPer1000;

  if (existing.exists()) {
    const data = existing.data();
    await updateDoc(docRef, {
      [`${type}Calls`]: (data[`${type}Calls`] || 0) + count,
      totalCalls: (data.totalCalls || 0) + count,
      estimatedCost: (data.estimatedCost || 0) + addedCost,
      lastUpdatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(docRef, {
      month: monthKey,
      year: now.getFullYear(),
      textSearchCalls: type === "textSearch" ? count : 0,
      placeDetailsCalls: type === "placeDetails" ? count : 0,
      totalCalls: count,
      estimatedCost: addedCost,
      lastUpdatedAt: Timestamp.now(),
    });
  }
}

export async function getApiUsage(month?: string): Promise<ApiUsageRecord | null> {
  if (!isConfigured || !db) return null;
  const now = new Date();
  const key = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docRef = doc(db, COLLECTIONS.apiUsage, key);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as ApiUsageRecord;
}

// --- Plumber synthesis ---

export async function updatePlumberSynthesis(plumberId: string, synthesis: ReviewSynthesis): Promise<void> {
  if (!isConfigured || !db) return;
  await updateDoc(doc(db, COLLECTIONS.businesses, plumberId), {
    reviewSynthesis: synthesis,
    updatedAt: Timestamp.now(),
  });
}

// --- Plumber reports ---

export async function submitPlumberReport(report: Omit<PlumberReport, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, "plumberReports"), report);
  return docRef.id;
}

export async function getPlumberReports(): Promise<PlumberReport[]> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, "plumberReports"), orderBy("createdAt", "desc"), firestoreLimit(200));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PlumberReport);
}

// --- Business submissions ---

export async function getBusinessSubmissions(): Promise<Array<{ id: string; [key: string]: unknown }>> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, COLLECTIONS.businessSubmissions), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteSubmission(id: string): Promise<void> {
  if (!isConfigured || !db) return;
  await deleteDoc(doc(db, COLLECTIONS.businessSubmissions, id));
}

// --- Contact submissions ---

export async function submitContactForm(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: Timestamp;
}): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, "contactSubmissions"), data);
  return docRef.id;
}

// Public business submission goes through /api/submit-business (writes to
// the businessSubmissions queue, geocodes the address) — never write
// directly to the businesses collection from the public site.
