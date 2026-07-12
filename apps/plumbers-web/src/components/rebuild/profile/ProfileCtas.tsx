"use client";

import { PhoneIcon } from "../icons";

/**
 * Profile CTA row — Call (tel:) + Website. Client component solely for the
 * first-party lead beacon (clicks → /api/track-lead, same wire as the old
 * page). Styling is the rebuild system: CTA blue, hairline secondary.
 */
export default function ProfileCtas({
  telHref,
  phoneLabel,
  website,
  slug,
  name,
  city,
  state,
  phone,
}: {
  telHref: string;
  phoneLabel: string;
  website: string | null;
  slug: string;
  name: string;
  city: string;
  state: string;
  phone: string;
}) {
  function track(clickType: "call" | "website") {
    fetch("/api/track-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plumberId: slug,
        plumberName: name,
        plumberPhone: phone,
        city,
        state,
        pageUrl: `/plumber/${slug}`,
        clickType,
        source: `/plumber/${slug}`,
      }),
    }).catch(() => {});
  }

  return (
    <div className="pf-cta">
      <a className="call-btn" href={telHref} onClick={() => track("call")}>
        <PhoneIcon size={19} />
        <span className="num">Call {phoneLabel}</span>
      </a>
      {website && (
        <a
          className="site-btn"
          href={website}
          target="_blank"
          rel="nofollow noopener"
          onClick={() => track("website")}
        >
          Website ↗
        </a>
      )}
      <p className="call-sub">You call them directly — we don&apos;t sell your info or route the call.</p>
    </div>
  );
}
