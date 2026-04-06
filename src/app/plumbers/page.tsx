import type { Metadata } from "next";
import { Suspense } from "react";
import { getPlumbersRanked, getDataMeta } from "@/lib/plumber-data";
import { getCityCoords } from "@/lib/city-coords";
import PlumberDirectory from "./PlumberDirectory";

export const metadata: Metadata = {
  title: "Ranked Plumbers — Honest Reviews & Trust Scores",
  description:
    "Every plumber ranked by trust score. AI-analyzed Google reviews show the truth — strengths, weaknesses, and red flags. No paid placements.",
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://fastplumbernearme.com" },
    { "@type": "ListItem", position: 2, name: "Plumber Rankings", item: "https://fastplumbernearme.com/plumbers" },
  ],
};

export default function PlumbersDirectoryPage() {
  const plumbers = getPlumbersRanked();
  const meta = getDataMeta();
  const withSynthesis = plumbers.filter((p) => p.synthesis);

  // Build city→coords lookup for distance calculation
  const allCoords = getCityCoords();
  const cityCoords: Record<string, [number, number]> = {};
  for (const c of allCoords) {
    cityCoords[c.name] = [c.lat, c.lng];
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    <div className="max-w-[600px] mx-auto px-4 py-6 font-[family-name:var(--font-dm-sans)]">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-gray-900 mb-1">
          Plumber rankings
        </h1>
        <p className="text-sm text-gray-500">
          {withSynthesis.length} plumbers analyzed. Ranked by AI trust score, not ad spend.
        </p>
      </div>

      <Suspense fallback={<div className="h-8 mb-5" />}>
        <PlumberDirectory plumbers={plumbers} cityCoords={cityCoords} />
      </Suspense>

      <div className="text-center text-xs text-gray-400 mt-8 mb-4">
        Data from Google Reviews, analyzed by AI · Last updated{" "}
        {new Date(meta.synthesizedAt).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        })}
      </div>
    </div>
    </>
  );
}
