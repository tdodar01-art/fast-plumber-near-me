import { plumbingDirectoryConfig } from "./plumbing-directory";

export const COLLECTIONS = {
  businesses: plumbingDirectoryConfig.collections.businesses,
  reviews: plumbingDirectoryConfig.collections.reviews,
  leads: plumbingDirectoryConfig.collections.leads,
  cities: plumbingDirectoryConfig.collections.cities ?? "cities",
  businessSubmissions: "businessSubmissions",
  pipelineRuns: "pipelineRuns",
  apiUsage: "apiUsage",
  ratingSnapshots: "ratingSnapshots",
} as const;
