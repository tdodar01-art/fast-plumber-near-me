import type { DirectoryVerticalConfig } from "@directory-sites/directory-core";

export const plumbingDirectoryConfig = {
  id: "plumbing",
  label: "Fast Plumber Near Me",
  businessNoun: "plumber",
  businessNounPlural: "plumbers",
  domain: "https://fastplumbernearme.com",
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
