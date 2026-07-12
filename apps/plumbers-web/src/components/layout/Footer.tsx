import Link from "next/link";
import { getMarketsByState } from "@/lib/markets";
import { getStateByAbbr } from "@/lib/states-data";

// Top 10 states by market count (01 §4: footer links states, not cities).
const stateLinks = [...getMarketsByState().entries()]
  .map(([st, markets]) => ({
    name: getStateByAbbr(st)?.name ?? st.toUpperCase(),
    href: `/plumbers/${st}`,
    count: markets.length,
  }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  .slice(0, 10);

/**
 * Site footer — rebuild design: hairline top rule, link row, independence
 * disclaimer, top-10 state links. No badges, no 44k-link farm.
 */
export default function Footer() {
  return (
    <footer className="fpn fpn-site-footer">
      <div className="wrap-wide">
        <div className="foot-links">
          <Link href="/methodology">How we rank</Link>
          <Link href="/methodology#sponsored">How we make money</Link>
          <Link href="/about">About</Link>
          <Link href="/add-your-business">For plumbers</Link>
          <Link href="/blog">Guides</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy-policy">Privacy</Link>
        </div>
        <p>
          Fast Plumber Near Me is an independent review service. We are not affiliated with any
          plumbing business listed. Star ratings and review counts come from Google and Yelp; our
          summaries are opinions grounded in the customer reviews we quote and cite.
        </p>
        <div className="foot-states">
          <span>Browse by state:</span>
          {stateLinks.map((s) => (
            <Link key={s.href} href={s.href}>
              {s.name}
            </Link>
          ))}
          <Link href="/plumbers">All states →</Link>
        </div>
        <p className="foot-tagline">The reviews, read honestly.</p>
        <p style={{ marginTop: 10 }}>
          © {new Date().getFullYear()} Fast Plumber Near Me ·{" "}
          <a href="mailto:info@fastplumbernearme.com">info@fastplumbernearme.com</a>
        </p>
      </div>
    </footer>
  );
}
