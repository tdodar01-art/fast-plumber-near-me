/**
 * Geographic utilities for distance calculation and service radius filtering.
 */

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Haversine formula — calculates distance between two lat/lng points in miles.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distance-based weight for sorting.
 * Closer plumbers get higher weight (multiplied by quality score).
 */
export function getDistanceWeight(distanceMiles: number): number {
  if (distanceMiles <= 5) return 1.0;
  if (distanceMiles <= 10) return 0.95;
  if (distanceMiles <= 15) return 0.85;
  if (distanceMiles <= 20) return 0.70;
  return 0.5; // shouldn't happen with 20-mile filter, but just in case
}

/**
 * Human-readable distance label for PlumberCard display.
 */
export function getDistanceLabel(distanceMiles: number, cityName?: string): {
  text: string;
  color: "default" | "amber";
} {
  if (distanceMiles <= 5) {
    return { text: cityName ? `In ${cityName}` : `${Math.round(distanceMiles)} mi away`, color: "default" };
  }
  if (distanceMiles <= 10) {
    return { text: `${Math.round(distanceMiles)} mi away`, color: "default" };
  }
  if (distanceMiles <= 15) {
    return { text: `${Math.round(distanceMiles)} mi away — Serves your area`, color: "default" };
  }
  return { text: `${Math.round(distanceMiles)} mi away — Edge of service area`, color: "amber" };
}

export interface PlumberWithDistance {
  plumberId: string;
  distanceMiles: number;
}

/**
 * Filter plumbers within a radius of a city.
 * Returns plumber IDs with their distance attached.
 */
export function getPlumbersInRadius(
  cityLat: number,
  cityLng: number,
  plumbers: Array<{ id: string; address: { lat: number; lng: number } }>,
  radiusMiles: number = 20
): PlumberWithDistance[] {
  const results: PlumberWithDistance[] = [];

  for (const p of plumbers) {
    if (!p.address.lat || !p.address.lng) continue;
    const dist = calculateDistance(cityLat, cityLng, p.address.lat, p.address.lng);
    if (dist <= radiusMiles) {
      results.push({ plumberId: p.id, distanceMiles: dist });
    }
  }

  return results.sort((a, b) => a.distanceMiles - b.distanceMiles);
}
