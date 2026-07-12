/**
 * /sitemaps/{segment} — one urlset per template (01 §3.5), statically
 * generated at build. Segments: static.xml, markets.xml, emergency.xml,
 * plumbers-N.xml (chunks of <=2,500). Unknown segments 404.
 */

import { segmentNames, urlsForSegment, renderUrlset } from "@/lib/sitemap-data";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { segment: string }[] {
  return segmentNames().map((segment) => ({ segment }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ segment: string }> },
) {
  const { segment } = await params;
  const urls = urlsForSegment(segment);
  if (!urls) return new Response(null, { status: 404 });
  return new Response(renderUrlset(urls), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
