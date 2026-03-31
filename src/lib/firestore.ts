import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db, isConfigured } from "./firebase";
import type { Plumber, City, Lead } from "./types";

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

// --- Lead helpers ---

export async function trackLead(lead: Omit<Lead, "id">): Promise<string> {
  if (!isConfigured || !db) return "";
  const docRef = await addDoc(collection(db, "leads"), lead);
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
