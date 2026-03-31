import Link from "next/link";
import { Wrench, Mail, MapPin } from "lucide-react";

const cityLinks = [
  { name: "Crystal Lake, IL", slug: "crystal-lake-il" },
  { name: "McHenry, IL", slug: "mchenry-il" },
  { name: "Algonquin, IL", slug: "algonquin-il" },
  { name: "Lake in the Hills, IL", slug: "lake-in-the-hills-il" },
  { name: "Huntley, IL", slug: "huntley-il" },
  { name: "Woodstock, IL", slug: "woodstock-il" },
  { name: "Cary, IL", slug: "cary-il" },
  { name: "Elgin, IL", slug: "elgin-il" },
  { name: "Naperville, IL", slug: "naperville-il" },
  { name: "Schaumburg, IL", slug: "schaumburg-il" },
  { name: "Aurora, IL", slug: "aurora-il" },
  { name: "Arlington Heights, IL", slug: "arlington-heights-il" },
];

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
                <li key={city.slug}>
                  <Link
                    href={`/emergency-plumbers/${city.slug}`}
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
