/**
 * Expand the nearby cities list for experiment variants.
 *
 * When an experiment requests more nearby cities than exist in the hardcoded
 * nearbyCities array, this computes additional cities by proximity using
 * city-coords data.
 */

import type { NearbyCityRef } from "@/lib/cities-data";
import { getCityCoords } from "@/lib/city-coords";
import { calculateDistance } from "@/lib/geo";

/**
 * Get up to `count` nearby cities for a page.
 *
 * 1. Starts with the hardcoded nearbyCities list from cities-data
 * 2. If count > hardcoded length, augments with proximity-computed cities
 * 3. Returns up to `count` total
 */
export function getExpandedNearbyCities(
  stateSlug: string,
  citySlug: string,
  hardcodedNearbyCities: NearbyCityRef[],
  count: number
): NearbyCityRef[] {
  // If hardcoded list is sufficient, just slice
  if (hardcodedNearbyCities.length >= count) {
    return hardcodedNearbyCities.slice(0, count);
  }

  // Need more — compute by proximity
  const allCoords = getCityCoords();
  const thisCity = allCoords.find(
    (c) => c.stateSlug === stateSlug && c.citySlug === citySlug
  );
  if (!thisCity) {
    // No coordinates for this city — return what we have
    return hardcodedNearbyCities;
  }

  // Set of slugs already in the hardcoded list
  const existing = new Set(
    hardcodedNearbyCities.map((nc) => `${nc.stateSlug}/${nc.citySlug}`)
  );
  existing.add(`${stateSlug}/${citySlug}`); // exclude self

  // Find nearby cities sorted by distance
  const candidates: Array<{ ref: NearbyCityRef; distance: number }> = [];

  for (const coord of allCoords) {
    const slug = `${coord.stateSlug}/${coord.citySlug}`;
    if (existing.has(slug)) continue;

    const distance = calculateDistance(
      thisCity.lat,
      thisCity.lng,
      coord.lat,
      coord.lng
    );

    // Only consider cities within 100 miles
    if (distance <= 100) {
      candidates.push({
        ref: {
          name: coord.name,
          citySlug: coord.citySlug,
          stateSlug: coord.stateSlug,
        },
        distance,
      });
    }
  }

  // Sort by distance and take what we need
  candidates.sort((a, b) => a.distance - b.distance);
  const needed = count - hardcodedNearbyCities.length;
  const extra = candidates.slice(0, needed).map((c) => c.ref);

  return [...hardcodedNearbyCities, ...extra];
}
