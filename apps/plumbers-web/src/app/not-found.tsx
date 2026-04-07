import Link from "next/link";
import { Home, Search, Phone } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist. Find verified emergency plumbers by searching your city.",
};

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="text-8xl font-extrabold text-primary/10 mb-2 select-none">404</div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Page Not Found</h1>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
        If you need an emergency plumber, we can help.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <Home className="w-4 h-4" />
          Go Home
        </Link>
        <Link
          href="/emergency-plumbers"
          className="inline-flex items-center justify-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <Search className="w-4 h-4" />
          Find a Plumber
        </Link>
      </div>
      {process.env.NEXT_PUBLIC_BUSINESS_PHONE && (
        <div className="mt-8 text-sm text-gray-500">
          Having a plumbing emergency?{" "}
          <a href={`tel:${process.env.NEXT_PUBLIC_BUSINESS_PHONE}`} className="text-accent font-semibold hover:text-accent-dark inline-flex items-center gap-1">
            <Phone className="w-3 h-3" /> Call Now
          </a>
        </div>
      )}
    </div>
  );
}
