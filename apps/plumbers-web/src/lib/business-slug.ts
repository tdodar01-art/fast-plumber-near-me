/**
 * Canonical profile-slug derivation — the single source of truth for the URL
 * of a plumber profile page (`/plumber/[slug]`).
 *
 * National franchises (Roto-Rooter, Benjamin Franklin, 1-Tom-Plumber, …) appear
 * once per city but share an identical business name, so a name-only slug
 * collapses every location onto one profile page. The scheme below appends the
 * city, state, and a 6-char `placeId` discriminator so every distinct location
 * gets a unique, *stable* slug: a record's slug depends only on its own fields,
 * never on whether other records collide, so the daily scrape adding a new
 * franchise location never churns an already-indexed URL.
 *
 * CONTRACT TWIN: scripts/lib/business-slug.js is a CommonJS mirror of this file
 * used by export-firestore-to-json.js to write `slug` into the JSON. The two
 * MUST stay behaviourally identical — the export script writes slugs into the
 * JSON, the runtime re-derives them for Firestore-sourced plumbers, and
 * getPlumberBySlug() must resolve both to the same record. The export script
 * asserts global slug uniqueness on every run as a backstop.
 */

/** Slugify a single name component (lowercase, drop dots, hyphenate the rest). */
export function slugifyName(text: string | null | undefined): string {
  return (text || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Last 6 alphanumerics of the Google placeId — a stable per-location
 * discriminator that guarantees slug uniqueness without any global state.
 * placeIds are globally unique; verified collision-free across the full dataset
 * even at 4 chars, so 6 leaves comfortable margin.
 */
export function placeIdSuffix(placeId: string | null | undefined): string {
  return (placeId || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(-6);
}

export interface BusinessSlugInput {
  name: string;
  city?: string | null;
  state?: string | null;
  placeId: string;
}

/** Canonical profile slug, e.g. `roto-rooter-plumbing-water-cleanup-aberdeen-md-icmvia`. */
export function businessProfileSlug({
  name,
  city,
  state,
  placeId,
}: BusinessSlugInput): string {
  return [slugifyName(name), slugifyName(city), slugifyName(state), placeIdSuffix(placeId)]
    .filter(Boolean)
    .join("-");
}

/**
 * The pre-2026-06 scheme (business name only). Retained ONLY to map already-
 * indexed legacy URLs onto their new canonical slug via a 308 redirect. Do not
 * use for new links.
 */
export function legacyBusinessSlug(name: string): string {
  return slugifyName(name);
}
