import type { SynthesizedPlumber } from "@/lib/plumber-data";
import type { HoursRow, NearbyMarketLink } from "@/lib/profile-dossier";
import { formatPhone, telHref } from "@/lib/report-card";
import Link from "next/link";

function websiteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Business facts (03 §3.8) — right rail on desktop, below the dossier on
 * mobile. Only rows with data render; no "Unknown" filler. Hours and 24-hour
 * status are LISTING claims, qualified "per their Google listing". Years in
 * business renders only when BBB supplies it, with its source qualifier.
 */
export default function FactsPanel({
  plumber: p,
  hours,
  services,
  nearby,
  scrapedLabel,
  analysisLabel,
}: {
  plumber: SynthesizedPlumber;
  hours: HoursRow[] | null;
  services: string[];
  nearby: NearbyMarketLink[];
  scrapedLabel: string | null;
  analysisLabel: string | null;
}) {
  return (
    <div className="facts">
      <h2>Business facts</h2>

      {p.phone && (
        <div className="frow">
          <span className="k">Phone</span>
          <span className="v num">
            <a href={telHref(p.phone)}>
              <b>{formatPhone(p.phone)}</b>
            </a>
          </span>
        </div>
      )}

      {p.website && (
        <div className="frow">
          <span className="k">Website</span>
          <span className="v">
            <a href={p.website} rel="nofollow noopener" target="_blank">
              {websiteHost(p.website)} ↗
            </a>
          </span>
        </div>
      )}

      {p.address && (
        <div className="frow">
          <span className="k">Address</span>
          <span className="v">{p.address}</span>
        </div>
      )}

      {(hours || p.is24Hour) && (
        <div className="frow">
          <span className="k">Hours</span>
          <span className="v">
            {p.is24Hour ? (
              <>
                <b>Open 24 hours</b>
                <br />
                <span className="qualifier">per their Google listing</span>
              </>
            ) : hours ? (
              <details className="hours">
                <summary>Weekly hours ▾</summary>
                <table>
                  <tbody>
                    {hours.map((h) => (
                      <tr key={h.day}>
                        <td>{h.day}</td>
                        <td>{h.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="qualifier">Per their Google listing</p>
              </details>
            ) : null}
          </span>
        </div>
      )}

      {services.length > 0 && (
        <div className="frow">
          <span className="k">Services</span>
          <span className="v">
            <span className="chips" style={{ justifyContent: "flex-end" }}>
              {services.map((s) => (
                <span key={s} className="chip plain">
                  {s}
                </span>
              ))}
            </span>
            <span className="qualifier">named in the reviews we analyzed</span>
          </span>
        </div>
      )}

      {p.bbb && (p.bbb.rating || p.bbb.accredited || p.bbb.yearsInBusiness != null) && (
        <div className="frow">
          <span className="k">BBB</span>
          <span className="v">
            {p.bbb.rating && <b>{p.bbb.rating}</b>}
            {p.bbb.accredited ? (p.bbb.rating ? " · Accredited" : "Accredited") : ""}
            {p.bbb.complaintsPast3Years != null && p.bbb.complaintsPast3Years > 0 && (
              <>
                <br />
                <span className="num">
                  {p.bbb.complaintsPast3Years} complaint
                  {p.bbb.complaintsPast3Years === 1 ? "" : "s"} (3 yr)
                </span>
              </>
            )}
            {p.bbb.yearsInBusiness != null && (
              <>
                <br />
                <span className="num">{p.bbb.yearsInBusiness} years in business</span>
              </>
            )}
            <br />
            <span className="qualifier">per BBB profile</span>
          </span>
        </div>
      )}

      {nearby.length > 0 && (
        <div className="frow frow-block">
          <span className="k">Service area</span>
          <p className="qualifier" style={{ marginTop: 4 }}>
            Based in {p.city}. Plumbers typically serve a ~20-mile radius — around here that
            covers{" "}
            {nearby.map((m, i) => (
              <span key={`${m.st}/${m.slug}`}>
                {i > 0 && ", "}
                <Link href={`/plumbers/${m.st}/${m.slug}`}>{m.name}</Link>
              </span>
            ))}
            . That&apos;s a typical radius, not a promise — call to confirm they cover you.
          </p>
        </div>
      )}

      <p className="freshness">
        {scrapedLabel && (
          <>
            Business data from Google · pulled {scrapedLabel}.
            <br />
          </>
        )}
        {analysisLabel && <>Review analysis updated {analysisLabel}.</>}
      </p>
    </div>
  );
}
