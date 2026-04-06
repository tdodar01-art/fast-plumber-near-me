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
  "fetch-plumbers": { label: "fetch-plumbers", color: "bg-blue-100 text-blue-700" },
  "refresh-reviews": { label: "refresh-reviews", color: "bg-purple-100 text-purple-700" },
  "synthesize-reviews": { label: "synthesize-reviews", color: "bg-green-100 text-green-700" },
  "request-indexing": { label: "request-indexing", color: "bg-orange-100 text-orange-700" },
  "outscraper-reviews": { label: "outscraper-reviews", color: "bg-pink-100 text-pink-700" },
};

function RunSummary({ run }: { run: PipelineRun }) {
  const s = run.summary;
  const parts: string[] = [];

  if (run.script === "fetch-plumbers") {
    if (s.citiesSearched) parts.push(`Searched: ${(s.citiesSearched as string[]).join(", ")}`);
    if (s.newPlumbers != null) parts.push(`New: ${s.newPlumbers}`);
    if (s.updatedPlumbers != null) parts.push(`Updated: ${s.updatedPlumbers}`);
    if (s.apiCalls != null) parts.push(`API calls: ${s.apiCalls}`);
  } else if (run.script === "refresh-reviews") {
    if (s.plumbersRefreshed != null) parts.push(`Refreshed: ${s.plumbersRefreshed}`);
    if (s.newReviewsCached != null) parts.push(`New reviews: ${s.newReviewsCached}`);
    if (s.totalReviewsNow != null) parts.push(`Total cached: ${s.totalReviewsNow}`);
  } else if (run.script === "synthesize-reviews") {
    if (s.plumbersSynthesized != null) parts.push(`Synthesized: ${s.plumbersSynthesized}`);
    if (s.redFlagsFound != null) parts.push(`Red flags: ${s.redFlagsFound}`);
    if (s.badgesAwarded != null) parts.push(`Badges: ${s.badgesAwarded}`);
  } else if (run.script === "request-indexing") {
    if (s.sitemapSubmitted != null) parts.push(`Sitemap: ${s.sitemapSubmitted ? "✓" : "✗"}`);
    if (s.indexingSubmitted != null) parts.push(`Indexed: ${s.indexingSubmitted}`);
    if (s.indexingErrors != null && (s.indexingErrors as number) > 0) parts.push(`Errors: ${s.indexingErrors}`);
    if (s.urlsRequested != null) parts.push(`URLs: ${s.urlsRequested}`);
    if (s.quotaExhausted) parts.push("Quota exhausted");
  } else if (run.script === "outscraper-reviews") {
    if (s.plumbersProcessed != null) parts.push(`Plumbers: ${s.plumbersProcessed}`);
    if (s.newReviews != null) parts.push(`New reviews: ${s.newReviews}`);
    if (s.synthesized != null) parts.push(`Synthesized: ${s.synthesized}`);
    if (s.estimatedCost) parts.push(`Cost: ${s.estimatedCost}`);
    if (s.citySlugs) parts.push(`Cities: ${(s.citySlugs as string[]).join(", ")}`);
  }

  return <span className="text-xs text-gray-500">{parts.join(" · ") || "No details"}</span>;
}

export default function AdminActivityPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [plumberCount, setPlumberCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [apiUsage, setApiUsage] = useState<ApiUsage | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(["Today"]));

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

                      return (
                        <div key={run.id} className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${scriptInfo.color}`}>
                              {scriptInfo.label}
                            </span>
                            <span className="text-xs text-gray-400">
                              {time ? formatTime(time) : "—"} · {formatDuration(run.durationSeconds)}
                            </span>
                            {run.status === "success" && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                            {run.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                            {run.status === "partial" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                            {run.triggeredBy === "github-actions" && (
                              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">auto</span>
                            )}
                          </div>
                          <div className="mt-1 ml-0.5">
                            <RunSummary run={run} />
                          </div>
                          {run.error && (
                            <p className="text-xs text-red-600 mt-1 ml-0.5 line-clamp-2">{run.error}</p>
                          )}
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
