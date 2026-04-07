import Link from "next/link";
import { Phone, ClipboardList } from "lucide-react";

export default function CallToAction() {
  return (
    <section className="bg-primary text-white py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          Are You a Plumber?
        </h2>
        <p className="text-blue-200 text-lg mb-8 max-w-2xl mx-auto">
          Get listed on Fast Plumber Near Me and connect with homeowners who need
          emergency plumbing help right now. Free basic listings available.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/add-your-business"
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-3.5 px-8 rounded-xl text-lg transition-colors"
          >
            <ClipboardList className="w-5 h-5" />
            List Your Business — Free
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:bg-white/10 text-white font-semibold py-3.5 px-8 rounded-xl transition-colors"
          >
            <Phone className="w-5 h-5" />
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
