"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Database, FileText, Zap, DollarSign, ChevronDown, ChevronRight } from "lucide-react";

interface PipelineRun {
  id: string;
  script: string;
  startedAt: { toDate: () => Date };
  completedAt: { toDate: () => Date };
  durationSeconds: number;
  status: "success" | "error" | "partial";
  summary: Record<string, unknown>;
  error?: string;
  triggeredBy: string;
}

interface ApiUsage {
  estimatedCost: number;
  totalCalls: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  const daysAgo = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) return `${daysAgo} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const scriptLabels: Record<string, { label: string; color: string }> = {
  "daily-scrape": { label: "daily-scrape", color: "bg-blue-100 text-blue-700" },
  "fetch-plumbers": { label: "fetch-plumbers", color: "bg-blue-100 text-blue-700" },
  "upload-firestore": { label: "upload-firestore", color: "bg-sky-100 text-sky-700" },
  "refresh-reviews": { label: "refresh-reviews", color: "bg-purple-100 text-purple-700" },
  "synthesize-reviews": { label: "synthesize-reviews", color: "bg-green-100 text-green-700" },
  "request-indexing": { label: "request-indexing", color: "bg-orange-100 text-orange-700" },
  "outscraper-reviews": { label: "outscraper-reviews", color: "bg-pink-100 text-pink-700" },
  "bbb-lookup": { label: "bbb-lookup", color: "bg-yellow-100 text-yellow-700" },
  "export-json": { label: "export-json", color: "bg-teal-100 text-teal-700" },
  "generate-blog": { label: "generate-blog", color: "bg-indigo-100 text-indigo-700" },
  "resynthesize-emergency": { label: "resynthesize", color: "bg-lime-100 text-lime-700" },
};

function getRunSummaryLine(run: PipelineRun): string {
  const s = run.summary;
  const parts: string[] = [];

  if (run.script === "daily-scrape" || run.script === "fetch-plumbers") {
    if (s.citiesSearched) parts.push(`Searched: ${(s.citiesSearched as string[]).join(", ")}`);
    if (s.newPlumbers != null) parts.push(`New plumbers: ${s.newPlumbers}`);
    if (s.updatedPlumbers != null) parts.push(`Updated: ${s.updatedPlumbers}`);
    if (s.apiCalls != null) parts.push(`API calls: ${s.apiCalls}`);
    if (s.monthlyUsage) parts.push(`Budget: ${s.monthlyUsage}`);
  } else if (run.script === "upload-firestore") {
    if (s.created != null) parts.push(`Created: ${s.created}`);
    if (s.updated != null) parts.push(`Updated: ${s.updated}`);
    if (s.failed != null && (s.failed as number) > 0) parts.push(`Failed: ${s.failed}`);
  } else if (run.script === "refresh-reviews") {
    if (s.plumbersRefreshed != null) parts.push(`Refreshed: ${s.plumbersRefreshed}`);
    if (s.newReviewsCached != null) parts.push(`New reviews: ${s.newReviewsCached}`);
    if (s.totalReviewsNow != null) parts.push(`Total cached: ${s.totalReviewsNow}`);
  } else if (run.script === "synthesize-reviews") {
    if (s.plumbersSynthesized != null) parts.push(`Synthesized: ${s.plumbersSynthesized}`);
    if (s.failed != null && (s.failed as number) > 0) parts.push(`Errors: ${s.failed}`);
    if (s.redFlagsFound != null) parts.push(`Red flags: ${s.redFlagsFound}`);
    if (s.badgesAwarded != null) parts.push(`Badges: ${s.badgesAwarded}`);
  } else if (run.script === "request-indexing") {
    if (s.sitemapSubmitted != null) parts.push(`Sitemap: ${s.sitemapSubmitted ? "✓" : "✗"}`);
    if (s.indexingSubmitted != null) parts.push(`Indexed: ${s.indexingSubmitted}`);
    if (s.indexingErrors != null && (s.indexingErrors as number) > 0) parts.push(`Errors: ${s.indexingErrors}`);
    if (s.urlsRequested != null) parts.push(`URLs: ${s.urlsRequested}`);
    if (s.quotaExhausted) parts.push("Quota exhausted");
  } else if (run.script === "outscraper-reviews") {
    if (s.creditsExhausted) parts.push("⚠ OUT OF CREDITS");
    else if (s.outscraperStatus === "all_failed") parts.push("⚠ ALL FAILED");
    else if (s.outscraperStatus === "fatal_error") parts.push("⚠ FATAL ERROR");
    if (s.plumbersProcessed != null) parts.push(`Plumbers: ${s.plumbersProcessed}`);
    if (s.outscraperAttemptCount != null) {
      parts.push(`Attempts: ${s.outscraperAttemptCount} (${s.outscraperSuccessCount || 0} ok / ${s.outscraperFailureCount || 0} fail)`);
    }
    if (s.newReviews != null) parts.push(`New reviews: ${s.newReviews}`);
    const sources = [
      s.googleReviews ? `G:${s.googleReviews}` : "",
      s.yelpReviews ? `Y:${s.yelpReviews}` : "",
      s.angiReviews ? `A:${s.angiReviews}` : "",
    ].filter(Boolean).join(" ");
    if (sources) parts.push(sources);
    if (s.synthesized != null) parts.push(`Synthesized: ${s.synthesized}`);
    if (s.estimatedCost) parts.push(`Cost: ${s.estimatedCost}`);
    if (s.citySlugs) parts.push(`Cities: ${(s.citySlugs as string[]).join(", ")}`);
    if (s.fatalError) parts.push(`Error: ${String(s.fatalError).slice(0, 80)}`);
  } else if (run.script === "bbb-lookup") {
    if (s.plumbersLookedUp != null) parts.push(`Looked up: ${s.plumbersLookedUp}`);
    if (s.matchedOnBBB != null) parts.push(`Matched: ${s.matchedOnBBB}`);
    if (s.notFoundOnBBB != null) parts.push(`Not found: ${s.notFoundOnBBB}`);
    if (s.accredited != null) parts.push(`Accredited: ${s.accredited}`);
    if (s.citySlugs) parts.push(`Cities: ${(s.citySlugs as string[]).join(", ")}`);
  } else if (run.script === "export-json") {
    if (s.plumbersUpdated != null) parts.push(`Updated: ${s.plumbersUpdated}`);
    if (s.plumbersAdded != null && (s.plumbersAdded as number) > 0) parts.push(`Added: ${s.plumbersAdded}`);
    if (s.pushed != null) parts.push(s.pushed ? "Pushed" : "Local only");
    if (s.citiesAffected) parts.push(`${(s.citiesAffected as string[]).length} cities`);
  } else if (run.script === "generate-blog") {
    if (s.totalPosts != null) parts.push(`Posts: ${s.totalPosts}`);
    if (s.rankings != null) parts.push(`Rankings: ${s.rankings}`);
    if (s.guides != null) parts.push(`Guides: ${s.guides}`);
    if (s.emergencyTips != null) parts.push(`Tips: ${s.emergencyTips}`);
    if (s.service != null) parts.push(`Service: ${s.service}`);
    if (s.redFlags != null) parts.push(`Red flags: ${s.redFlags}`);
    if (s.cities != null) parts.push(`Cities: ${s.cities}`);
  } else if (run.script === "resynthesize-emergency") {
    if (s.synthesized != null) parts.push(`Synthesized: ${s.synthesized}`);
    if (s.before) parts.push(`Before: ${(s.before as Record<string, number>).unknown || 0} unknown`);
    if (s.after) {
      const a = s.after as Record<string, number>;
      parts.push(`After: ${a.high || 0} high, ${a.medium || 0} med, ${a.unknown || 0} unk`);
    }
    if (s.failed != null && (s.failed as number) > 0) parts.push(`Failed: ${s.failed}`);
  }

  return parts.join(" · ") || "No details";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlumberDetailRow({ p }: { p: Record<string, any> }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] py-0.5">
      <span className="font-medium text-gray-700 min-w-[140px]">{p.name}</span>
      {/* Outscraper review details */}
      {p.reviews && (
        <span className="text-gray-400">
          G:{p.reviews.google || 0} Y:{p.reviews.yelp || 0}
        </span>
      )}
      {p.synthesized === true && <span className="text-green-600">synthesized</span>}
      {p.badges && (p.badges as string[]).length > 0 && (
        <span className="text-green-600">{(p.badges as string[]).join(", ")}</span>
      )}
      {p.redFlagsCount != null && (p.redFlagsCount as number) > 0 && (
        <span className="text-red-600">{p.redFlagsCount} red flags</span>
      )}
      {p.hasBBB && <span className="text-yellow-600">BBB</span>}
      {/* BBB details */}
      {p.matched === true && p.rating && (
        <span className="text-gray-500">BBB {p.rating}{p.accredited ? " Accredited" : ""}</span>
      )}
      {p.matched === true && p.complaints3yr != null && (p.complaints3yr as number) > 0 && (
        <span className="text-amber-600">{p.complaints3yr} complaints</span>
      )}
      {p.matched === false && <span className="text-gray-400">not on BBB</span>}
      {/* Skipped / error */}
      {p.skipped && <span className="text-gray-400">skipped</span>}
      {p.error && <span className="text-red-500">error: {p.error}</span>}
    </div>
  );
}

const SITE_ORIGIN = "https://www.fastplumbernearme.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExpandableList({ items, renderItem, label, initialShow = 5 }: { items: any[]; renderItem: (item: any, i: number) => React.ReactNode; label: string; initialShow?: number }) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;
  const visible = showAll ? items : items.slice(0, initialShow);
  const remaining = items.length - initialShow;

  return (
    <div className="pt-1">
      <div className="text-[11px] font-medium text-gray-500 mb-0.5">{label}:</div>
      {visible.map((item, i) => <div key={i}>{renderItem(item, i)}</div>)}
      {remaining > 0 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-[11px] text-blue-600 hover:underline mt-0.5">
          Show all ({items.length})
        </button>
      )}
    </div>
  );
}

function PlumberLink({ name, slug }: { name: string; slug: string }) {
  return (
    <a href={`${SITE_ORIGIN}/plumber/${slug}`} target="_blank" rel="noopener" className="text-[11px] text-blue-600 hover:underline">
      {name}
    </a>
  );
}

function RunDetails({ run }: { run: PipelineRun }) {
  const s = run.summary;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details = (s.plumberDetails || []) as Record<string, any>[];
  const urls = (s.urls || []) as string[];
  const slugPaths = (s.slugPaths || []) as string[];
  const cities = (s.citiesAffected || []) as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newPlumberDetails = (s.newPlumberDetails || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdPlumbers = (s.createdPlumbers || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refreshedPlumbers = (s.refreshedPlumbers || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const synthesizedPlumbers = (s.synthesizedPlumbers || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = (s.errors || []) as Record<string, any>[];
  // fpnm-002: per-attempt outscraper log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outscraperAttempts = (s.outscraperAttempts || []) as Record<string, any>[];

  const hasContent = details.length > 0 || urls.length > 0 || cities.length > 0 ||
    newPlumberDetails.length > 0 || createdPlumbers.length > 0 ||
    refreshedPlumbers.length > 0 || synthesizedPlumbers.length > 0 || errors.length > 0 ||
    outscraperAttempts.length > 0;

  if (!hasContent) return null;

  return (
    <div className="mt-2 ml-0.5 pl-3 border-l-2 border-gray-100 space-y-1">
      {/* Legacy plumber details (outscraper, bbb, etc.) */}
      {details.length > 0 && details.map((p, i) => <PlumberDetailRow key={i} p={p} />)}

      {/* request-indexing: show submitted URLs with links + exact GSC URL */}
      {(urls.length > 0 || slugPaths.length > 0) && (
        <ExpandableList
          items={slugPaths.length > 0 ? slugPaths.map((sp, i) => ({ slug: sp, fullUrl: urls[i] })) : urls.map((u) => ({ slug: u.replace(/^https?:\/\/[^/]+/, ""), fullUrl: u }))}
          label="Indexed URLs"
          renderItem={(item) => (
            <div className="flex items-center gap-2 text-[11px] py-0.5">
              <a href={`${SITE_ORIGIN}${item.slug}`} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                {item.slug}
              </a>
              {item.fullUrl && (
                <span className="text-gray-300 text-[10px]" title={item.fullUrl}>
                  GSC: {item.fullUrl}
                </span>
              )}
            </div>
          )}
        />
      )}

      {/* daily-scrape: new plumber details */}
      {newPlumberDetails.length > 0 && (
        <ExpandableList
          items={newPlumberDetails}
          label="New plumbers"
          renderItem={(p) => (
            <div className="flex items-center gap-2 text-[11px] py-0.5">
              <PlumberLink name={p.name} slug={p.slug} />
              {p.city && p.state && (
                <a href={`${SITE_ORIGIN}/emergency-plumbers/${p.state.toLowerCase()}/${p.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} target="_blank" rel="noopener" className="text-gray-400 hover:text-gray-600">
                  {p.city}, {p.state}
                </a>
              )}
            </div>
          )}
        />
      )}

      {/* upload-firestore: created plumbers */}
      {createdPlumbers.length > 0 && (
        <ExpandableList
          items={createdPlumbers}
          label="Created plumbers"
          renderItem={(p) => (
            <div className="flex items-center gap-2 text-[11px] py-0.5">
              <PlumberLink name={p.name} slug={p.slug} />
              {p.city && <span className="text-gray-400">{p.city}, {p.state}</span>}
            </div>
          )}
        />
      )}

      {/* refresh-reviews: refreshed plumbers */}
      {refreshedPlumbers.length > 0 && (
        <ExpandableList
          items={refreshedPlumbers}
          label="Refreshed plumbers"
          renderItem={(p) => (
            <div className="flex items-center gap-2 text-[11px] py-0.5">
              <PlumberLink name={p.name} slug={p.slug} />
              {p.newReviews > 0 && <span className="text-green-600">+{p.newReviews} reviews</span>}
              {p.newReviews === 0 && <span className="text-gray-400">0 new</span>}
            </div>
          )}
        />
      )}

      {/* synthesize-reviews: synthesized plumbers */}
      {synthesizedPlumbers.length > 0 && (
        <ExpandableList
          items={synthesizedPlumbers}
          label="Synthesized plumbers"
          renderItem={(p) => (
            <div className="flex items-center gap-2 text-[11px] py-0.5">
              <PlumberLink name={p.name} slug={p.slug} />
              {p.method && <span className="text-gray-400">{p.method}</span>}
            </div>
          )}
        />
      )}

      {/* synthesize-reviews: errors */}
      {errors.length > 0 && (
        <ExpandableList
          items={errors}
          label="Errors"
          initialShow={10}
          renderItem={(e) => (
            <div className="flex items-center gap-2 text-[11px] py-0.5">
              <PlumberLink name={e.name} slug={e.slug} />
              <span className="text-red-500">{e.error}</span>
            </div>
          )}
        />
      )}

      {/* fpnm-002: outscraper per-attempt log */}
      {outscraperAttempts.length > 0 && (
        <ExpandableList
          items={outscraperAttempts}
          label="Outscraper attempts"
          initialShow={10}
          renderItem={(a) => {
            const statusColor =
              a.status === "out_of_credits" ? "text-red-600 font-semibold" :
              a.status === "error" ? "text-red-500" :
              a.status === "no_reviews" ? "text-gray-400" :
              "text-green-600";
            const statusLabel =
              a.status === "out_of_credits" ? "out of credits" :
              a.status === "no_reviews" ? "no reviews" :
              a.status;
            return (
              <div className="flex items-center gap-2 text-[11px] py-0.5 flex-wrap">
                <span className="text-gray-400 uppercase text-[10px] min-w-[40px]">{a.source}</span>
                <span className="text-gray-700">{a.plumberName || "(unknown)"}</span>
                {a.citySlug && <span className="text-gray-400">{a.citySlug}</span>}
                <span className={statusColor}>{statusLabel}</span>
                {a.reviewsPulled > 0 && <span className="text-gray-500">+{a.reviewsPulled}</span>}
                {a.errorMessage && (
                  <span className="text-red-500 truncate max-w-[400px]" title={a.errorMessage}>
                    {a.errorMessage}
                  </span>
                )}
              </div>
            );
          }}
        />
      )}

      {/* Legacy cities display */}
      {cities.length > 0 && details.length === 0 && newPlumberDetails.length === 0 && (
        <div className="text-[11px] text-gray-400">
          Cities: {cities.join(", ")}
        </div>
      )}
    </div>
  );
}

