"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneIcon } from "./icons";

/**
 * Mobile sticky call bar (02 §4): appears only after the user scrolls past
 * the ranked #1 card, always binds to the ranked #1 (NEVER the sponsor — a
 * sticky sponsored call would be an undisclosed ad impression). Dismissible,
 * hidden >=720px (CSS), safe-area padded. Progressive enhancement only.
 */
export default function StickyCallBar({
  name,
  telHref,
  targetId,
  is24Hour,
  capLabel,
}: {
  name: string;
  telHref: string;
  targetId: string;
  is24Hour: boolean;
  /** Override for the small cap line (profile pages pass the verdict). */
  capLabel?: string;
}) {
  const [show, setShow] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const onScroll = () => {
      if (dismissed.current || window.innerWidth >= 720) {
        setShow(false);
        return;
      }
      const r = target.getBoundingClientRect();
      setShow(r.bottom < 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetId]);

  if (!show) return null;

  return (
    <div
      className="fpn-sticky-call show"
      role="complementary"
      aria-label="Quick call our number one pick"
    >
      <div className="sticky-meta">
        <div className="cap">
          {capLabel ?? "#1 our pick"}
          {is24Hour ? " · 24/7 per Google listing" : ""}
        </div>
        <div className="nm">{name}</div>
      </div>
      <a className="call-btn" href={telHref}>
        <PhoneIcon size={17} />
        Call
      </a>
      <button
        className="sticky-x"
        aria-label="Dismiss"
        onClick={() => {
          dismissed.current = true;
          setShow(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
