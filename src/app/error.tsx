"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw, Phone } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="text-6xl font-extrabold text-accent/20 mb-4 select-none">Oops</div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
        Something Went Wrong
      </h1>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        We hit an unexpected error. This has been logged and we&apos;ll look into it.
        In the meantime, try refreshing the page.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <Home className="w-4 h-4" />
          Go Home
        </Link>
      </div>
      <div className="mt-8 text-sm text-gray-500">
        Having a plumbing emergency?{" "}
        <a href="tel:+18155555555" className="text-accent font-semibold hover:text-accent-dark inline-flex items-center gap-1">
          <Phone className="w-3 h-3" /> Call Now
        </a>
      </div>
    </div>
  );
}
