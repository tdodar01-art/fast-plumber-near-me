/**
 * JSON-LD builders — the single definition site for every schema.org object
 * the site emits (spec §2 table + 01 §2.1 field map).
 *
 * Allowed types ONLY: Organization, WebSite+SearchAction, BreadcrumbList,
 * CollectionPage, ItemList, Plumber entity, WebPage, Article (blog).
 * STRICTLY BANNED anywhere (C1): Review, AggregateRating, positiveNotes,
 * negativeNotes, FAQPage. Do not add builders for them.
 *
 * All URLs are absolute on the www origin via absoluteUrl().
 */

import { SITE_ORIGIN, absoluteUrl, businessProfilePath } from "@/config/plumbing-routes";
import type { SynthesizedPlumber } from "./plumber-data";

/** Stable Organization node id, referenced by WebSite.publisher. */
export const ORG_ID = `${SITE_ORIGIN}/#org`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

/** 20 miles in meters — the service-radius GeoCircle (01 §2.1). */
export const SERVICE_RADIUS_METERS = 32187;

// ---------------------------------------------------------------------------
// Site-level nodes (home page)
// ---------------------------------------------------------------------------

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Fast Plumber Near Me",
    url: absoluteUrl(),
    logo: absoluteUrl("/logo.svg"),
    description:
      "A review-synthesis directory: we read the public reviews of the plumbers we list and publish each one's strengths and complaints, quoted word-for-word. Rankings are never for sale.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "info@fastplumbernearme.com",
      url: absoluteUrl("/contact"),
    },
  };
}

/**
 * WebSite + SearchAction (01 §2.1). The target is the national index's ?q=
 * param, which prefills the client-side market search on /plumbers. Query
 * strings never index (canonical strips them; /plumbers self-canonicalizes).
 */
export function webSiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Fast Plumber Near Me",
    url: absoluteUrl(),
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}/plumbers?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ---------------------------------------------------------------------------
// BreadcrumbList (visible breadcrumbs mirror this everywhere hierarchical)
// ---------------------------------------------------------------------------

export interface Crumb {
  name: string;
  /** Site-relative path ("" or "/" for home). */
  path: string;
}

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** Standard crumb prefix: Home › Plumbers. */
export function homeCrumbs(): Crumb[] {
  return [
    { name: "Home", path: "/" },
    { name: "Plumbers", path: "/plumbers" },
  ];
}

// ---------------------------------------------------------------------------
// CollectionPage + URL-only ItemList (national index, state hubs)
// ---------------------------------------------------------------------------

/**
 * CollectionPage whose ItemList items are page URLs only — no nested
 * LocalBusiness entities (01 §2.1: "a list of *pages*, not businesses").
 */
