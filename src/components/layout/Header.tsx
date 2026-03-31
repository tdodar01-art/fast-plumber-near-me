"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Phone, Wrench } from "lucide-react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-primary text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl">
            <Wrench className="w-6 h-6 text-accent-light" />
            <span>Fast Plumber Near Me</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/emergency-plumbers" className="hover:text-accent-light transition-colors">
              Find a Plumber
            </Link>
            <Link href="/how-we-verify" className="hover:text-accent-light transition-colors">
              How We Verify
            </Link>
            <Link href="/add-your-business" className="hover:text-accent-light transition-colors">
              List Your Business
            </Link>
            <Link href="/about" className="hover:text-accent-light transition-colors">
              About
            </Link>
            <a
              href="tel:+18155555555"
              className="flex items-center gap-1.5 bg-accent hover:bg-accent-dark px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" />
              Emergency?
            </a>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-primary-light transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-primary-dark border-t border-primary-light">
          <div className="px-4 py-3 space-y-2">
            <Link
              href="/emergency-plumbers"
              className="block px-3 py-2 rounded-lg hover:bg-primary-light transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Find a Plumber
            </Link>
            <Link
              href="/how-we-verify"
              className="block px-3 py-2 rounded-lg hover:bg-primary-light transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              How We Verify
            </Link>
            <Link
              href="/add-your-business"
              className="block px-3 py-2 rounded-lg hover:bg-primary-light transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              List Your Business
            </Link>
            <Link
              href="/about"
              className="block px-3 py-2 rounded-lg hover:bg-primary-light transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              About
            </Link>
            <Link
              href="/contact"
              className="block px-3 py-2 rounded-lg hover:bg-primary-light transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Contact
            </Link>
            <a
              href="tel:+18155555555"
              className="block bg-accent hover:bg-accent-dark text-center px-3 py-3 rounded-lg font-semibold transition-colors mt-2"
            >
              <Phone className="w-4 h-4 inline mr-2" />
              Call for Emergency Help
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
