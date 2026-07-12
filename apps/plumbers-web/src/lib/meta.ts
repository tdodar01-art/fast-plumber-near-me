/**
 * Metadata formula helpers (spec C8/C9 + 01 §6.1): titles measured <=60,
 * descriptions measured <=155, degrading through real fallbacks instead of
 * mid-word truncation wherever possible.
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/**
 * First candidate that fits the 60-char title budget; if none fit (very long
 * city/business names), the last candidate wins as-is — formulas degrade
 * through progressively shorter real variants, never to an empty title.
 */
export function fitTitle(...candidates: string[]): string {
  for (const c of candidates) {
    if (c.length <= TITLE_MAX) return c;
  }
  return candidates[candidates.length - 1];
}

/**
 * Clamp a description to 155 chars at a word boundary. Formulas below are
 * built from real data and normally fit; this is the guard rail, not the
 * writing strategy.
 */
export function fitDescription(text: string): string {
  const t = text.trim();
  if (t.length <= DESCRIPTION_MAX) return t;
  const cut = t.slice(0, DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : DESCRIPTION_MAX - 1).replace(/[,;:—–-]$/, "")}…`;
}

/** OG image URL (existing edge generator) — heading + brand strip variants. */
export function ogImagePath(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  return `/api/og?${qs.toString()}`;
}
