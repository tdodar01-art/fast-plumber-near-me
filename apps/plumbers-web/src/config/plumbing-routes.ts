import {
  buildBusinessProfilePath,
  buildCityPath,
  buildServiceCityPath,
} from "@directory-sites/directory-core";
import { plumbingDirectoryConfig } from "./plumbing-directory";

// Canonical origin (www — see plumbing-directory.ts). Source of truth for
// absoluteUrl(), sitemap, schema, OG, and rel=canonical.
export const SITE_ORIGIN = plumbingDirectoryConfig.domain;
// Apex (non-www) origin. Production 307-redirects apex → www; kept for the
// API origin allowlist so apex referers are still accepted pre-redirect.
export const SITE_ORIGIN_APEX = SITE_ORIGIN.replace("https://www.", "https://");
// The www origin is now the canonical SITE_ORIGIN. Alias retained so existing
// consumers (admin display, GSC site URL, origin allowlist) keep working, and
// guarded so it never double-prefixes if the canonical host is already www.
export const SITE_ORIGIN_WITH_WWW = SITE_ORIGIN.includes("://www.")
  ? SITE_ORIGIN
  : SITE_ORIGIN.replace("https://", "https://www.");

export function absoluteUrl(path = ""): string {
  if (!path || path === "/") return SITE_ORIGIN;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function cityPath(stateSlug: string, citySlug: string): string {
  return buildCityPath(plumbingDirectoryConfig.routes, { stateSlug, citySlug });
}

export function serviceCityPath(
  serviceSlug: string,
  stateSlug: string,
  citySlug: string,
): string {
  return buildServiceCityPath(plumbingDirectoryConfig.routes, {
    serviceSlug,
    stateSlug,
    citySlug,
  });
}

export function businessProfilePath(businessSlug: string): string {
  return buildBusinessProfilePath(plumbingDirectoryConfig.routes, { businessSlug });
}
