import type { DirectoryVerticalConfig } from "@directory-sites/directory-core";

export const plumbingDirectoryConfig = {
  id: "plumbing",
  label: "Fast Plumber Near Me",
  businessNoun: "plumber",
  businessNounPlural: "plumbers",
  // Canonical host. Production redirects apex → www (Vercel 307), and the
  // Search Console property is the www host, so www is the single canonical
  // origin for sitemap, schema, OG, and rel=canonical. Do not change to apex
  // without also flipping the Vercel redirect direction.
  domain: "https://www.fastplumbernearme.com",
  collections: {
    businesses: "plumbers",
    reviews: "reviews",
    leads: "leads",
    cities: "cities",
  },
  routes: {
    home: "/",
    city: "/emergency-plumbers/[stateSlug]/[citySlug]",
    serviceCity: "/[serviceSlug]/[stateSlug]/[citySlug]",
    businessProfile: "/plumber/[businessSlug]",
  },
  primarySearchQuery: "emergency plumber in {city}, {state}",
} satisfies DirectoryVerticalConfig;
