export type PageType = "service" | "symptom" | "intent";

export type ScoringStrategy<
  SpecialtyKey extends string = string,
  DimensionKey extends string = string,
> =
  | { kind: "specialty"; key: SpecialtyKey }
  | { kind: "dimension"; sortBy: DimensionKey }
  | { kind: "signal"; field: string; value: unknown }
  | { kind: "mapped"; serviceKeys: SpecialtyKey[] };

export interface PageConfig<
  SpecialtyKey extends string = string,
  DimensionKey extends string = string,
> {
  /** Unique ID; usually matches the URL slug. */
  slug: string;
  type: PageType;
  /** Directory-specific scoring strategy. */
  scoring: ScoringStrategy<SpecialtyKey, DimensionKey>;
  /** Display name for H1, titles, and navigation labels. */
  displayName: string;
  /** Short pain-point hook for hero sections. */
  heroHook: string;
  /** Bridge to vertical-specific review/service mention data. */
  serviceMentionedKeys: string[];
  /** Scenario cards specific to this page. */
  emergencyTypes: { title: string; description: string }[];
  /** FAQ templates; apps decide which tokens are supported. */
  faqTemplates: { question: string; answer: string }[];
  /** Related page slugs for cross-linking. */
  relatedServices: string[];
}