export default function AdminActivityPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [plumberCount, setPlumberCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [apiUsage, setApiUsage] = useState<ApiUsage | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(["Today"]));
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      if (!db) { setLoading(false); return; }
      try {
        // Pipeline runs (last 200)
        const runsSnap = await getDocs(query(collection(db, "pipelineRuns"), orderBy("startedAt", "desc"), limit(200)));
        setRuns(runsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as PipelineRun));

        // Stats
        const plumberSnap = await getCountFromServer(collection(db, "plumbers"));
        setPlumberCount(plumberSnap.data().count);

        const reviewSnap = await getCountFromServer(collection(db, "reviews"));
        setReviewCount(reviewSnap.data().count);

        // API usage this month
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const usageSnap = await getDocs(collection(db, "apiUsage"));
        const usageDoc = usageSnap.docs.find((d) => d.id === monthKey);
        if (usageDoc) {
          const data = usageDoc.data();
          setApiUsage({ estimatedCost: data.estimatedCost || 0, totalCalls: data.totalCalls || 0 });
        }
      } catch (err) {
        console.error("Failed to load activity:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  // Group runs by day
  const today = new Date();
  const todayRuns = runs.filter((r) => r.startedAt?.toDate?.()?.toDateString() === today.toDateString());
  const todaySuccess = todayRuns.filter((r) => r.status === "success").length;
  const todayNewReviews = todayRuns.reduce((sum, r) => sum + ((r.summary.newReviewsCached as number) || 0), 0);

  const dayGroups = new Map<string, PipelineRun[]>();
  for (const run of runs) {
    const date = run.startedAt?.toDate?.();
    if (!date) continue;
    const label = formatDate(date);
    if (!dayGroups.has(label)) dayGroups.set(label, []);
    dayGroups.get(label)!.push(run);
  }

  function toggleDay(label: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pipeline Activity</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard icon={<Database className="w-5 h-5" />} label="Plumbers" value={plumberCount.toLocaleString()} />
        <StatCard icon={<FileText className="w-5 h-5" />} label="Cached Reviews" value={reviewCount.toLocaleString()} />
        <StatCard icon={<Zap className="w-5 h-5" />} label="Runs Today" value={`${todaySuccess}/${todayRuns.length}`} subtitle={todayNewReviews > 0 ? `${todayNewReviews} new reviews` : undefined} />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="API Budget" value={apiUsage ? `$${apiUsage.estimatedCost.toFixed(2)}` : "—"} subtitle="of $200/mo" />
      </div>

      {/* Daily logs */}
      {runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No pipeline runs yet. Run a script to see activity here.
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(dayGroups.entries()).map(([label, dayRuns]) => {
            const expanded = expandedDays.has(label);
            const successes = dayRuns.filter((r) => r.status === "success").length;
            const failures = dayRuns.filter((r) => r.status === "error").length;
            const newRevs = dayRuns.reduce((s, r) => s + ((r.summary.newReviewsCached as number) || 0), 0);

            return (
              <div key={label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleDay(label)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-semibold text-gray-900 text-sm">{label}</span>
                    <span className="text-xs text-gray-400">
                      {dayRuns.length} run{dayRuns.length !== 1 ? "s" : ""}
                      {successes > 0 && ` · ${successes} ok`}
                      {failures > 0 && ` · ${failures} failed`}
                      {newRevs > 0 && ` · ${newRevs} new reviews`}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {dayRuns.map((run) => {
                      const scriptInfo = scriptLabels[run.script] || { label: run.script, color: "bg-gray-100 text-gray-700" };
                      const time = run.startedAt?.toDate?.();
                      const hasDetails = (run.summary.plumberDetails as unknown[])?.length > 0 ||
                        (run.summary.urls as unknown[])?.length > 0 ||
                        (run.summary.slugPaths as unknown[])?.length > 0 ||
                        (run.summary.citiesAffected as unknown[])?.length > 0 ||
                        (run.summary.newPlumberDetails as unknown[])?.length > 0 ||
                        (run.summary.createdPlumbers as unknown[])?.length > 0 ||
                        (run.summary.refreshedPlumbers as unknown[])?.length > 0 ||
                        (run.summary.synthesizedPlumbers as unknown[])?.length > 0 ||
                        (run.summary.errors as unknown[])?.length > 0 ||
                        (run.summary.outscraperAttempts as unknown[])?.length > 0;
                      // fpnm-002: surface credit exhaustion at-a-glance
                      const creditsOut = run.summary.creditsExhausted === true;
                      const isExpanded = expandedRuns.has(run.id);

                      return (
                        <div key={run.id} className="px-4 py-3">
                          <div
                            className={`flex items-center gap-2 flex-wrap ${hasDetails ? "cursor-pointer" : ""}`}
                            onClick={() => {
                              if (!hasDetails) return;
                              setExpandedRuns((prev) => {
                                const next = new Set(prev);
                                if (next.has(run.id)) next.delete(run.id); else next.add(run.id);
                                return next;
                              });
                            }}
                          >
                            {hasDetails && (
                              isExpanded
                                ? <ChevronDown className="w-3 h-3 text-gray-300" />
                                : <ChevronRight className="w-3 h-3 text-gray-300" />
                            )}
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${scriptInfo.color}`}>
                              {scriptInfo.label}
                            </span>
                            <span className="text-xs text-gray-400">
                              {time ? formatTime(time) : "—"} · {formatDuration(run.durationSeconds)}
                            </span>
                            {run.status === "success" && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                            {run.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                            {run.status === "partial" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                            {creditsOut && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                OUT OF CREDITS
                              </span>
                            )}
                            {run.triggeredBy === "github-actions" && (
                              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">auto</span>
                            )}
                          </div>
                          <div className="mt-1 ml-0.5">
                            <span className="text-xs text-gray-500">{getRunSummaryLine(run)}</span>
                          </div>
                          {run.error && (
                            <p className="text-xs text-red-600 mt-1 ml-0.5 line-clamp-2">{run.error}</p>
                          )}
                          {isExpanded && <RunDetails run={run} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function StatCard({ icon, label, value, subtitle }: { icon: React.ReactNode; label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
