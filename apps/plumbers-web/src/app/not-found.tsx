import Link from "next/link";
import type { Metadata } from "next";

/** 404 — 04 §6 copy. */

export const metadata: Metadata = {
  title: "Page Not Found",
  description:
    "The page you're looking for doesn't exist — it may have been removed when we rebuilt the site to cut thin pages. Browse plumbers by city instead.",
};

export default function NotFound() {
  return (
    <div className="fpn">
      <div className="wrap trust" style={{ paddingTop: 40, paddingBottom: 64 }}>
        <h1>This page has left for another job.</h1>
        <p className="lede">
          The page you&apos;re looking for doesn&apos;t exist — it may have been removed when we
          rebuilt the site to cut thin pages and keep only listings we can stand behind.
        </p>
        <ul>
          <li>
            <Link href="/">Search for plumbers near you</Link> — 6,000+ companies, reviews read
            and summarized
          </li>
          <li>
            <Link href="/plumbers">Browse by state</Link>
          </li>
          <li>
            <Link href="/methodology">How we rate plumbers</Link>
          </li>
        </ul>
        <p>
          If a link on our own site brought you here, <Link href="/contact">tell us</Link> — we
          fix broken pipes of all kinds.
        </p>
      </div>
    </div>
  );
}
