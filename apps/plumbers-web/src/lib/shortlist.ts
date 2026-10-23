/** National matching is independent of geography; candidates come from each market. */
export const JOBS = [
  {
    id: "any",
    label: "Help me choose",
    category: null,
    question:
      "What is the dispatch fee, and will you provide a written estimate before starting?",
  },
  {
    id: "drain",
    label: "Blocked drain",
    category: "drain-cleaning",
    question:
      "Does the quoted drain-clearing price include a camera inspection or a return visit?",
  },
  {
    id: "heater",
    label: "Water heater",
    category: "water-heater",
    question:
      "Does the estimate include removal, permits, parts, labor, and the installation warranty?",
  },
  {
    id: "leak",
    label: "Leaking or burst pipe",
    category: "burst-pipe",
    question:
      "How do you charge for finding the leak, repairing it, and accessing the pipe?",
  },
  {
    id: "sewer",
    label: "Sewer problem",
    category: "sewer",
    question:
      "Can you document the diagnosis and explain repair options before I authorize excavation?",
  },
  {
    id: "sump",
    label: "Sump pump",
    category: "sump-pump",
    question:
      "Does the estimate include testing, disposal, and any backup system?",
  },
  {
    id: "toilet",
    label: "Toilet repair",
    category: "toilet",
    question:
      "Can this be repaired, and what would replacement cost including installation?",
  },
] as const;
export type JobId = (typeof JOBS)[number]["id"];
export interface ShortlistCandidate {
  id: string;
  name: string;
  slug: string;
  phone: string;
  website: string | null;
  rating: number | null;
  googleCount: number;
  analyzed: number;
  quotes: number;
  evidenceCurrent: boolean;
  active: boolean;
  is24Hour: boolean;
  verdict: string | null;
  score: number;
  services: Record<string, number>;
  concern: string | null;
  updated: string | null;
  fairDealing: string[];
  repeatedSalesConcern: boolean;
  needsEditorialReview: boolean;
  reliability: number | null;
  pricing: number | null;
}
export function getJob(id: string) {
  return JOBS.find((j) => j.id === id) ?? JOBS[0];
}
export function confidence(p: ShortlistCandidate): string {
  if (p.analyzed < 10 || p.quotes < 3) return "Limited review evidence";
  return `${p.analyzed} reviews analyzed · ${p.quotes} supporting quotes`;
}
export function selectShortlist(
  candidates: ShortlistCandidate[],
  jobId: string,
  afterHours: boolean,
) {
  const job = getJob(jobId);
  return candidates
    .filter(
      (p) =>
        p.phone &&
        p.active &&
        p.evidenceCurrent &&
        p.verdict !== "avoid" &&
        p.analyzed >= 10 &&
        p.quotes >= 3 &&
        p.fairDealing.length > 0 &&
        !p.repeatedSalesConcern &&
        !p.needsEditorialReview,
    )
    .filter((p) => !afterHours || p.is24Hour)
    .filter((p) => !job.category || (p.services[job.category] ?? 0) > 0)
    .sort((a, b) => {
      // Adequate review coverage precedes model score. Job counts break ties.
      const coverage =
        Number(b.analyzed >= 10 && b.quotes >= 3) -
        Number(a.analyzed >= 10 && a.quotes >= 3);
      const trust = b.fairDealing.length - a.fairDealing.length;
      const fairScore = (b.pricing ?? 0) - (a.pricing ?? 0);
      const reliability = (b.reliability ?? 0) - (a.reliability ?? 0);
      return (
        coverage ||
        trust ||
        fairScore ||
        reliability ||
        (job.category
          ? b.services[job.category] - a.services[job.category]
          : 0) ||
        b.score - a.score ||
        a.name.localeCompare(b.name)
      );
    })
    .slice(0, 3);
}
