/**
 * Areas served — PLAIN TEXT, no links (01 §4: suburb names collapsed into
 * this market never link anywhere; their URLs 301 here).
 */
export default function AreasServed({
  cityName,
  clusterCities,
}: {
  cityName: string;
  clusterCities: string[];
}) {
  if (clusterCities.length === 0) return null;
  return (
    <section className="areas">
      <h2>Areas served</h2>
      <p>
        The plumbers on this page also serve {clusterCities.join(", ")} — this {cityName} guide
        covers those areas.
      </p>
    </section>
  );
}
