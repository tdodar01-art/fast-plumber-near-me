import {
  buildBusinessProfilePath,
  buildCityPath,
  buildServiceCityPath,
} from "@directory-sites/directory-core";
import { plumbingDirectoryConfig } from "./plumbing-directory";

export const SITE_ORIGIN = plumbingDirectoryConfig.domain;
export const SITE_ORIGIN_WITH_WWW = SITE_ORIGIN.replace("https://", "https://www.");

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
