"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, Globe, Star, BadgeCheck, Flag, ChevronDown, MapPin,
  AlertTriangle, AlertOctagon, Info, MessageSquare, Zap, DollarSign,
  CheckCircle2,
} from "lucide-react";
import type { Plumber } from "@/lib/types";
import { getScoreLabel } from "@/lib/scoring";
import { getDistanceLabel } from "@/lib/geo";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function useViewTracking(plumberId: string, citySlug: string) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer5: ReturnType<typeof setTimeout>;
    let timer15: ReturnType<typeof setTimeout>;
    let timer30: ReturnType<typeof setTimeout>;

    function fire(type: string) {
      if (tracked.current.has(type)) return;
      tracked.current.add(type);
      fetch("/api/track-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plumberId, engagementType: type, city: citySlug }),
      }).catch(() => {});
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer5 = setTimeout(() => fire("view-5s"), 5000);
          timer15 = setTimeout(() => fire("view-15s"), 15000);
          timer30 = setTimeout(() => fire("view-30s"), 30000);
        } else {
          clearTimeout(timer5);
          clearTimeout(timer15);
          clearTimeout(timer30);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); clearTimeout(timer5); clearTimeout(timer15); clearTimeout(timer30); };
  }, [plumberId, citySlug]);

  return ref;
}

// --- Helpers ---

