import Link from "next/link";

/**
 * Site header — rebuild design (02 §2.1 item 1): 56px, hairline border,
 * wordmark only, no nav bloat, no emergency-bait phone CTA. Static server
 * component; no JS shipped for the header.
 */
export default function Header() {
  return (
    <header className="fpn fpn-site-header">
      <div className="wrap-wide site-inner">
        <Link className="wordmark" href="/">
          <span className="brand-symbol" aria-hidden="true">
            ↗
          </span>
          <span>
            FastPlumber<em> near me</em>
          </span>
        </Link>
        <nav className="site-nav">
          <Link href="/plumbers" className="nav-wide">
            Find my plumber
          </Link>
          <Link href="/methodology">Our approach</Link>
          <Link href="/add-your-business">For plumbers</Link>
        </nav>
      </div>
    </header>
  );
}
