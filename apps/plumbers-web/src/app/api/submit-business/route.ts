import { NextRequest, NextResponse } from "next/server";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { checkRateLimit, checkOrigin } from "@/lib/rate-limit";
import { getCityCoordBySlug } from "@/lib/city-coords";

function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface GeocodeResult {
  lat: number;
  lng: number;
  geocodeStatus: "geocoded" | "city-centroid" | "failed";
}

/**
 * Resolve coords for the submitted business address. Listing eligibility is
 * address-radius based, so a submission without coords can never render on a
 * city page. Google Geocoding first; falls back to the city centroid from
 * city-coords.ts so the listing is at least placeable until the exact
 * address is geocoded.
 */
async function geocodeAddress(address: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<GeocodeResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (key) {
    try {
      const q = encodeURIComponent(
        `${address.street}, ${address.city}, ${address.state} ${address.zip}`
      );
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`
      );
      const json = await res.json();
      const loc = json?.results?.[0]?.geometry?.location;
      if (json?.status === "OK" && typeof loc?.lat === "number" && typeof loc?.lng === "number") {
        return { lat: loc.lat, lng: loc.lng, geocodeStatus: "geocoded" };
      }
    } catch {
      // fall through to centroid fallback
    }
  }
  const centroid = getCityCoordBySlug(address.state, slugifyCity(address.city));
  if (centroid) {
    return { lat: centroid[0], lng: centroid[1], geocodeStatus: "city-centroid" };
  }
  return { lat: 0, lng: 0, geocodeStatus: "failed" };
}

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;
  const originBlocked = checkOrigin(request);
  if (originBlocked) return originBlocked;

  try {
    const data = await request.json();

    const { businessName, phone, email, address } = data;
    if (!businessName || !phone || !email) {
      return NextResponse.json(
        { error: "Business name, phone, and email are required" },
        { status: 400 }
      );
    }
    if (!address?.street || !address?.city || !address?.state || !address?.zip) {
      return NextResponse.json(
        { error: "Business address (street, city, state, zip) is required" },
        { status: 400 }
      );
    }

    const cleanAddress = {
      street: String(address.street).trim(),
      city: String(address.city).trim(),
      state: String(address.state).trim().toUpperCase().slice(0, 2),
      zip: String(address.zip).trim(),
    };
    const geo = await geocodeAddress(cleanAddress);

    if (db) {
      await addDoc(collection(db, "businessSubmissions"), {
        businessName: String(businessName).trim(),
        phone: String(phone).trim(),
        email: String(email).trim(),
        website: data.website ? String(data.website).trim() : "",
        address: { ...cleanAddress, lat: geo.lat, lng: geo.lng },
        geocodeStatus: geo.geocodeStatus,
        services: Array.isArray(data.services) ? data.services.map(String) : [],
        is24Hour: data.is24Hour === true,
        licenseNumber: data.licenseNumber ? String(data.licenseNumber).trim() : "",
        createdAt: serverTimestamp(),
        status: "pending",
      });
    }

    return NextResponse.json({ success: true, message: "Business submitted for review" });
  } catch {
    return NextResponse.json({ error: "Failed to submit business" }, { status: 500 });
  }
}
