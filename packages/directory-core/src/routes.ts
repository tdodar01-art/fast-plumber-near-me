export interface DirectoryRoutes {
  home: string;
  city: string;
  serviceCity?: string;
  businessProfile?: string;
}

export interface CityRouteParts {
  stateSlug: string;
  citySlug: string;
}

export interface ServiceCityRouteParts extends CityRouteParts {
  serviceSlug: string;
}

export interface BusinessProfileRouteParts {
  businessSlug: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function fillPattern(pattern: string, values: object): string {
  const routeValues = values as Record<string, string | undefined>;
  return pattern.replace(/\[([^\]]+)\]/g, (_, key: string) => routeValues[key] ?? "");
}

export function buildCityPath(routes: DirectoryRoutes, parts: CityRouteParts): string {
  const path = fillPattern(routes.city, parts);
  return `/${trimSlashes(path)}`;
}

export function buildServiceCityPath(
  routes: DirectoryRoutes,
  parts: ServiceCityRouteParts,
): string {
  if (!routes.serviceCity) {
    throw new Error("This directory does not define a service city route.");
  }
  const path = fillPattern(routes.serviceCity, parts);
  return `/${trimSlashes(path)}`;
}

export function buildBusinessProfilePath(
  routes: DirectoryRoutes,
  parts: BusinessProfileRouteParts,
): string {
  if (!routes.businessProfile) {
    throw new Error("This directory does not define a business profile route.");
  }
  const path = fillPattern(routes.businessProfile, parts);
  return `/${trimSlashes(path)}`;
}
