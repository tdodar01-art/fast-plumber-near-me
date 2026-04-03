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

// --- Plumber helpers ---

export async function getPlumbersByCity(citySlug: string): Promise<Plumber[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, "plumbers"),
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
  const docRef = doc(db, "plumbers", id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Plumber;
}

export async function getActivePlumbersByState(state: string): Promise<Plumber[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, "plumbers"),
    where("address.state", "==", state),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Plumber);
}

export async function getAllPlumbers(): Promise<Plumber[]> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, "plumbers"), orderBy("businessName"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Plumber);
}

// --- City helpers ---

export async function getCityBySlug(slug: string): Promise<City | null> {
  if (!isConfigured || !db) return null;
  const docRef = doc(db, "cities", slug);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as City;
}

export async function getPublishedCities(): Promise<City[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, "cities"),
    where("isPublished", "==", true),
    orderBy("name")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as City);
}

export async function getAllCities(): Promise<City[]> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, "cities"), orderBy("name"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as City);
}

export async function createPlumber(data: Omit<Plumber, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, "plumbers"), data);
  return docRef.id;
}

export async function updatePlumber(id: string, data: Partial<Plumber>): Promise<void> {
  if (!isConfigured || !db) return;
  const { id: _id, ...fields } = data as Plumber;
  await updateDoc(doc(db, "plumbers", id), fields);
}

export async function deletePlumber(id: string): Promise<void> {
  if (!isConfigured || !db) return;
  await deleteDoc(doc(db, "plumbers", id));
}

// --- City helpers (write) ---

export async function createCity(id: string, data: Omit<City, "id">): Promise<void> {
  if (!isConfigured || !db) return;
  await setDoc(doc(db, "cities", id), data);
}

export async function updateCity(id: string, data: Partial<City>): Promise<void> {
  if (!isConfigured || !db) return;
  const { id: _id, ...fields } = data as City;
  await updateDoc(doc(db, "cities", id), fields);
}

export async function deleteCity(id: string): Promise<void> {
  if (!isConfigured || !db) return;
  await deleteDoc(doc(db, "cities", id));
}

// --- Lead helpers ---

export async function trackLead(lead: Omit<Lead, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, "leads"), lead);
  return docRef.id;
}

export async function getLeads(max: number = 200): Promise<Lead[]> {
  if (!isConfigured || !db) return [];
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"), firestoreLimit(max));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead);
}

// --- Reviews (caching) ---

export async function cacheReview(review: Omit<CachedReview, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  // Check for duplicate by googleReviewId
  const q = query(
    collection(db, "reviews"),
    where("plumberId", "==", review.plumberId),
    where("googleReviewId", "==", review.googleReviewId),
    firestoreLimit(1)
  );
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;
  const docRef = await addDoc(collection(db, "reviews"), review);
  return docRef.id;
}

export async function getReviewsForPlumber(plumberId: string): Promise<CachedReview[]> {
  if (!isConfigured || !db) return [];
  const q = query(
    collection(db, "reviews"),
    where("plumberId", "==", plumberId),
    orderBy("cachedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CachedReview);
}

export async function getLatestReviewForPlumber(plumberId: string): Promise<CachedReview | null> {
  if (!isConfigured || !db) return null;
  const q = query(
    collection(db, "reviews"),
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
  const docRef = await addDoc(collection(db, "ratingSnapshots"), snapshot);
  return docRef.id;
}

// --- API usage tracking ---

export async function trackApiUsage(type: "textSearch" | "placeDetails", count: number = 1): Promise<void> {
  if (!isConfigured || !db) return;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docRef = doc(db, "apiUsage", monthKey);
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
  const docRef = doc(db, "apiUsage", key);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as ApiUsageRecord;
}

// --- Plumber synthesis ---

export async function updatePlumberSynthesis(plumberId: string, synthesis: ReviewSynthesis): Promise<void> {
  if (!isConfigured || !db) return;
  await updateDoc(doc(db, "plumbers", plumberId), {
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
  const q = query(collection(db, "businessSubmissions"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteSubmission(id: string): Promise<void> {
  if (!isConfigured || !db) return;
  await deleteDoc(doc(db, "businessSubmissions", id));
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

// --- Business submission ---

export async function submitBusiness(data: {
  businessName: string;
  phone: string;
  email: string;
  website: string;
  serviceCities: string[];
  services: string[];
  is24Hour: boolean;
  licenseNumber: string;
}): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, "plumbers"), {
    ...data,
    ownerName: "",
    address: { street: "", city: "", state: "", zip: "", lat: 0, lng: 0 },
    verificationStatus: "unverified",
    reliabilityScore: 0,
    lastVerifiedAt: null,
    totalCallAttempts: 0,
    totalCallAnswered: 0,
    answerRate: 0,
    avgResponseTime: 0,
    listingTier: "free",
    googleRating: null,
    googleReviewCount: null,
    yelpRating: null,
    insured: false,
    yearsInBusiness: null,
    isActive: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    notes: "Submitted via public form — pending review",
  });
  return docRef.id;
}