export function collectionPageLd(opts: { name: string; path: string; itemUrls: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    url: absoluteUrl(opts.path),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: opts.itemUrls.map((url, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Plumber entities (01 §2.1 field map)
// ---------------------------------------------------------------------------

/**
 * PostalAddress from the flat Google-formatted address string
 * ("915 Murfreesboro Pike, Nashville, TN 37217, USA") plus the record's own
 * city/state fields. Only fields we actually have are emitted.
 */
function postalAddress(p: SynthesizedPlumber) {
  const addr = p.address ?? "";
  const zipMatch = addr.match(/(\d{5})(?:-\d{4})?(?:,\s*(?:USA|United States))?\s*$/);
  let streetAddress: string | undefined;
  if (addr && p.city) {
    const idx = addr.toLowerCase().indexOf(`, ${p.city.toLowerCase()},`);
    if (idx > 0) streetAddress = addr.slice(0, idx).trim();
  }
  return {
    "@type": "PostalAddress",
    ...(streetAddress ? { streetAddress } : {}),
    ...(p.city ? { addressLocality: p.city } : {}),
    ...(p.state ? { addressRegion: p.state } : {}),
    ...(zipMatch ? { postalCode: zipMatch[1] } : {}),
    addressCountry: "US",
  };
}

const DAY_ABBR: Record<string, string> = {
  monday: "Mo",
  tuesday: "Tu",
  wednesday: "We",
  thursday: "Th",
  friday: "Fr",
  saturday: "Sa",
  sunday: "Su",
};

function to24h(hourRaw: string, minRaw: string | undefined, meridiem: string): string {
  let h = parseInt(hourRaw, 10);
  const mer = meridiem.toUpperCase();
  if (mer === "AM" && h === 12) h = 0;
  if (mer === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minRaw ?? "00"}`;
}

// "8:00 AM – 5:00 PM", "4:30 – 8:00 PM" (leading meridiem inherited — Google
// omits it when both ends share one), en/em dash or hyphen.
const HOURS_RANGE_RE =
  /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i;

/**
 * schema.org openingHours strings from the Google workingHours lines.
 * is24Hour listings collapse to the spec string "Mo-Su 00:00-24:00" (the
 * LISTING's published claim — matches how the visible page frames it).
 * Unparseable lines are skipped, never guessed.
 */
function openingHours(p: SynthesizedPlumber): string | string[] | undefined {
  if (p.is24Hour) return "Mo-Su 00:00-24:00";
  if (!p.workingHours || p.workingHours.length === 0) return undefined;
  const out: string[] = [];
  for (const line of p.workingHours) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const day = DAY_ABBR[line.slice(0, sep).trim().toLowerCase()];
    if (!day) continue;
    const value = line.slice(sep + 1).trim();
    if (/^closed$/i.test(value)) continue;
    if (/open 24 hours/i.test(value)) {
      out.push(`${day} 00:00-24:00`);
      continue;
    }
    for (const range of value.split(/,\s*/)) {
      const m = range.trim().match(HOURS_RANGE_RE);
      if (!m) continue;
      const closeMer = m[6] ?? m[3];
      const openMer = m[3] ?? m[6];
      if (!openMer || !closeMer) continue;
      out.push(`${day} ${to24h(m[1], m[2], openMer)}-${to24h(m[4], m[5], closeMer)}`);
    }
  }
  return out.length > 0 ? out : undefined;
}

/** areaServed GeoCircle — 20-mile service radius around the shop (01 §2.1). */
function areaServedCircle(p: SynthesizedPlumber) {
  if (!p.location?.lat || !p.location?.lng) return undefined;
  return {
    "@type": "GeoCircle",
    geoMidpoint: {
      "@type": "GeoCoordinates",
      latitude: p.location.lat,
      longitude: p.location.lng,
    },
    geoRadius: SERVICE_RADIUS_METERS,
  };
}

/** Shared Plumber field map (01 §2.1). Non-null fields only. */
function plumberFields(p: SynthesizedPlumber) {
  const url = absoluteUrl(businessProfilePath(p.slug));
  const hours = openingHours(p);
  const area = areaServedCircle(p);
  return {
    "@type": "Plumber",
    name: p.name,
    url,
    ...(p.phone ? { telephone: p.phone } : {}),
    address: postalAddress(p),
    ...(p.location?.lat && p.location?.lng
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: p.location.lat,
            longitude: p.location.lng,
          },
        }
      : {}),
    ...(hours ? { openingHours: hours } : {}),
    ...(area ? { areaServed: area } : {}),
    ...(p.website ? { sameAs: p.website } : {}),
  };
}

/**
 * Summary entity for market/emergency ItemLists — @id points at the profile
 * URL so every mention consolidates on the profile page's entity.
 */
export function plumberSummaryEntity(p: SynthesizedPlumber) {
  const url = absoluteUrl(businessProfilePath(p.slug));
  return { "@id": url, ...plumberFields(p) };
}

/** First sentence of a synthesis summary (for the entity description). */
function firstSentence(text: string): string {
  const m = text.trim().match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

/**
 * Full Plumber entity for the profile page (@id: {url}#business).
 * description = "Editorial summary: " + first sentence of synthesis.summary —
 * opinion framing, never a bare factual claim. NO aggregateRating, NO review
 * (C1), even though the visible page shows the full distribution and quotes.
 */
export function plumberFullEntity(p: SynthesizedPlumber) {
  const url = absoluteUrl(businessProfilePath(p.slug));
  return {
    "@context": "https://schema.org",
    "@id": `${url}#business`,
    ...plumberFields(p),
    ...(p.synthesis?.summary
      ? { description: `Editorial summary: ${firstSentence(p.synthesis.summary)}` }
      : {}),
  };
}

/**
 * Ranked-listing ItemList for market/emergency pages: each item is a Plumber
 * summary entity (not just a URL — this is a list of businesses).
 */
export function plumberItemListLd(opts: {
  name: string;
  path: string;
  plumbers: SynthesizedPlumber[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    url: absoluteUrl(opts.path),
    numberOfItems: opts.plumbers.length,
    itemListElement: opts.plumbers.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: plumberSummaryEntity(p),
    })),
  };
}

// ---------------------------------------------------------------------------
// Serialization helper
// ---------------------------------------------------------------------------

/**
 * Serialize one or more JSON-LD nodes for a single <script type=
 * "application/ld+json"> tag. Multiple nodes emit as a top-level array.
 * Escapes "<" so review text (or any data) can never close the script tag.
 */
export function jsonLdString(nodes: object | object[]): string {
  const payload = Array.isArray(nodes) && nodes.length === 1 ? nodes[0] : nodes;
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}
