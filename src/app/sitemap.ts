import { MetadataRoute } from "next";
import { getAllCityParams, getStatesWithCities } from "@/lib/cities-data";
import { STATES_DATA } from "@/lib/states-data";
import { BLOG_POSTS } from "@/lib/blog-data";
import { getAllPlumbers } from "@/lib/plumber-data";

const BASE_URL = "https://www.fastplumbernearme.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/emergency-plumbers`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/plumbers`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/how-we-verify`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/add-your-business`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  // State pages
  const statePages: MetadataRoute.Sitemap = getStatesWithCities()
    .map((abbr) => STATES_DATA[abbr])
    .filter(Boolean)
    .map((state) => ({
      url: `${BASE_URL}/emergency-plumbers/${state!.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // City pages
  const cityPages: MetadataRoute.Sitemap = getAllCityParams().map(({ state, city }) => ({
    url: `${BASE_URL}/emergency-plumbers/${state}/${city}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  // Blog posts
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Plumber profile pages
  const plumberPages: MetadataRoute.Sitemap = getAllPlumbers().map((plumber) => ({
    url: `${BASE_URL}/plumber/${plumber.slug}`,
    lastModified: new Date(plumber.scrapedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...statePages, ...cityPages, ...blogPages, ...plumberPages];
}
