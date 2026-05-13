import type { DirectoryRoutes } from "./routes";

export interface DirectoryCollections {
  businesses: string;
  reviews: string;
  leads: string;
  cities?: string;
}

export interface DirectoryVerticalConfig {
  id: string;
  label: string;
  businessNoun: string;
  businessNounPlural: string;
  domain: string;
  collections: DirectoryCollections;
  routes: DirectoryRoutes;
  primarySearchQuery: string;
}
