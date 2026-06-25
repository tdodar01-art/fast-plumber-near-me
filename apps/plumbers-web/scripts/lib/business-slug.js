/**
 * Canonical profile-slug derivation (CommonJS).
 *
 * CONTRACT TWIN: src/lib/business-slug.ts — keep behaviourally identical. This
 * mirror exists because export-firestore-to-json.js is a CJS node script and
 * cannot import the TS module directly. The export script is the slug authority
 * (writes `slug` into plumbers-synthesized.json); the runtime re-derives the
 * same value for Firestore-sourced plumbers. See the TS file for full rationale.
 */

function slugifyName(text) {
  return (text || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function placeIdSuffix(placeId) {
  return (placeId || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(-6);
}

function businessProfileSlug({ name, city, state, placeId }) {
  return [slugifyName(name), slugifyName(city), slugifyName(state), placeIdSuffix(placeId)]
    .filter(Boolean)
    .join("-");
}

function legacyBusinessSlug(name) {
  return slugifyName(name);
}

module.exports = { slugifyName, placeIdSuffix, businessProfileSlug, legacyBusinessSlug };