function formatReviewCount(count: number): string {
  if (count >= 10000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/** Truncate to first clause break at or before maxLen. */
function truncateClause(text: string, maxLen = 60): string {
  if (text.length <= maxLen) return text;
  const breaks = [". ", "; ", " — ", " – ", " - "];
  let best = -1;
  for (const br of breaks) {
    const idx = text.lastIndexOf(br, maxLen);
    if (idx > 20 && idx > best) best = idx;
  }
  if (best > 0) return text.slice(0, best + 1).trim();
  // No clause break found — hard truncate at word boundary
  const cut = text.lastIndexOf(" ", maxLen);
  return (cut > 20 ? text.slice(0, cut) : text.slice(0, maxLen)) + "…";
}

/** Check if two strings share significant keywords (for dedup). */
function isDuplicate(flagText: string, concernText: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const flagWords = new Set(normalize(flagText).split(/\s+/).filter(w => w.length > 3));
  const concernWords = normalize(concernText).split(/\s+/).filter(w => w.length > 3);
  let shared = 0;
  for (const w of concernWords) {
    if (flagWords.has(w)) shared++;
  }
  return shared >= 3 || (shared >= 2 && flagWords.size < 6);
}

function priceLevelSymbol(level: number | null | undefined): string | null {
  if (level === 0) return "Free";
  if (level === 1) return "$";
  if (level === 2) return "$$";
  if (level === 3) return "$$$";
  if (level === 4) return "$$$$";
  return null;
}

const SOURCE_LOGOS = [
  { key: "google", src: "/logos/sources/google.svg", label: "Google", active: true },
  { key: "yelp", src: "/logos/sources/yelp.svg", label: "Yelp", active: false },
  { key: "bbb", src: "/logos/sources/bbb.svg", label: "BBB", active: false },
] as const;

function SourceLogos({ googleReviewCount }: { googleReviewCount: number | null }) {
  const [tip, setTip] = useState<string | null>(null);
  const activeCount = 1;

  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`Review sources: ${activeCount} of ${SOURCE_LOGOS.length} synthesized`}
    >
      {SOURCE_LOGOS.map((s) => {
        const isActive = s.active;
        const tooltipText = isActive
          ? `${s.label}: ${googleReviewCount ? formatReviewCount(googleReviewCount) + " reviews" : "synthesized"}`
          : `${s.label} reviews not yet synthesized`;
        return (
          <span
            key={s.key}
            className="relative"
            onMouseEnter={() => setTip(s.key)}
            onMouseLeave={() => setTip(null)}
            onClick={(e) => { e.stopPropagation(); setTip(tip === s.key ? null : s.key); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.src}
              alt={isActive ? `${s.label} reviews synthesized` : `${s.label} reviews not yet synthesized`}
              aria-label={isActive ? `${s.label} reviews synthesized` : `${s.label} reviews not yet synthesized`}
              className={`h-4 sm:h-5 w-auto ${isActive ? "" : "grayscale opacity-30"}`}
            />
            {tip === s.key && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-gray-900 text-white text-[11px] font-normal px-2 py-1 rounded-md shadow-lg z-20">
                {tooltipText}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

// --- Main Component ---

export default function PlumberCard({
  plumber,
  citySlug,
  distanceMiles,
  cityName,
}: {
  plumber: Plumber & { latestReviewAt?: string };
  citySlug: string;
  distanceMiles?: number;
  cityName?: string;
}) {
  const viewRef = useViewTracking(plumber.id, citySlug);
  const router = useRouter();
  const slug = slugify(plumber.businessName);
  const syn = plumber.reviewSynthesis;
  const isFullySynthesized = (syn?.weaknesses?.length ?? 0) > 0;

  const handleCardClick = () => {
    router.push(`/plumber/${slug}`);
  };

  const handleCallClick = () => {
    fetch("/api/track-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plumberId: plumber.id,
        plumberName: plumber.businessName,
        plumberPhone: plumber.phone,
        city: cityName || citySlug,
        state: plumber.address?.state || "",
        citySlug,
        pageUrl: `/emergency-plumbers/${citySlug}`,
        clickType: "call",
        source: `/emergency-plumbers/${citySlug}`,
      }),
    }).catch(() => {});
  };

  // --- Build merged concerns list: red flags first, then weaknesses, deduped ---
  const redFlagTexts = syn?.redFlags ?? [];
  const weaknessTexts = isFullySynthesized ? (syn?.weaknesses ?? []) : [];
  // Dedup weaknesses against red flags
  const dedupedWeaknesses = weaknessTexts.filter(w => !redFlagTexts.some(f => isDuplicate(f, w)));
  // Merge: red flags first (severe), then weaknesses (lesser), cap at 4
  const allConcerns: { text: string; severe: boolean }[] = [
    ...redFlagTexts.map(t => ({ text: t, severe: true })),
    ...dedupedWeaknesses.map(t => ({ text: t, severe: false })),
  ].slice(0, 4);
  const totalConcernsAvailable = redFlagTexts.length + dedupedWeaknesses.length;

  const strengths = (syn?.strengths ?? []).slice(0, 4);
  const totalStrengthsAvailable = (syn?.strengths ?? []).length;
  const hasConcerns = allConcerns.length > 0;
  const hasRedFlags = redFlagTexts.length > 0;

  // --- KPI tiles ---
  const kpis: { icon: React.ReactNode; value: string; label: string }[] = [];

  if (plumber.googleReviewCount != null && plumber.googleReviewCount > 0) {
    kpis.push({
      icon: <MessageSquare className="w-4 h-4 text-gray-500" />,
      value: formatReviewCount(plumber.googleReviewCount),
      label: "Google reviews",
    });
  }

  if (plumber.is24Hour) {
    kpis.push({
      icon: <Zap className="w-4 h-4 text-gray-500" />,
      value: "24/7",
      label: "Always open",
    });
  }

  const priceSymbol = priceLevelSymbol((plumber as { priceLevel?: number | null }).priceLevel);
  if (priceSymbol) {
    kpis.push({
      icon: <DollarSign className="w-4 h-4 text-gray-500" />,
      value: priceSymbol,
      label: "Price tier",
    });
  }

  return (
    <div
      ref={viewRef}
      onClick={handleCardClick}
      className={`rounded-xl border-2 p-4 sm:p-5 shadow-sm hover:shadow-md active:shadow-inner transition-shadow cursor-pointer ${
        hasRedFlags
          ? "border-l-red-500 border-l-4 border-t-gray-200 border-r-gray-200 border-b-gray-200 bg-white"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* === IDENTITY + TRUST LINE === */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-gray-900 leading-tight truncate">{plumber.businessName}</h3>

          {/* Trust line */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-sm text-gray-600">
            {plumber.googleRating != null && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-gray-900">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                {plumber.googleRating}
              </span>
            )}
            {plumber.googleReviewCount != null && plumber.googleReviewCount > 0 && (
              <>
                <span className="text-gray-400">·</span>
                <span className="font-medium">{formatReviewCount(plumber.googleReviewCount)} reviews</span>
              </>
            )}
            <span className="text-gray-400">·</span>
            <SourceLogos googleReviewCount={plumber.googleReviewCount} />
          </div>

          {/* Distance — below name on mobile */}
          {distanceMiles != null && (
            <p className={`flex items-center gap-1 text-xs mt-1 sm:hidden ${
              getDistanceLabel(distanceMiles).color === "amber" ? "text-amber-600" : "text-gray-500"
            }`}>
              <MapPin className="w-3 h-3" />
              {getDistanceLabel(distanceMiles, cityName).text}
            </p>
          )}
        </div>

        {/* Desktop: distance + score on right */}
        <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-1 sm:flex-shrink-0 sm:ml-4">
          {distanceMiles != null && (
            <p className={`flex items-center gap-1 text-xs ${
              getDistanceLabel(distanceMiles).color === "amber" ? "text-amber-600" : "text-gray-500"
            }`}>
              <MapPin className="w-3 h-3" />
              {getDistanceLabel(distanceMiles, cityName).text}
            </p>
          )}
          {plumber.reliabilityScore > 0 && <TrustScore score={plumber.reliabilityScore} />}
        </div>
      </div>

      {/* === BADGES — compact row (no 24/7 badge — moved to KPI) === */}
      <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-hide">
        {plumber.googleVerified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
            <BadgeCheck className="w-3 h-3" />
            Google Verified
          </span>
        )}
        {/* Mobile trust score — inline with badges */}
        {plumber.reliabilityScore > 0 && (
          <span className="sm:hidden">
            <TrustScore score={plumber.reliabilityScore} />
          </span>
        )}
      </div>

      {/* === KPI TILES === */}
      {kpis.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide sm:flex-wrap">
          {kpis.map((kpi, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 flex-shrink-0">
              {kpi.icon}
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 leading-tight">{kpi.value}</div>
                <div className="text-[11px] text-gray-500 leading-tight">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === FLAGGED WARNING === */}
      {plumber.status === "flagged" && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-700 font-medium">
          Unverified — this listing may have issues
        </div>
      )}

      {/* === STRENGTHS / CONCERNS COMPARISON === */}
      {syn && (strengths.length > 0 || hasConcerns) && (
        <ComparisonColumns
          strengths={strengths}
          totalStrengths={totalStrengthsAvailable}
          allStrengths={syn.strengths ?? []}
          concerns={allConcerns}
          totalConcerns={totalConcernsAvailable}
          allRedFlags={redFlagTexts}
          allWeaknesses={dedupedWeaknesses}
        />
      )}

      {/* === PRELIMINARY LISTING NOTE === */}
      {syn && !isFullySynthesized && (
        <p className="mt-2 text-xs text-gray-400">Preliminary listing — full review analysis coming soon</p>
      )}

      {/* === CTA === */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <a
          href={`tel:${plumber.phone}`}
          onClick={(e) => { e.stopPropagation(); handleCallClick(); }}
          className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-3 px-5 rounded-xl transition-colors shadow-lg shadow-accent/25 w-full sm:w-auto"
        >
          <Phone className="w-5 h-5 flex-shrink-0" />
          <span className="sm:hidden">Call Now</span>
          <span className="hidden sm:inline">{plumber.phone}</span>
        </a>
        {plumber.website && (
          <a
            href={plumber.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              fetch("/api/track-lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  plumberId: plumber.id,
                  plumberName: plumber.businessName,
                  plumberPhone: plumber.phone,
                  city: cityName || citySlug,
                  state: plumber.address?.state || "",
                  citySlug,
                  pageUrl: `/emergency-plumbers/${citySlug}`,
                  clickType: "website",
                  source: `/emergency-plumbers/${citySlug}`,
                }),
              }).catch(() => {});
            }}
            className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors sm:ml-1"
          >
            <Globe className="w-4 h-4" />
            <span>Visit website</span>
          </a>
        )}
      </div>

      {/* === REPORT === */}
      <ReportButton plumberId={plumber.id} citySlug={citySlug} />
    </div>
  );
}

// --- Comparison Columns ---

function ComparisonColumns({
  strengths,
  totalStrengths,
  allStrengths,
  concerns,
  totalConcerns,
  allRedFlags,
  allWeaknesses,
}: {
  strengths: string[];
  totalStrengths: number;
  allStrengths: string[];
  concerns: { text: string; severe: boolean }[];
  totalConcerns: number;
  allRedFlags: string[];
  allWeaknesses: string[];
}) {
  const [expandStrengths, setExpandStrengths] = useState(false);
  const [expandConcerns, setExpandConcerns] = useState(false);

  const hasStrengths = strengths.length > 0;
  const hasConcerns = concerns.length > 0;

  const displayedStrengths = expandStrengths ? allStrengths : strengths;
  const displayedConcerns = expandConcerns
    ? [
        ...allRedFlags.map(t => ({ text: t, severe: true })),
        ...allWeaknesses.map(t => ({ text: t, severe: false })),
      ]
    : concerns;

  const strengthsHasMore = totalStrengths > 4 && !expandStrengths;
  const concernsHasMore = totalConcerns > 4 && !expandConcerns;

  return (
    <div className={`mt-3 grid gap-3 ${hasStrengths && hasConcerns ? "sm:grid-cols-2" : "grid-cols-1"}`}>
      {hasStrengths && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Strengths</div>
          <div className="space-y-1.5">
            {displayedStrengths.map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 text-sm text-green-800 leading-snug">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{truncateClause(s, 65)}</span>
              </div>
            ))}
          </div>
          {strengthsHasMore && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpandStrengths(true); }}
              className="mt-1.5 text-xs text-green-600 hover:text-green-800 font-medium"
            >
              Show {totalStrengths - 4} more
            </button>
          )}
        </div>
      )}

      {hasConcerns && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Concerns</div>
          <div className="space-y-1.5">
            {displayedConcerns.map((c, i) => (
              <div key={i} className={`flex items-start gap-1.5 text-sm leading-snug ${c.severe ? "text-red-700" : "text-amber-700"}`}>
                {c.severe
                  ? <AlertOctagon className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                }
                <span>{truncateClause(c.text, 65)}</span>
              </div>
            ))}
          </div>
          {concernsHasMore && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpandConcerns(true); }}
              className="mt-1.5 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Show {totalConcerns - 4} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Trust Score Badge with tooltip ---

function TrustScore({ score }: { score: number }) {
  const [showTip, setShowTip] = useState(false);
  const label = getScoreLabel(score);
  const color = score >= 80 ? "bg-green-50 text-green-700"
    : score >= 50 ? "bg-yellow-50 text-yellow-700"
    : "bg-red-50 text-red-700";

  return (
    <span
      className={`relative inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color} cursor-default`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onClick={(e) => { e.stopPropagation(); setShowTip(!showTip); }}
    >
      {score} — {label}
      <Info className="w-3 h-3 opacity-50" />
      {showTip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-52 bg-gray-900 text-white text-[11px] font-normal px-2.5 py-1.5 rounded-lg shadow-lg z-20 text-center leading-tight">
          Trust score based on review depth, recency, and consistency across sources
        </span>
      )}
    </span>
  );
}

// --- Report Button ---

function ReportButton({ plumberId, citySlug }: { plumberId: string; citySlug: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const options = [
    { type: "answered-fast", label: "They answered right away!", positive: true },
    { type: "no-answer", label: "They didn't answer my call", positive: false },
    { type: "bad-number", label: "This number doesn't work", positive: false },
    { type: "seems-closed", label: "This business seems closed", positive: false },
  ] as const;

  async function report(type: string) {
    fetch("/api/report-plumber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plumberId, reportType: type, city: citySlug }),
    }).catch(() => {});
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); }, 2000);
  }

  return (
    <div className="mt-2 relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
      >
        <Flag className="w-3 h-3" />
        Report an issue
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-10 min-w-[220px]">
          {sent ? (
            <p className="text-xs text-green-600 p-2">Thanks for the feedback!</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.type}
                onClick={(e) => { e.stopPropagation(); report(opt.type); }}
                className={`block w-full text-left text-xs px-3 py-1.5 rounded hover:bg-gray-50 ${opt.positive ? "text-green-700" : "text-gray-700"}`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
