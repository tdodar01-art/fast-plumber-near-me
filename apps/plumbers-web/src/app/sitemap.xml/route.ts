/**
 * /sitemap.xml — segmented sitemap INDEX (01 §3.5). Same path as the old
 * monolithic sitemap so GSC's existing registration keeps working; it now
 * points at /sitemaps/{static,markets,emergency,plumbers-N}.xml.
 */

import { renderSitemapIndex } from "@/lib/sitemap-data";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderSitemapIndex(), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
