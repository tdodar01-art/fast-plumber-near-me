import { MetadataRoute } from "next";

const BASE_URL = "https://fastplumbernearme.com";

const cities = [
  "crystal-lake-il",
  "mchenry-il",
  "algonquin-il",
  "lake-in-the-hills-il",
  "huntley-il",
  "woodstock-il",
  "cary-il",
  "marengo-il",
  "harvard-il",
  "carpentersville-il",
  "elgin-il",
  "south-elgin-il",
  "st-charles-il",
  "geneva-il",
  "batavia-il",
  "aurora-il",
  "naperville-il",
  "wheaton-il",
  "schaumburg-il",
  "arlington-heights-il",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1 },
    { url: `${BASE_URL}/emergency-plumbers`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${BASE_URL}/how-we-verify`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${BASE_URL}/add-your-business`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.4 },
    { url: `${BASE_URL}/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.2 },
  ];

  const cityPages = cities.map((city) => ({
    url: `${BASE_URL}/emergency-plumbers/${city}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...cityPages];
}
