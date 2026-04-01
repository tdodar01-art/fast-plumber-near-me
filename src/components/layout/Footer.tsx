import Link from "next/link";
import { Wrench, Mail, MapPin } from "lucide-react";
import { CITY_LIST } from "@/lib/city-list";

// Show top cities in footer (by name, capped at 15)
const cityLinks = CITY_LIST.slice(0, 15).map((c) => ({
  name: `${c.name}, ${c.state}`,
  href: `/emergency-plumbers/${c.stateSlug}/${c.citySlug}`,
}));

export default function Footer() {
  return (
    <footer className="bg-primary text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 font-bold text-lg mb-3">
              <Wrench className="w-5 h-5 text-accent-light" />
              Fast Plumber Near Me
            </div>
            <p className="text-sm text-blue-200 leading-relaxed">
              Find verified, responsive emergency plumbers in your area. We call them so you
              don&apos;t have to wonder if they&apos;ll pick up.
            </p>
            <div className="mt-4 space-y-2 text-sm text-blue-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                135 Erick St Unit F, Crystal Lake, IL 60014
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:fastplumbernearme@gmail.com" className="hover:text-white transition-colors">
                  fastplumbernearme@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm text-blue-200">
              <li><Link href="/emergency-plumbers" className="hover:text-white transition-colors">Find a Plumber</Link></li>
              <li><Link href="/how-we-verify" className="hover:text-white transition-colors">How We Verify</Link></li>
              <li><Link href="/add-your-business" className="hover:text-white transition-colors">List Your Business</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Emergency Guides</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm text-blue-200">
              <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h3 className="font-semibold mb-3">Service Areas</h3>
            <ul className="space-y-1.5 text-sm text-blue-200">
              {cityLinks.map((city) => (
                <li key={city.href}>
                  <Link
                    href={city.href}
                    className="hover:text-white transition-colors"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-light mt-10 pt-6 text-center text-sm text-blue-300">
          &copy; {new Date().getFullYear()} Fast Plumber Near Me. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
