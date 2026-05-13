const SITE_ORIGIN = "https://fastplumbernearme.com";
const SITE_ORIGIN_WITH_WWW = SITE_ORIGIN.replace("https://", "https://www.");

const COLLECTIONS = {
  businesses: "plumbers",
  reviews: "reviews",
  leads: "leads",
  cities: "cities",
  apiUsage: "apiUsage",
  pipelineRuns: "pipelineRuns",
  indexingRequests: "indexingRequests",
};

const ROUTES = {
  home: "/",
  city: "/emergency-plumbers/[stateSlug]/[citySlug]",
  serviceCity: "/[serviceSlug]/[stateSlug]/[citySlug]",
  businessProfile: "/plumber/[businessSlug]",
};

function fillPattern(pattern, values) {
  return pattern.replace(/\[([^\]]+)\]/g, (_, key) => values[key] || "");
}

function cityPath(stateSlug, citySlug) {
  return fillPattern(ROUTES.city, { stateSlug, citySlug });
}

function serviceCityPath(serviceSlug, stateSlug, citySlug) {
  return fillPattern(ROUTES.serviceCity, { serviceSlug, stateSlug, citySlug });
}

function businessProfilePath(businessSlug) {
  return fillPattern(ROUTES.businessProfile, { businessSlug });
}

module.exports = {
  COLLECTIONS,
  ROUTES,
  SITE_ORIGIN,
  SITE_ORIGIN_WITH_WWW,
  businessProfilePath,
  cityPath,
  serviceCityPath,
};
