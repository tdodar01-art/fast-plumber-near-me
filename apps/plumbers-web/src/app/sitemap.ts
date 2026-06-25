import { MetadataRoute } from "next";
import { getAllCityParams, getStatesWithCities } from "@/lib/cities-data";
import { STATES_DATA, getStateBySlug } from "@/lib/states-data";
import { BLOG_POSTS } from "@/lib/blog-data";
import { getAllServiceSlugs } from "@/lib/services-config";
import { CITY_COVERAGE } from "@/lib/city-coverage";
import { getAllPlumberSlugs } from "@/lib/plumber-data";
import { absoluteUrl, cityPath, serviceCityPath, businessProfilePath } from "@/config/plumbing-routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl(), lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: absoluteUrl("/emergency-plumbers"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/plumbers"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/blog"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/about"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/how-we-verify"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/add-your-business"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/privacy-policy"), lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  // State pages
  const statePages: MetadataRoute.Sitemap = getStatesWithCities()
    .map((abbr) => STATES_DATA[abbr])
    .filter(Boolean)
    .map((state) => ({
      url: absoluteUrl(`/emergency-plumbers/${state!.slug}`),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const cityParams = getAllCityParams();

  // City pages — highest priority after homepage
  const cityPages: MetadataRoute.Sitemap = cityParams.map(({ state, city }) => ({
    url: absoluteUrl(cityPath(state, city)),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Service × city pages (Track A) — only for cities with plumber data
  const serviceSlugs = getAllServiceSlugs();
  const servicePages: MetadataRoute.Sitemap = serviceSlugs.flatMap((svc) =>
    cityParams
      .filter(({ state, city }) => {
        const stateInfo = getStateBySlug(state);
        return stateInfo && CITY_COVERAGE[`${stateInfo.abbreviation}:${city}`];
      })
      .map(({ state, city }) => ({
        url: absoluteUrl(serviceCityPath(svc, state, city)),
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  );

  // Blog posts
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Plumber profile pages — long-tail business-name queries. These are
  // statically generated (generateStaticParams from getAllPlumberSlugs) but
  // were previously absent from the sitemap, leaving them undiscoverable.
  const plumberPages: MetadataRoute.Sitemap = getAllPlumberSlugs().map((slug) => ({
    url: absoluteUrl(businessProfilePath(slug)),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...statePages,
    ...cityPages,
    ...servicePages,
    ...blogPages,
    ...plumberPages,
  ];
}
